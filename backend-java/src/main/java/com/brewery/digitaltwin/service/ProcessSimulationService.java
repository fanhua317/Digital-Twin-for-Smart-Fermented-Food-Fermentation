package com.brewery.digitaltwin.service;

import com.brewery.digitaltwin.dto.AGVState;
import com.brewery.digitaltwin.dto.EquipmentState;
import com.brewery.digitaltwin.dto.RealtimeMessage;
import com.brewery.digitaltwin.dto.SimulationSnapshot;
import com.brewery.digitaltwin.entity.Device;
import com.brewery.digitaltwin.entity.DeviceData;
import com.brewery.digitaltwin.entity.Pit;
import com.brewery.digitaltwin.entity.ProductionBatch;
import com.brewery.digitaltwin.repository.DeviceDataRepository;
import com.brewery.digitaltwin.repository.DeviceRepository;
import com.brewery.digitaltwin.repository.PitRepository;
import com.brewery.digitaltwin.repository.ProductionBatchRepository;
import com.brewery.digitaltwin.websocket.RealtimeWebSocketHandler;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * 工艺主仿真器：白酒生产数字孪生的单一数据源 (SSoT)。
 *
 * <p>每秒一拍，按工厂级速率推进设备物料、AGV 物流、窖池阶段、生产批次。
 * 严格遵守物料守恒：source.output -= amount → AGV.weight = amount → AGV.weight = 0,
 * target.input += amount。</p>
 *
 * <p>仿真时间换算：1 实秒 = 1 仿真分钟 (TIME_SCALE=60)，演示 60 秒可见 1 个发酵小时。</p>
 *
 * <p>工艺路线：起糟(窖池→搅拌机) → 拌粮(搅拌机→上甑机器人) → 上甑(机器人→蒸馏塔)
 * → 蒸馏出酒(塔→摊凉机) → 摊凉加曲(摊凉机→入池) → 发酵 (窖池, 60 仿真天)。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ProcessSimulationService {

    /** 1 实秒 = 60 仿真分钟，方便演示 */
    public static final double TIME_SCALE = 60.0;

    /**
     * AGV 任务路径预定义 (与新的紧凑 3D 场景坐标一致)
     * 厂房布局:
     *   A区 (-42,-28)~(-30,-16)  B区 (32,-28)~(44,-16)
     *           ↓                       ↑
     *      配料-上甑-馏酒-摊凉(西→东 一条产线)
     *           ↑                       ↓
     *   C区 (-42,8)~(-30,20)     D区 (32,8)~(44,20)
     *
     * 5 条主路径都从 / 到 真实窖池区，让车辆视觉上与窖池有连接
     */
    // ① 起糟: A 区窖池 → 搅拌机 (配料区) — AGV-01 主车
    private static final double[][] PATH_DISCHARGE_A = {
            {-36, 0, -22}, {-32, 0, -22}, {-30, 0, -18}, {-28, 0, -15}, {-25, 0, -15}
    };
    // ⑥ 起糟: C 区窖池 → 搅拌机 (配料区) — AGV-06 备车从 C 区出
    private static final double[][] PATH_DISCHARGE_C = {
            {-36, 0, 14}, {-32, 0, 12}, {-30, 0, 6}, {-28, 0, -8}, {-25, 0, -15}
    };
    // ② 拌粮: 搅拌机 → 上甑机器人 (西侧产线)
    private static final double[][] PATH_MIX = {
            {-25, 0, -15}, {-30, 0, -15}, {-30, 0, 0}, {-25, 0, 0}
    };
    // ③ 上甑: 上甑机器人 → 蒸馏塔 (沿主产线东向)
    private static final double[][] PATH_LOAD = {
            {-25, 0, 0}, {-15, 0, 0}, {-10, 0, 0}, {0, 0, 0}
    };
    // ④ 出甑: 蒸馏塔 → 摊凉机 (沿主产线东向)
    private static final double[][] PATH_DISTILL = {
            {0, 0, 0}, {10, 0, 0}, {15, 0, 0}, {25, 0, 0}
    };
    // ⑤ 入池: 摊凉机 → B 区窖池 — AGV-05 主车
    private static final double[][] PATH_COOLING_B = {
            {25, 0, 0}, {30, 0, -8}, {34, 0, -18}, {38, 0, -22}
    };
    // ⑦ 入池: 摊凉机 → D 区窖池 — AGV-08 备车至 D 区
    private static final double[][] PATH_COOLING_D = {
            {25, 0, 0}, {30, 0, 8}, {34, 0, 14}, {38, 0, 18}
    };

    /** 设备工位编码 */
    public static final String CODE_MIXER = "MIXER";
    public static final String CODE_STEAMER_BOT = "STEAMER_BOT";
    public static final String CODE_DISTILLER = "DISTILLER";
    public static final String CODE_COOLER = "COOLER";
    public static final String CODE_PUMP = "PUMP";

    private final PitRepository pitRepository;
    private final DeviceRepository deviceRepository;
    private final DeviceDataRepository deviceDataRepository;
    private final ProductionBatchRepository batchRepository;
    private final RealtimeWebSocketHandler webSocketHandler;
    private final ObjectMapper objectMapper;

    @Value("${app.simulator.enabled:true}")
    private boolean enabled;

    /** 暂停标志：暂停时仍广播快照便于前端显示当前状态，但不推进物料/AGV/发酵 */
    private volatile boolean paused = false;

    private final Random random = new Random();

    /** 设备工位状态表 (内存维护，权威数据源) */
    private final Map<String, EquipmentState> equipments = new ConcurrentHashMap<>();
    /** AGV 状态表 */
    private final Map<String, AGVState> agvs = new ConcurrentHashMap<>();

    private final AtomicLong uptimeSeconds = new AtomicLong(0);

    /** 全厂统计 */
    private double totalTransported = 0;
    private double totalProcessed = 0;
    private double totalLiquor = 0;
    private long completedCycles = 0;

    // ===== 分级摘酒储罐 (头酒 5% / 中段 85% / 尾酒 10%) =====
    private double headLiquor = 0;
    private double midLiquor = 0;
    private double tailLiquor = 0;
    private static final double LIQUOR_CAPACITY = 5000.0;

    // ===== 原料发放仓 (粉粮/稻壳/曲粉) =====
    private final double[] huskBin = {2000, 3000, 0};   // 稻壳
    private final double[] grainBin = {3000, 5000, 0};  // 粉粮
    private final double[] kojiBin = {1500, 2500, 0};   // 曲粉
    private final double[] diuzaoBin = {0, 3000, 0};    // 丢糟暂存仓

    // ===== 摊凉机三段冷却温度 =====
    private double coolerStage1Temp = 42;  // 第一段：40-45°C
    private double coolerStage2Temp = 25;  // 第二段：22-28°C
    private double coolerStage3Temp = 13;  // 第三段：12-14°C
    private double coolerFanPower = 65;    // 鼓风机功率 %

    /** 当前正在累积产量的批次 */
    private volatile Long activeBatchId = null;
    /** 已发酵就绪的窖池队列 (待 AGV-01 起糟) */
    private final Deque<Long> readyPitQueue = new ArrayDeque<>();

    /** 糟醅类型典型分布：楂醅 70% / 红糟 25% / 丢糟 5% */
    private static final String[] GRAIN_CATEGORIES = {"zhapei", "hongzao", "diuzao"};
    private static final double[] GRAIN_RATIOS = {0.70, 0.25, 0.05};

    @PostConstruct
    public void init() {
        // 推迟到 DataInitializer 跑完后再装载，由 ensureInitialized 保证
    }

    /** 在第一次仿真节拍前确保设备/AGV 已加载到内存 */
    private synchronized void ensureInitialized() {
        if (!equipments.isEmpty() && !agvs.isEmpty()) return;

        // 1) 装载核心生产线设备 (DataInitializer 已写入 DB，按 deviceNo 匹配)
        // 真实工厂吞吐 (TIME_SCALE=60 时 1 实秒 = 1 仿真分钟，所以 rate 单位 kg/仿真分钟):
        //  - 搅拌机: ~1.5 t/h = 25 kg/min ≈ 后端 rate=25 (匹配真实工厂)
        //  - 上甑机器人 (含装料周期): ~1.2 t/h = 20 kg/min
        //  - 蒸馏塔 (单甑容量 600-800 kg/45min): ~1.0 t/h = 15 kg/min; 出酒率 30%
        //  - 摊凉机: ~1.5 t/h = 25 kg/min (出料快, 平铺冷却)
        //  - 输送泵 (底锅补水): ~5 L/s ≈ 0.3 t/h = 5 kg/min
        // 流水线 processRate 严格平衡 - 让 5 设备的物料量保持流动不堆积也不饿死:
        //   AGV 单 trip 700kg, 周期 35s => 约 20 kg/s 单车吞吐
        //   MIXER ← AGV-01/06 双车  ≈ 40 kg/s 入料  →  MIXER 处理 22 kg/s (出料给 AGV-02)
        //   STEAMER ← AGV-02 单车 ≈ 20 kg/s         →  STEAMER 处理 22 kg/s (略快, 输出不积压)
        //   DISTILLER ← AGV-03/07 双车 ≈ 40 kg/s    →  DISTILLER 22 kg/s, 出料 30% 酒+70% 糟
        //                                              (实际酒糟产出 22*0.7=15.4 kg/s)
        //   COOLER ← AGV-04 单车 ≈ 15 kg/s 酒糟      →  COOLER 处理 15 kg/s (匹配下游 AGV-05/08 取走)
        //   PUMP ← 自动循环 → DISTILLER 底锅水 8 kg/s (匹配 22 kg/s 蒸馏 * 0.4kg水/kg粮)
        equipments.put(CODE_MIXER, mkEquip(CODE_MIXER, "MX-001", "搅拌机", "motor",
                "出窖糟醅", "拌合粮",
                3000, 3000, 22.0, 1.0,
                null, 0, 0,
                new double[]{-25, 0, -15}));
        equipments.put(CODE_STEAMER_BOT, mkEquip(CODE_STEAMER_BOT, "RB-001", "上甑机器人", "robot",
                "拌合粮", "上甑粮",
                3000, 2500, 22.0, 1.0,
                null, 0, 0,
                new double[]{-25, 0, 0}));
        equipments.put(CODE_DISTILLER, mkEquip(CODE_DISTILLER, "DL-001", "蒸馏塔", "distiller",
                "上甑粮", "基酒",
                2500, 2500, 22.0, 0.30,
                "底锅水", 1500, 2000,
                new double[]{0, 0, 0}));
        equipments.put(CODE_COOLER, mkEquip(CODE_COOLER, "CL-001", "摊凉机", "conveyor",
                "酒糟", "入池粮",
                2500, 3000, 15.0, 1.0,
                "曲粉", 800, 1200,
                new double[]{25, 0, 0}));
        // 输送泵速率必须 ≥ 蒸馏塔水消耗 (22 kg/s 粮 × 0.4 kg水/kg粮 = 8.8 kg/s 水), 取 10 kg/s 留余量
        equipments.put(CODE_PUMP, mkEquip(CODE_PUMP, "PM-001", "输送泵", "pump",
                "回水", "底锅水",
                3000, 2000, 10.0, 1.0,
                null, 0, 0,
                new double[]{-25, 0, 15}));

        // 2) 同步 deviceId
        for (EquipmentState e : equipments.values()) {
            deviceRepository.findByDeviceNo(e.getName()).ifPresent(d -> e.setDeviceId(d.getId()));
        }

        // 3) AGV 队伍 - 8 台 (真实工厂典型规模, 5 主+3 备并行支撑生产线)
        //   - 载重 700-900 kg (现实工厂 AGV 通常 500-1500 kg)
        //   - 速度 3-5 units/sec (3D 场景中 50 units 厂房, 一次单程 ~12-15s, 接近现实 1m/s AGV)
        //   - 货物属性 (温度/pH/水分): 出窖糟醅 32°C/pH3.6/含水 56%, 出甑酒糟 85°C
        //   - 起糟+入池+上甑各配 2 台 (主+备), 形成并行流水
        // 任务命名格式: 【工序号 工序名】 起点→终点  - 让前端一眼看清属于哪个工艺步骤
        agvs.put("AGV-01", mkAgv("AGV-01", "①起糟 · A区窖池→搅拌机", "fermented", null, CODE_MIXER,
                900, 32.0, 3.6, 56, PATH_DISCHARGE_A, 3.5));
        agvs.put("AGV-02", mkAgv("AGV-02", "②拌粮转运 · 搅拌机→上甑机器人", "mixed", CODE_MIXER, CODE_STEAMER_BOT,
                850, 28.0, 4.0, 54, PATH_MIX, 3.8));
        agvs.put("AGV-03", mkAgv("AGV-03", "③上甑给料·主 · 上甑机器人→蒸馏塔", "mixed", CODE_STEAMER_BOT, CODE_DISTILLER,
                700, 26.0, 4.2, 52, PATH_LOAD, 4.0));
        agvs.put("AGV-04", mkAgv("AGV-04", "④出甑转运 · 蒸馏塔→摊凉机", "distilled", CODE_DISTILLER, CODE_COOLER,
                700, 85.0, 3.5, 60, PATH_DISTILL, 3.5));
        agvs.put("AGV-05", mkAgv("AGV-05", "⑤入池发酵 · 摊凉机→B区窖池", "cooled", CODE_COOLER, null,
                750, 24.0, 3.6, 53, PATH_COOLING_B, 3.8));
        // 备机分配到 C/D 区, 覆盖全部 4 个窖池区, 形成完整闭环
        agvs.put("AGV-06", mkAgv("AGV-06", "①起糟·备 · C区窖池→搅拌机", "fermented", null, CODE_MIXER,
                900, 31.0, 3.7, 55, PATH_DISCHARGE_C, 3.4));
        agvs.put("AGV-07", mkAgv("AGV-07", "③上甑给料·备 · 上甑机器人→蒸馏塔", "mixed", CODE_STEAMER_BOT, CODE_DISTILLER,
                700, 27.0, 4.1, 53, PATH_LOAD, 3.9));
        agvs.put("AGV-08", mkAgv("AGV-08", "⑤入池发酵·备 · 摊凉机→D区窖池", "cooled", CODE_COOLER, null,
                750, 25.0, 3.7, 54, PATH_COOLING_D, 3.7));
        // 备机半周期错位起步 (segmentIndex 推到 2，progress 0.5)
        for (String code : new String[]{"AGV-06", "AGV-07", "AGV-08"}) {
            AGVState a = agvs.get(code);
            if (a != null && a.getPath() != null && a.getPath().length >= 3) {
                a.setSegmentIndex(1);
                a.setSegmentProgress(0.5);
                double[] p1 = a.getPath()[1];
                double[] p2 = a.getPath()[2];
                a.setPosition(new double[]{
                        p1[0] + (p2[0] - p1[0]) * 0.5,
                        p1[1] + (p2[1] - p1[1]) * 0.5,
                        p1[2] + (p2[2] - p1[2]) * 0.5
                });
            }
        }

        // 4) 初始化 Ready Pit 队列
        rebuildReadyQueue();

        log.info("[Sim] 工艺主仿真器初始化完成: {} 设备, {} AGV, {} 待起糟窖池",
                equipments.size(), agvs.size(), readyPitQueue.size());
    }

    private EquipmentState mkEquip(String code, String name, String displayName, String type,
                                   String inputName, String outputName,
                                   double inCap, double outCap,
                                   double rate, double conv,
                                   String auxName, double aux, double auxCap,
                                   double[] position) {
        EquipmentState e = new EquipmentState();
        e.setCode(code);
        e.setName(name);
        e.setType(type);
        e.setStage(displayName);
        e.setStatus("running");
        e.setInputName(inputName);
        e.setOutputName(outputName);
        e.setInputCapacity(inCap);
        e.setOutputCapacity(outCap);
        e.setProcessRate(rate);
        e.setConversionRate(conv);
        e.setAuxName(auxName);
        e.setAuxLevel(aux);
        e.setAuxCapacity(auxCap);
        e.setPosition(position);
        e.setInputLevel(inCap * 0.4);
        e.setOutputLevel(outCap * 0.2);
        e.setPower(15);
        e.setTemperature(40);
        return e;
    }

    private AGVState mkAgv(String code, String task, String cargoType,
                           String fromCode, String toCode,
                           double weightCap, double temperature, double ph, double moisture,
                           double[][] path, double speed) {
        AGVState a = new AGVState();
        a.setCode(code);
        a.setTask(task);
        a.setCargoType(cargoType);
        a.setStage("loading");
        a.setFromCode(fromCode);
        a.setToCode(toCode);
        a.setWeight(0);
        a.setWeightCapacity(weightCap);
        a.setTemperature(temperature);
        a.setPh(ph);
        a.setMoisture(moisture);
        a.setSegmentIndex(0);
        a.setSegmentProgress(0);
        a.setPath(path);
        a.setPosition(path[0].clone());
        a.setSpeed(speed);
        a.setCycleCount(0);
        a.setTotalTransported(0);
        return a;
    }

    /**
     * 按区域偏好挑选 1 个待起糟窖池: 优先 discharging (半空池继续起), 否则 ready。
     * preferredZone 不为 null 时强制在该区域内挑, 找不到才回退到全局。
     *
     * 选择策略 (避免 min(pitNo) 导致的固定顺序饥饿):
     *   1) 优先 discharging (要把已经在挖的池子挖完, 工艺合理)
     *   2) ready 状态中, 优先发酵天数最大的 (最成熟的糟醅), 同发酵天的随机选
     *   3) 区域用尽则全局回退
     * 这样能保证 4 个丢糟池(分布在 B-029/C-065/D-077/D-081)也会被公平挑到, 不再只挖低 pitNo 的池。
     */
    private Pit pickReadyPit(String preferredZone) {
        // 1. discharging 状态 (半空池) 优先
        List<Pit> discharging = pitRepository.findByStage("discharging");
        if (preferredZone != null) {
            Pit p = pickPreferred(discharging, preferredZone);
            if (p != null) return p;
        } else if (!discharging.isEmpty()) {
            return pickPreferred(discharging, null);
        }
        // 2. ready 状态: 偏好高发酵天 + 随机扰动 (避免固定顺序饥饿)
        List<Pit> ready = pitRepository.findByStage("ready");
        if (preferredZone != null) {
            Pit p = pickPreferred(ready, preferredZone);
            if (p != null) return p;
        }
        // 3. 全局回退
        Pit p = pickPreferred(ready, null);
        if (p != null) return p;
        return pickPreferred(discharging, null);
    }

    /**
     * 从池列表中挑 1 个待起糟池。preferredZone=null 表示不过滤区域。
     * 取最大发酵天数对应的所有池（通常都是 60 天=ready 的池），从中**完全随机**选一个，
     * 这样保证 4 个丢糟池 (B-029/C-065/D-077/D-081) 与其他 ready 池被公平挑选。
     */
    private Pit pickPreferred(List<Pit> pits, String preferredZone) {
        java.util.stream.Stream<Pit> stream = pits.stream();
        if (preferredZone != null) {
            stream = stream.filter(p -> preferredZone.equals(p.getZone()));
        }
        List<Pit> filtered = stream.collect(java.util.stream.Collectors.toList());
        if (filtered.isEmpty()) return null;
        // 找出最大发酵天数
        int maxDay = filtered.stream()
                .mapToInt(p -> p.getFermentationDay() == null ? 0 : p.getFermentationDay())
                .max().orElse(0);
        // 在最大发酵天数的所有池中完全随机选 1 个 (避免饥饿)
        List<Pit> mature = filtered.stream()
                .filter(p -> (p.getFermentationDay() == null ? 0 : p.getFermentationDay()) == maxDay)
                .collect(java.util.stream.Collectors.toList());
        return mature.get(random.nextInt(mature.size()));
    }

    /**
     * 按区域偏好挑选 1 个入池目标窖池: 优先 filling (继续填), 否则 empty。
     */
    private Pit pickFillPit(String preferredZone) {
        List<Pit> filling = pitRepository.findByStage("filling");
        if (preferredZone != null) {
            Pit p = filling.stream().filter(x -> preferredZone.equals(x.getZone()))
                    .min(Comparator.comparing(Pit::getPitNo)).orElse(null);
            if (p != null) return p;
        } else if (!filling.isEmpty()) {
            return filling.stream().min(Comparator.comparing(Pit::getPitNo)).orElse(null);
        }
        List<Pit> empty = pitRepository.findByStage("empty");
        if (preferredZone != null) {
            Pit p = empty.stream().filter(x -> preferredZone.equals(x.getZone()))
                    .min(Comparator.comparing(Pit::getPitNo)).orElse(null);
            if (p != null) return p;
        }
        return empty.stream().min(Comparator.comparing(Pit::getPitNo))
                .orElse(filling.stream().min(Comparator.comparing(Pit::getPitNo)).orElse(null));
    }

    /** 装入 ready/discharging 窖池作为起糟队列 (discharging 优先头部，避免半空池被替换) */
    private void rebuildReadyQueue() {
        readyPitQueue.clear();
        List<Pit> discharging = pitRepository.findByStage("discharging");
        discharging.sort(Comparator.comparing(Pit::getPitNo));
        for (Pit p : discharging) readyPitQueue.add(p.getId());
        List<Pit> ready = pitRepository.findByStage("ready");
        ready.sort(Comparator.comparing(Pit::getPitNo));
        for (Pit p : ready) readyPitQueue.add(p.getId());
    }

    // ==================== 主仿真节拍 ====================

    /** 1 秒一拍 - 工艺主循环 */
    @Scheduled(fixedRate = 1000)
    @Transactional
    public void tick() {
        if (!enabled) return;
        try {
            ensureInitialized();
            // 暂停时只刷新快照，不推进物料/AGV/发酵
            if (paused) {
                broadcastSnapshot();
                return;
            }
            double dt = 1.0; // 实秒
            uptimeSeconds.incrementAndGet();

            tickEquipments(dt);
            tickAgvs(dt);
            tickProduction(dt);
            broadcastSnapshot();
        } catch (Exception e) {
            log.error("[Sim] tick 失败", e);
        }
    }

    /**
     * 每 5 秒一次：把核心设备 + 8 AGV 的实时状态写入 DeviceData 表
     * 让 /devices/{id}/data 接口能查询到历史数据 (与 SimulatorService 节奏对齐, 同一时间轴)
     */
    @Scheduled(fixedRate = 5000)
    @Transactional
    public void persistCoreDeviceData() {
        if (!enabled || paused) return;
        try {
            ensureInitialized();
            // 5 台核心设备: 写入 power/temperature, vibration/speed 按设备类型估算
            for (EquipmentState e : equipments.values()) {
                if (e.getDeviceId() == null) continue;
                DeviceData d = new DeviceData();
                d.setDeviceId(e.getDeviceId());
                d.setPower(round1(e.getPower()));
                d.setTemperature(round1(e.getTemperature()));
                // 振动: 处理量越大振动越明显 (0.5-3.5 mm/s 正常区间)
                double utilization = (e.getInputLevel() + e.getOutputLevel())
                        / Math.max(1, e.getInputCapacity() + e.getOutputCapacity());
                d.setVibration(round2(0.5 + utilization * 3.0 + random.nextGaussian() * 0.3));
                // 转速: 按处理速率换算 (典型 800-2500 rpm)
                d.setSpeed(round1(800 + e.getProcessRate() * 60 + random.nextGaussian() * 50));
                // 电流: 功率/电压 (假定 380V 三相)
                d.setCurrent(round2(e.getPower() / 0.38 / Math.sqrt(3)));
                deviceDataRepository.save(d);
            }
            // 8 AGV: 写入实时位置/温度/速度/累计运输
            for (AGVState a : agvs.values()) {
                Device dev = deviceRepository.findByDeviceNo(a.getCode()).orElse(null);
                if (dev == null) continue;
                DeviceData d = new DeviceData();
                d.setDeviceId(dev.getId());
                // AGV 功率: 满载 8 kW / 空载 2 kW
                double loadRatio = a.getWeight() / Math.max(1, a.getWeightCapacity());
                d.setPower(round1(2.0 + loadRatio * 6.0));
                // 温度: AGV 货物温度 (反映工艺阶段)
                d.setTemperature(round1(a.getTemperature()));
                // 振动: AGV 运行时 1-2 mm/s, 停止时 0.1
                boolean moving = "moving".equals(a.getStage()) || "returning".equals(a.getStage());
                d.setVibration(round2(moving ? 1.0 + random.nextDouble() : 0.1 + random.nextDouble() * 0.2));
                // 速度: 移动时按 speed 字段换算 km/h (units/sec × 3.6)
                d.setSpeed(round1(moving ? a.getSpeed() * 3.6 * 100 : 0));
                // 电流: 24V 直流 AGV 估算
                d.setCurrent(round2(d.getPower() / 0.024 / 10));  // 比例缩放
                deviceDataRepository.save(d);
            }
        } catch (Exception ex) {
            log.warn("[Sim] 持久化核心设备数据失败: {}", ex.getMessage());
        }
    }

    // ==================== 控制接口 ====================

    public synchronized boolean isPaused() {
        return paused;
    }

    public synchronized void pause() {
        paused = true;
        log.info("[Sim] 仿真已暂停");
    }

    public synchronized void resume() {
        paused = false;
        log.info("[Sim] 仿真已恢复");
    }

    /** 重置仿真：清空设备物料/AGV 位置/累计统计/活跃批次，并保留初始 ready 队列 */
    public synchronized void reset() {
        log.info("[Sim] 正在重置仿真...");
        equipments.clear();
        agvs.clear();
        uptimeSeconds.set(0);
        totalTransported = 0;
        totalProcessed = 0;
        totalLiquor = 0;
        completedCycles = 0;
        // 重置分级酒罐与原料仓
        headLiquor = 0; midLiquor = 0; tailLiquor = 0;
        grainBin[0] = grainBin[1] * 0.6; grainBin[2] = 0;
        huskBin[0] = huskBin[1] * 0.6; huskBin[2] = 0;
        kojiBin[0] = kojiBin[1] * 0.6; kojiBin[2] = 0;
        diuzaoBin[0] = 0; diuzaoBin[2] = 0;
        readyPitQueue.clear();
        // 关闭当前活跃批次为 planning
        if (activeBatchId != null) {
            batchRepository.findById(activeBatchId).ifPresent(b -> {
                b.setStatus("planning");
                batchRepository.save(b);
            });
        }
        activeBatchId = null;
        // 让 ensureInitialized 重新装载 5 设备 + 5 AGV + ready 队列
        ensureInitialized();
        paused = false;
        log.info("[Sim] 重置完成");
    }

    /** 设备物料处理 */
    private void tickEquipments(double dt) {
        // 输送泵：持续从回水生成底锅水，并推送给蒸馏塔
        EquipmentState pump = equipments.get(CODE_PUMP);
        EquipmentState distiller = equipments.get(CODE_DISTILLER);
        if (pump != null && distiller != null) {
            double pumpAmt = Math.min(pump.getProcessRate() * dt,
                    pump.getInputLevel());
            // 简化：泵的入料(回水)取之不尽，自动补充
            if (pump.getInputLevel() < pump.getInputCapacity() * 0.3) {
                pump.setInputLevel(pump.getInputCapacity() * 0.8);
            }
            pump.setInputLevel(Math.max(0, pump.getInputLevel() - pumpAmt));
            pump.setOutputLevel(Math.min(pump.getOutputCapacity(), pump.getOutputLevel() + pumpAmt));
            pump.setTotalProcessed(pump.getTotalProcessed() + pumpAmt);
            pump.setPower(8 + pumpAmt * 0.5);

            double drain = Math.min(pump.getOutputLevel(),
                    distiller.getAuxCapacity() - distiller.getAuxLevel());
            drain = Math.min(drain, 10.0 * dt);  // 匹配 PUMP 10 kg/s 速率, 避免 distiller 水饥死
            if (drain > 0) {
                pump.setOutputLevel(pump.getOutputLevel() - drain);
                distiller.setAuxLevel(distiller.getAuxLevel() + drain);
            }
        }

        // 搅拌机 / 上甑机器人 / 摊凉机：标准转化 (1:1)
        for (String code : new String[]{CODE_MIXER, CODE_STEAMER_BOT, CODE_COOLER}) {
            EquipmentState e = equipments.get(code);
            if (e == null) continue;
            double amt = Math.min(e.getInputLevel(), e.getProcessRate() * dt);
            amt = Math.min(amt, e.getOutputCapacity() - e.getOutputLevel());
            if (amt > 0) {
                e.setInputLevel(e.getInputLevel() - amt);
                e.setOutputLevel(e.getOutputLevel() + amt);
                e.setTotalProcessed(e.getTotalProcessed() + amt);
                e.setTotalOutput(e.getTotalOutput() + amt * e.getConversionRate());
                totalProcessed += amt;
            }
            // 摊凉机：消耗曲粉 (5% 加曲量)
            if (CODE_COOLER.equals(code) && amt > 0) {
                double quUsed = Math.min(e.getAuxLevel(), amt * 0.05);
                e.setAuxLevel(Math.max(0, e.getAuxLevel() - quUsed));
                if (e.getAuxLevel() < e.getAuxCapacity() * 0.2) {
                    e.setAuxLevel(e.getAuxCapacity()); // 自动补曲
                }
            }
            // 设备温度/功率随处理量浮动
            e.setPower(10 + (amt / Math.max(0.001, e.getProcessRate() * dt)) * 35
                    + random.nextDouble() * 4);
            double tempBase = CODE_DISTILLER.equals(code) ? 95
                    : CODE_COOLER.equals(code) ? 22
                    : 38;
            e.setTemperature(tempBase + Math.sin(uptimeSeconds.get() * 0.05) * 3
                    + random.nextDouble() * 2);
        }

        // 蒸馏塔：消耗 上甑粮 + 底锅水 → 产出基酒 (出酒率 30%) 与 酒糟 (70%)
        // 工艺分级摘酒：头酒 5% / 中段优级 85% / 尾酒 10%
        if (distiller != null) {
            double rate = distiller.getProcessRate() * dt;
            double grainAvail = distiller.getInputLevel();
            double waterAvail = distiller.getAuxLevel();
            double grainPerWater = 1.0 / 0.4; // 每 1kg 水蒸 2.5kg 粮
            double maxByGrain = grainAvail;
            double maxByWater = waterAvail * grainPerWater;
            double space = distiller.getOutputCapacity() - distiller.getOutputLevel();
            double amt = Math.min(Math.min(rate, Math.min(maxByGrain, maxByWater)), space);
            if (amt > 0) {
                distiller.setInputLevel(grainAvail - amt);
                distiller.setAuxLevel(waterAvail - amt / grainPerWater);
                double liquor = amt * distiller.getConversionRate();
                double draff = amt - liquor;
                distiller.setOutputLevel(distiller.getOutputLevel() + draff);
                distiller.setTotalProcessed(distiller.getTotalProcessed() + amt);
                distiller.setTotalOutput(distiller.getTotalOutput() + liquor);
                totalLiquor += liquor;
                totalProcessed += amt;

                // 分级摘酒：按工艺典型分级比例 (头 5% / 中 85% / 尾 10%)
                double head = liquor * 0.05;
                double mid = liquor * 0.85;
                double tail = liquor * 0.10;
                headLiquor = Math.min(LIQUOR_CAPACITY, headLiquor + head);
                midLiquor = Math.min(LIQUOR_CAPACITY * 3, midLiquor + mid);
                tailLiquor = Math.min(LIQUOR_CAPACITY, tailLiquor + tail);

                // 液罐满 ≥ 90% 时自动放空到 30% (模拟出厂灌装/转大储罐), 避免后续酒因 cap 丢失
                if (headLiquor >= LIQUOR_CAPACITY * 0.90) headLiquor = LIQUOR_CAPACITY * 0.30;
                if (midLiquor >= LIQUOR_CAPACITY * 3 * 0.90) midLiquor = LIQUOR_CAPACITY * 3 * 0.30;
                if (tailLiquor >= LIQUOR_CAPACITY * 0.90) tailLiquor = LIQUOR_CAPACITY * 0.30;

                // 累加到当前批次（仅中段优级酒计入批次产量）
                accumulateBatchLiquor(mid);
            }
            distiller.setPower(60 + amt * 4 + random.nextDouble() * 8);
            distiller.setTemperature(95 + Math.sin(uptimeSeconds.get() * 0.1) * 2);
            distiller.setStatus(amt > 0 ? "running" : (waterAvail < 50 ? "warning" : "running"));
        }

        // 搅拌机消耗原料：糟醅 + 粉粮(0.33×) + 稻壳(0.08×) + 曲粉(0.22×) → 拌合粮
        // 按 PPT 比例：糟醅 420kg + 粮 140kg + 稻壳 35kg + 曲粉 ~30kg (出窖前一甑加曲)
        EquipmentState mixer = equipments.get(CODE_MIXER);
        if (mixer != null) {
            double consumed = Math.min(mixer.getInputLevel(), mixer.getProcessRate() * dt);
            consumed = Math.min(consumed, mixer.getOutputCapacity() - mixer.getOutputLevel());
            if (consumed > 0) {
                // 从原料仓领取
                feedFromBin(grainBin, consumed * 0.33);
                feedFromBin(huskBin, consumed * 0.08);
            }
        }

        // 摊凉机：消耗曲粉 (5% 加曲量已在标准转化里处理，这里更新三段温度)
        EquipmentState cooler = equipments.get(CODE_COOLER);
        if (cooler != null) {
            // 出甑酒糟入口 ~95°C → 第一段 40-45°C → 第二段 22-28°C → 第三段 12-14°C
            double rate = cooler.getInputLevel() > 0 ? cooler.getProcessRate() : 0;
            coolerStage1Temp = 42 + Math.sin(uptimeSeconds.get() * 0.05) * 2 + random.nextGaussian() * 0.5;
            coolerStage2Temp = 25 + Math.sin(uptimeSeconds.get() * 0.07) * 2 + random.nextGaussian() * 0.4;
            coolerStage3Temp = 13 + Math.sin(uptimeSeconds.get() * 0.09) * 1 + random.nextGaussian() * 0.3;
            coolerFanPower = 50 + (rate / 25.0) * 40 + Math.sin(uptimeSeconds.get() * 0.1) * 5;
            // 加曲：从 koji 仓领料
            if (rate > 0) feedFromBin(kojiBin, rate * 0.05 * dt);
        }

        // 原料仓自动补给：低于 30% 容量时自动补满
        if (grainBin[0] < grainBin[1] * 0.30) grainBin[0] = grainBin[1] * 0.95;
        if (huskBin[0] < huskBin[1] * 0.30) huskBin[0] = huskBin[1] * 0.95;
        if (kojiBin[0] < kojiBin[1] * 0.30) kojiBin[0] = kojiBin[1] * 0.95;
    }

    /** 从原料仓领料，记录累计发放量 */
    private void feedFromBin(double[] bin, double amt) {
        double take = Math.min(bin[0], amt);
        bin[0] -= take;
        bin[2] += take;
    }

    /** AGV 物流：装→走→卸→返，严格物料守恒 */
    private void tickAgvs(double dt) {
        for (AGVState agv : agvs.values()) {
            String stage = agv.getStage();
            switch (stage) {
                case "loading":
                    if (loadCargo(agv)) {
                        agv.setStage("moving");
                        agv.setSegmentIndex(0);
                        agv.setSegmentProgress(0);
                    }
                    break;
                case "moving":
                    if (advanceAlongPath(agv, dt, true)) {
                        agv.setStage("unloading");
                    }
                    break;
                case "unloading":
                    if (unloadCargo(agv)) {
                        agv.setStage("returning");
                        agv.setSegmentIndex(agv.getPath().length - 2);
                        agv.setSegmentProgress(1.0);
                    }
                    break;
                case "returning":
                    if (advanceAlongPath(agv, dt, false)) {
                        agv.setStage("loading");
                        agv.setCycleCount(agv.getCycleCount() + 1);
                    }
                    break;
                default:
                    agv.setStage("loading");
            }
        }
    }

    /** AGV 装货：从 fromCode 设备的 outputLevel 抽走，装入 weight；起糟 AGV 从 ready 窖池取 */
    private boolean loadCargo(AGVState agv) {
        // 装货占用 1 仿真分钟，平均分摊到 1 实秒
        double request = agv.getWeightCapacity();
        double actual = 0;
        // 起糟 AGV 统一用 fromCode==null 识别 + 按车号选区域 (AGV-01→A区, AGV-06→C区)
        if (agv.getFromCode() == null) {
            // 区域偏好: AGV-01 优先 A 区, AGV-06 优先 C 区, 否则全局
            final String preferredZone = "AGV-01".equals(agv.getCode()) ? "A"
                    : "AGV-06".equals(agv.getCode()) ? "C" : null;
            Pit pit = pickReadyPit(preferredZone);
            if (pit == null) return false;
            if (!"discharging".equals(pit.getStage())) {
                pit.setStage("discharging");
                pitRepository.save(pit);
            }
            double take = Math.min(request, Math.max(0, pit.getGrainAmount()));
            pit.setGrainAmount(pit.getGrainAmount() - take);
            actual = take;

            // RFID 写入：糟醅类型/窖池号/出窖层数/时间
            String category = pit.getGrainCategory() == null ? "zhapei" : pit.getGrainCategory();
            agv.setGrainCategory(category);
            agv.setSourcePitNo(pit.getPitNo());
            agv.setDischargeLayer(1 + random.nextInt(7));   // 工艺多层挖醅，第 1-7 层
            agv.setDischargeTime(java.time.LocalDateTime.now().toString());

            // 丢糟池：糟醅直接入丢糟暂存仓，不进入主工艺线
            if ("diuzao".equals(category)) {
                diuzaoBin[0] = Math.min(diuzaoBin[1], diuzaoBin[0] + take);
                diuzaoBin[2] += take;
                actual = 0; // 不带入主链路
            }

            if (pit.getGrainAmount() <= 1) {
                pit.setGrainAmount(0.0);
                pit.setStage("empty");
                pit.setStatus("normal");
                pit.setCurrentBatchCode(null);
                readyPitQueue.pollFirst();
            }
            pitRepository.save(pit);
            // 丢糟池让 AGV 装载量为 0 时跳过主链路
            if ("diuzao".equals(category)) return false;
        } else {
            EquipmentState src = equipments.get(agv.getFromCode());
            if (src == null) return false;
            actual = Math.min(request, src.getOutputLevel());
            if (actual < 1) return false; // 等设备产出
            src.setOutputLevel(src.getOutputLevel() - actual);
        }
        agv.setWeight(actual);
        // 货物属性（取目标位置的工艺参数）
        randomizeCargoStats(agv);
        return actual > 0;
    }

    /** AGV 卸货：注入 toCode 设备的 inputLevel；入池 AGV 写入 filling 窖池 */
    private boolean unloadCargo(AGVState agv) {
        double cargo = agv.getWeight();
        if (cargo <= 0) return true;

        // 入池 AGV 统一用 toCode==null 识别 + 按车号选区域 (AGV-05→B区, AGV-08→D区)
        if (agv.getToCode() == null) {
            final String preferredZone = "AGV-05".equals(agv.getCode()) ? "B"
                    : "AGV-08".equals(agv.getCode()) ? "D" : null;
            Pit target = pickFillPit(preferredZone);
            if (target != null && "empty".equals(target.getStage())) {
                {
                    target.setStage("filling");
                    target.setFermentationDay(0);
                    target.setFermentationPhase("early");
                    // 入窖温度：夏 22-28°C / 冬 18-22°C 简化为 18-22°C
                    target.setEntryTemperature(18.0 + random.nextDouble() * 4);
                    // 工艺参数随机化 (符合 PPT 范围)
                    target.setEntryMoisture(51.0 + random.nextDouble() * 4);    // 51-55%
                    target.setEntryAcidity(1.4 + random.nextDouble() * 1.1);    // 1.4-2.5
                    target.setEntryStarch(18.0 + random.nextDouble() * 6);      // 18-24%
                    target.setGrainHullRatio(22.0 + random.nextDouble() * 5);   // 22-27%
                    target.setGrainKojiRatio(20.0 + random.nextDouble() * 5);   // 20-25%
                    target.setGrainMashRatio(4.0 + random.nextDouble() * 0.5);  // 1:4 ~ 1:4.5
                    // 新一轮糟醅类型分配：楂醅 70% / 红糟 25% / 丢糟 5%
                    double r = random.nextDouble();
                    String cat = r < GRAIN_RATIOS[0] ? GRAIN_CATEGORIES[0]
                            : r < GRAIN_RATIOS[0] + GRAIN_RATIOS[1] ? GRAIN_CATEGORIES[1]
                            : GRAIN_CATEGORIES[2];
                    target.setGrainCategory(cat);
                    target.setStatus("normal");
                    target.setCurrentBatchCode(currentBatchNo());
                    pitRepository.save(target);
                }
            }
            if (target == null) {
                // 没有可用的入池目标 → AGV 在原地等待 (backpressure), 货物不丢失
                // 等下一拍 advanceFermentation 把更多池子变 ready (起糟后变 empty 后可填)
                return false;
            }
            // 一个窖池容量 5000kg
            double capacity = 5000.0;
            double space = capacity - (target.getGrainAmount() == null ? 0 : target.getGrainAmount());
            double put = Math.min(cargo, space);
            target.setGrainAmount((target.getGrainAmount() == null ? 0 : target.getGrainAmount()) + put);
            if (target.getGrainAmount() >= capacity - 1) {
                target.setStage("fermenting");
            }
            pitRepository.save(target);
            agv.setWeight(cargo - put);
        } else {
            EquipmentState tgt = equipments.get(agv.getToCode());
            if (tgt == null) {
                agv.setWeight(0);
                return true;
            }
            double space = tgt.getInputCapacity() - tgt.getInputLevel();
            double put = Math.min(cargo, space);
            tgt.setInputLevel(tgt.getInputLevel() + put);
            agv.setWeight(cargo - put);
        }
        agv.setTotalTransported(agv.getTotalTransported() + (cargo - agv.getWeight()));
        totalTransported += (cargo - agv.getWeight());
        // 全部卸完才进入 returning
        return agv.getWeight() <= 0.001;
    }

    /** 沿路径前进，到达终点返回 true */
    private boolean advanceAlongPath(AGVState agv, double dt, boolean forward) {
        double[][] path = agv.getPath();
        int idx = agv.getSegmentIndex();
        double prog = agv.getSegmentProgress();
        if (idx < 0) idx = 0;
        if (idx >= path.length - 1) idx = path.length - 2;

        double[] p1 = path[idx];
        double[] p2 = path[idx + 1];
        double dx = p2[0] - p1[0], dy = p2[1] - p1[1], dz = p2[2] - p1[2];
        double dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < 0.01) {
            // 段长度太小，直接跳过
            return advanceSegment(agv, forward);
        }
        double step = (agv.getSpeed() * dt) / dist;
        prog += forward ? step : -step;

        boolean reached = false;
        if (forward && prog >= 1.0) {
            if (idx >= path.length - 2) {
                prog = 1.0;
                reached = true;
            } else {
                idx++;
                prog = 0;
            }
        } else if (!forward && prog <= 0.0) {
            if (idx <= 0) {
                prog = 0.0;
                reached = true;
            } else {
                idx--;
                prog = 1.0;
            }
        }
        agv.setSegmentIndex(idx);
        agv.setSegmentProgress(prog);
        // 计算实时坐标
        double[] q1 = path[idx];
        double[] q2 = path[Math.min(idx + 1, path.length - 1)];
        agv.setPosition(new double[]{
                q1[0] + (q2[0] - q1[0]) * prog,
                q1[1] + (q2[1] - q1[1]) * prog,
                q1[2] + (q2[2] - q1[2]) * prog
        });
        return reached;
    }

    private boolean advanceSegment(AGVState agv, boolean forward) {
        int idx = agv.getSegmentIndex();
        double[][] path = agv.getPath();
        if (forward && idx >= path.length - 2) return true;
        if (!forward && idx <= 0) return true;
        agv.setSegmentIndex(forward ? idx + 1 : idx - 1);
        agv.setSegmentProgress(forward ? 0 : 1);
        return false;
    }

    private void randomizeCargoStats(AGVState agv) {
        agv.setTemperature(agv.getTemperature() + random.nextGaussian() * 0.5);
        agv.setPh(Math.max(2.5, Math.min(5.0, agv.getPh() + random.nextGaussian() * 0.05)));
    }

    // ==================== 生产批次 / 窖池阶段 ====================

    private void tickProduction(double dt) {
        // 演示节拍：每 12 实秒推进 1 仿真天，60 天发酵 = 12 分钟 (供 AGV-05 补池)
        long up = uptimeSeconds.get();
        if (up % 12 == 0) {
            advanceFermentation();
        }
        ensureActiveBatch();
    }

    private void advanceFermentation() {
        List<Pit> ferm = pitRepository.findByStage("fermenting");
        for (Pit pit : ferm) {
            int day = (pit.getFermentationDay() == null ? 0 : pit.getFermentationDay()) + 1;
            pit.setFermentationDay(day);

            // PPT 工艺三段曲线：
            // 前缓 (0-25天): 每天升温约 1°C, 25 天升到峰值
            // 中挺 (25-40天): 维持 30-33°C, 持续 10-15 天
            // 后缓落 (40-60天): 缓慢下降, 最佳幅度 4-5°C
            double base = pit.getEntryTemperature() == null ? 20.0 : pit.getEntryTemperature();
            double sensor;
            String phase;
            if (day <= 25) {
                phase = "early";
                // 前缓：每天 +0.55°C (12 天升约 7°C → 总 25 天升 13°C)
                sensor = base + (day * 0.52) + random.nextGaussian() * 0.6;
            } else if (day <= 40) {
                phase = "middle";
                // 中挺：30-33°C 维持
                sensor = 31.5 + Math.sin((day - 25) * 0.4) * 1.3 + random.nextGaussian() * 0.5;
            } else {
                phase = "late";
                // 后缓落：从峰值缓慢下降 4-5°C
                sensor = 30.0 - (day - 40) * 0.22 + random.nextGaussian() * 0.4;
            }
            pit.setFermentationPhase(phase);

            // 状态：alarm/warning 仅出现在异常工况
            String st = sensor > 36 ? "alarm" : sensor > 34 ? "warning" : "normal";
            pit.setStatus(st);
            if (day >= 60) {
                pit.setStage("ready");
                pit.setStatus("normal");
            }
            pitRepository.save(pit);
        }
        // 维持队列至少有 30 个 ready 窖池
        if (readyPitQueue.size() < 30) {
            rebuildReadyQueue();
        }
    }

    private synchronized void ensureActiveBatch() {
        // 1) 当前激活批次完成检查
        if (activeBatchId != null) {
            ProductionBatch b = batchRepository.findById(activeBatchId).orElse(null);
            if (b != null && "in_progress".equals(b.getStatus())
                    && b.getActualVolume() != null
                    && b.getActualVolume() >= b.getTargetVolume()) {
                b.setStatus("completed");
                b.setEndDate(LocalDateTime.now());
                b.setQualityScore(86.0 + random.nextDouble() * 10);
                batchRepository.save(b);
                completedCycles++;
                activeBatchId = null;
            }
        }

        // 2) 清理孤儿 in_progress 批次 (重启服务后会有旧 in_progress 批次没人写入)
        //    策略: 找到所有 in_progress 批次, 把最新的一个接管为 activeBatchId,
        //          其余按当前 actualVolume 收尾:
        //          - actualVolume >= 95% 目标 → 标 completed
        //          - 否则标 cancelled (释放 batch 列表的占位)
        if (activeBatchId == null) {
            List<ProductionBatch> orphans = batchRepository.findByStatus("in_progress");
            if (!orphans.isEmpty()) {
                // 按 startDate 降序, 选最新的接管
                orphans.sort((x, y) -> {
                    LocalDateTime sx = x.getStartDate() == null ? LocalDateTime.MIN : x.getStartDate();
                    LocalDateTime sy = y.getStartDate() == null ? LocalDateTime.MIN : y.getStartDate();
                    return sy.compareTo(sx);
                });
                ProductionBatch newest = orphans.get(0);
                activeBatchId = newest.getId();
                log.info("[Sim] 接管现有 in_progress 批次: {} (actualVolume={})",
                        newest.getBatchNo(), newest.getActualVolume());
                // 其余孤儿批次收尾
                for (int i = 1; i < orphans.size(); i++) {
                    ProductionBatch o = orphans.get(i);
                    double actual = o.getActualVolume() == null ? 0 : o.getActualVolume();
                    double target = o.getTargetVolume() == null ? 1 : o.getTargetVolume();
                    if (actual >= target * 0.95) {
                        o.setStatus("completed");
                        o.setQualityScore(86.0 + random.nextDouble() * 10);
                        completedCycles++;
                    } else {
                        o.setStatus("cancelled");
                    }
                    o.setEndDate(LocalDateTime.now());
                    batchRepository.save(o);
                    log.info("[Sim] 孤儿批次收尾: {} 状态={} actualVolume={}/{}",
                            o.getBatchNo(), o.getStatus(), actual, target);
                }
            }
        }

        // 3) 没有任何 in_progress 时新建一个
        if (activeBatchId == null) {
            ProductionBatch b = new ProductionBatch();
            b.setBatchNo(String.format("BATCH-%d-%04d",
                    LocalDateTime.now().getYear(), random.nextInt(9000) + 1000));
            b.setProductType("浓香型白酒");
            b.setTargetVolume(500.0); // 演示用：每批 500kg 基酒
            b.setActualVolume(0.0);
            b.setStatus("in_progress");
            b.setStartDate(LocalDateTime.now());
            b = batchRepository.save(b);
            activeBatchId = b.getId();
        }
    }

    private synchronized void accumulateBatchLiquor(double liquor) {
        if (activeBatchId == null) return;
        batchRepository.findById(activeBatchId).ifPresent(b -> {
            double cur = b.getActualVolume() == null ? 0 : b.getActualVolume();
            // 累加时四舍五入到 0.1 kg, 避免浮点累积出现 500.30999999... 这种小数尾巴
            b.setActualVolume(round1(cur + liquor));
            batchRepository.save(b);
        });
    }

    /** 四舍五入到 1 位小数 (避免浮点累积误差) */
    private static double round1(double v) { return Math.round(v * 10.0) / 10.0; }
    /** 四舍五入到 2 位小数 */
    private static double round2(double v) { return Math.round(v * 100.0) / 100.0; }

    private String currentBatchNo() {
        if (activeBatchId == null) return null;
        return batchRepository.findById(activeBatchId).map(ProductionBatch::getBatchNo).orElse(null);
    }

    // ==================== 数据快照 + 广播 ====================

    public synchronized SimulationSnapshot snapshot() {
        ensureInitialized();
        SimulationSnapshot s = new SimulationSnapshot();
        s.setUptimeSeconds(uptimeSeconds.get());
        s.setTimeScale(TIME_SCALE);
        s.setPaused(paused);
        // 深拷贝 (浅拷贝即可，前端只读) + 四舍五入每个设备的数值字段
        Map<String, EquipmentState> roundedEq = new HashMap<>();
        equipments.forEach((k, v) -> {
            EquipmentState c = new EquipmentState();
            c.setCode(v.getCode()); c.setName(v.getName()); c.setType(v.getType());
            c.setStage(v.getStage()); c.setStatus(v.getStatus());
            c.setDeviceId(v.getDeviceId());
            c.setInputName(v.getInputName()); c.setOutputName(v.getOutputName());
            c.setInputLevel(round1(v.getInputLevel()));
            c.setOutputLevel(round1(v.getOutputLevel()));
            c.setInputCapacity(v.getInputCapacity());
            c.setOutputCapacity(v.getOutputCapacity());
            c.setProcessRate(v.getProcessRate());
            c.setConversionRate(v.getConversionRate());
            c.setAuxName(v.getAuxName());
            c.setAuxLevel(round1(v.getAuxLevel()));
            c.setAuxCapacity(v.getAuxCapacity());
            c.setPower(round1(v.getPower()));
            c.setTemperature(round1(v.getTemperature()));
            c.setTotalProcessed(round1(v.getTotalProcessed()));
            c.setTotalOutput(round1(v.getTotalOutput()));
            c.setPosition(v.getPosition());
            roundedEq.put(k, c);
        });
        s.setEquipments(roundedEq);

        Map<String, AGVState> roundedAgv = new HashMap<>();
        agvs.forEach((k, v) -> {
            AGVState c = new AGVState();
            c.setCode(v.getCode()); c.setTask(v.getTask()); c.setCargoType(v.getCargoType());
            c.setStage(v.getStage());
            c.setFromCode(v.getFromCode()); c.setToCode(v.getToCode());
            c.setWeight(round1(v.getWeight()));
            c.setWeightCapacity(v.getWeightCapacity());
            c.setTemperature(round1(v.getTemperature()));
            c.setPh(round2(v.getPh()));
            c.setMoisture(round1(v.getMoisture()));
            c.setSegmentIndex(v.getSegmentIndex());
            c.setSegmentProgress(round2(v.getSegmentProgress()));
            c.setPath(v.getPath());
            c.setPosition(new double[]{ round2(v.getPosition()[0]), round2(v.getPosition()[1]), round2(v.getPosition()[2]) });
            c.setSpeed(v.getSpeed());
            c.setCycleCount(v.getCycleCount());
            c.setTotalTransported(round1(v.getTotalTransported()));
            c.setGrainCategory(v.getGrainCategory());
            c.setSourcePitNo(v.getSourcePitNo());
            c.setDischargeLayer(v.getDischargeLayer());
            c.setDischargeTime(v.getDischargeTime());
            roundedAgv.put(k, c);
        });
        s.setAgvs(roundedAgv);

        SimulationSnapshot.SimulationStats st = new SimulationSnapshot.SimulationStats();
        // 全部 stats 统一四舍五入 - 避免前端 toFixed 之外的浮点尾巴
        st.setTotalTransported(round1(totalTransported));
        st.setTotalProcessed(round1(totalProcessed));
        st.setTotalLiquor(round1(totalLiquor));
        st.setCompletedCycles(completedCycles);
        double power = equipments.values().stream().mapToDouble(EquipmentState::getPower).sum();
        st.setTotalPower(round1(power));
        double inputAccum = equipments.values().stream()
                .mapToDouble(EquipmentState::getTotalProcessed).sum();
        st.setYieldRate(round2(inputAccum > 0 ? totalLiquor / inputAccum * 100 : 0));
        st.setEfficiency(round2(Math.min(99.5, 70 + Math.min(25, totalLiquor / Math.max(1, uptimeSeconds.get()) * 30))));
        st.setSimulatedDays(round2(uptimeSeconds.get() * TIME_SCALE / (60.0 * 24)));
        s.setStats(st);

        // 活跃批次
        s.setActiveBatches(batchRepository.findByStatus("in_progress").stream().map(b -> {
            SimulationSnapshot.BatchSummary bs = new SimulationSnapshot.BatchSummary();
            bs.setId(b.getId());
            bs.setBatchNo(b.getBatchNo());
            bs.setProductType(b.getProductType());
            bs.setTargetVolume(round1(b.getTargetVolume() == null ? 0 : b.getTargetVolume()));
            bs.setActualVolume(round1(b.getActualVolume() == null ? 0 : b.getActualVolume()));
            bs.setProgress(round1(bs.getTargetVolume() > 0
                    ? Math.min(100.0, bs.getActualVolume() / bs.getTargetVolume() * 100) : 0));
            bs.setStage("蒸馏出酒");
            return bs;
        }).toList());

        // 阶段统计
        Map<String, Long> counts = new HashMap<>();
        pitRepository.countByStage().forEach(row -> counts.put((String) row[0], (Long) row[1]));
        s.setPitStageCounts(counts);

        // 糟醅类型统计
        Map<String, Long> grainCounts = new HashMap<>();
        pitRepository.findAll().forEach(p -> {
            String c = p.getGrainCategory() == null ? "zhapei" : p.getGrainCategory();
            grainCounts.merge(c, 1L, Long::sum);
        });
        s.setPitGrainCategoryCounts(grainCounts);

        // 分级摘酒储罐
        SimulationSnapshot.LiquorStorage liq = new SimulationSnapshot.LiquorStorage();
        liq.setHeadLiquor(round1(headLiquor));
        liq.setMidLiquor(round1(midLiquor));
        liq.setTailLiquor(round1(tailLiquor));
        liq.setCapacity(LIQUOR_CAPACITY);
        liq.setMidAlcoholDegree(round1(58 + Math.sin(uptimeSeconds.get() * 0.02) * 3));
        s.setLiquorStorage(liq);

        // 原料发放仓
        Map<String, SimulationSnapshot.RawMaterialBin> bins = new HashMap<>();
        bins.put("grain", makeBinDto("grain", "粉粮仓", grainBin));
        bins.put("husk", makeBinDto("husk", "稻壳仓", huskBin));
        bins.put("koji", makeBinDto("koji", "曲粉仓", kojiBin));
        s.setRawMaterials(bins);

        // 丢糟暂存仓
        s.setDiuzaoBin(makeBinDto("diuzao", "丢糟暂存仓", diuzaoBin));

        // 摊凉机三段冷却
        SimulationSnapshot.CoolerStages cs = new SimulationSnapshot.CoolerStages();
        cs.setStage1Temp(round1(coolerStage1Temp));
        cs.setStage2Temp(round1(coolerStage2Temp));
        cs.setStage3Temp(round1(coolerStage3Temp));
        cs.setFanPower(round1(coolerFanPower));
        cs.setOutletTemp(round1(coolerStage3Temp + random.nextGaussian() * 0.3));
        s.setCoolerStages(cs);

        return s;
    }

    private SimulationSnapshot.RawMaterialBin makeBinDto(String code, String name, double[] bin) {
        SimulationSnapshot.RawMaterialBin b = new SimulationSnapshot.RawMaterialBin();
        b.setCode(code);
        b.setName(name);
        b.setLevel(bin[0]);
        b.setCapacity(bin[1]);
        b.setTotalFed(bin[2]);
        b.setFeedRate(bin[0] > 0 ? 0.5 + random.nextDouble() : 0);
        return b;
    }

    private void broadcastSnapshot() {
        try {
            SimulationSnapshot snap = snapshot();
            RealtimeMessage msg = new RealtimeMessage("sim_snapshot", snap);
            webSocketHandler.broadcast(objectMapper.writeValueAsString(msg));
        } catch (Exception e) {
            log.warn("[Sim] 广播快照失败: {}", e.getMessage());
        }
    }

    // ==================== 对外只读视图 (供 Controller) ====================

    public Collection<EquipmentState> getEquipments() {
        ensureInitialized();
        return equipments.values();
    }

    public Collection<AGVState> getAgvs() {
        ensureInitialized();
        return agvs.values();
    }
}
