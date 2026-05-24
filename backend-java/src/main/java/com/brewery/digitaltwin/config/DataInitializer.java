package com.brewery.digitaltwin.config;

import com.brewery.digitaltwin.entity.*;
import com.brewery.digitaltwin.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Random;

/**
 * 数据初始化器 - 在应用启动后初始化演示数据
 */
@Slf4j
@Component
@Order(1)
@RequiredArgsConstructor
public class DataInitializer implements ApplicationRunner {
    
    private final PitRepository pitRepository;
    private final DeviceRepository deviceRepository;
    private final ProductionBatchRepository batchRepository;
    
    @Value("${app.total-pits:100}")
    private int totalPits;
    
    @Value("${app.total-devices:50}")
    private int totalDevices;
    
    private final Random random = new Random();
    
    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        try {
            long count = pitRepository.count();
            if (count == 0) {
                log.info("初始化演示数据...");
                initPits();
                initDevices();
                initBatches();
                log.info("演示数据初始化完成: {} 窖池, {} 设备", totalPits, totalDevices);
            } else {
                log.info("数据库已有数据 ({} 窖池)，跳过初始化", count);
            }
        } catch (Exception e) {
            log.error("数据初始化失败: {}", e.getMessage(), e);
        }
    }
    
    private void initPits() {
        // 100 pits: 4 zones (A/B/C/D) x 5 rows x 5 cols
        // Real factory pit distribution: ~65% fermenting, ~25% ready, ~5% filling, ~3% discharging, ~2% empty
        // Five-grain blend (Wuliangye nongxiang typical recipe):
        //  - sorghum (gaoliang) 58% - main ingredient, high yield + aroma
        //  - corn 17%    - body / richness
        //  - sticky_rice 8% - sweetness
        //  - wheat 8%    - koji base
        //  - rice 8%     - clarity
        // ASCII keys are used because grapeType is consumed by analytics, not displayed directly.
        String[] zones = {"A", "B", "C", "D"};
        String[] grainTypes = {
                "sorghum", "sorghum", "sorghum", "sorghum", "sorghum", "sorghum", "sorghum",
                "corn", "corn", "sticky_rice", "wheat", "rice"
        };

        int pitIndex = 1;
        for (String zone : zones) {
            for (int row = 1; row <= 5; row++) {
                for (int col = 1; col <= 5; col++) {
                    if (pitIndex > totalPits) return;

                    Pit pit = new Pit();
                    pit.setPitNo(String.format("%s-%03d", zone, pitIndex));
                    pit.setZone(zone);
                    pit.setRow(row);
                    pit.setCol(col);
                    // 窖龄：以正态分布集中在 30-50 年（老窖出好酒）
                    int age = (int) Math.max(15, Math.min(80, 45 + random.nextGaussian() * 12));
                    pit.setPitAge(age);
                    pit.setGrapeType(grainTypes[random.nextInt(grainTypes.length)]);

                    // 真实工厂: 区域分工 (符合 AGV 分配)
                    //   A 区: 起糟区 - 60% ready / 30% fermenting (晚期) / 8% discharging / 2% other
                    //   C 区: 起糟区 - 同 A
                    //   B 区: 入池区 - 30% filling / 50% fermenting (早中期) / 10% empty / 10% ready
                    //   D 区: 入池区 - 同 B
                    double r = random.nextDouble();
                    int day;
                    boolean isDischargeZone = "A".equals(zone) || "C".equals(zone);
                    if (isDischargeZone) {
                        // 起糟区：大量 ready/晚期发酵, 配合 AGV-01/06 取糟
                        if (r < 0.60) {
                            pit.setStage("ready");
                            day = 60;
                            pit.setGrainAmount(5000.0);
                            pit.setEntryTemperature(20.0);
                            pit.setFermentationPhase("late");
                        } else if (r < 0.90) {
                            // 后期发酵 (40-60 天), 即将变 ready
                            pit.setStage("fermenting");
                            day = 40 + (int) ((r - 0.60) / 0.30 * 19);
                            pit.setGrainAmount(5000.0);
                            pit.setEntryTemperature(18.0 + random.nextDouble() * 6);
                            pit.setFermentationPhase("late");
                        } else if (r < 0.98) {
                            pit.setStage("discharging");
                            day = 60;
                            pit.setGrainAmount(2500.0 + random.nextDouble() * 2000);
                            pit.setEntryTemperature(20.0);
                            pit.setFermentationPhase("late");
                        } else {
                            pit.setStage("empty");
                            day = 0;
                            pit.setGrainAmount(0.0);
                            pit.setFermentationPhase("early");
                        }
                    } else {
                        // 入池区 (B/D)：大量 filling/早期发酵, 配合 AGV-05/08 入池
                        if (r < 0.30) {
                            pit.setStage("filling");
                            day = 0;
                            pit.setGrainAmount(1500.0 + random.nextDouble() * 3000);
                            pit.setEntryTemperature(20.0 + random.nextDouble() * 4);
                            pit.setFermentationPhase("early");
                        } else if (r < 0.80) {
                            // 早中期发酵 (0-40 天)
                            pit.setStage("fermenting");
                            day = 1 + (int) ((r - 0.30) / 0.50 * 39);
                            pit.setGrainAmount(5000.0);
                            pit.setEntryTemperature(18.0 + random.nextDouble() * 6);
                            pit.setFermentationPhase(day <= 25 ? "early" : "middle");
                        } else if (r < 0.90) {
                            pit.setStage("empty");
                            day = 0;
                            pit.setGrainAmount(0.0);
                            pit.setFermentationPhase("early");
                        } else {
                            // 少量 ready, 后期发酵转 ready 状态
                            pit.setStage("ready");
                            day = 60;
                            pit.setGrainAmount(5000.0);
                            pit.setEntryTemperature(20.0);
                            pit.setFermentationPhase("late");
                        }
                    }
                    pit.setFermentationDay(day);
                    pit.setStatus("normal");

                    // 糟醅类型 (PPT 工艺典型分布)：楂醅 70% / 红糟 25% / 丢糟 5%
                    double g = random.nextDouble();
                    pit.setGrainCategory(g < 0.70 ? "zhapei" : g < 0.95 ? "hongzao" : "diuzao");

                    // 入窖工艺参数 (PPT 工艺要求)
                    pit.setEntryMoisture(51.0 + random.nextDouble() * 4);     // 51-55%
                    pit.setEntryAcidity(1.4 + random.nextDouble() * 0.6);     // 1.4-2.0 mmol/10g (收紧)
                    pit.setEntryStarch(18.0 + random.nextDouble() * 4);       // 18-22%
                    pit.setGrainHullRatio(22.0 + random.nextDouble() * 5);    // 22-27%
                    pit.setGrainKojiRatio(20.0 + random.nextDouble() * 5);    // 20-25%
                    pit.setGrainMashRatio(4.0 + random.nextDouble() * 0.5);   // 1:4 ~ 1:4.5

                    pitRepository.save(pit);
                    pitIndex++;
                }
            }
        }
    }
    
    private void initDevices() {
        // 1) 5 台核心生产线设备 - 与 ProcessSimulationService 内部工位一一对应
        saveCoreDevice("MX-001", "搅拌机", "motor", "配料区");
        saveCoreDevice("RB-001", "上甑机器人", "robot", "上甑区");
        saveCoreDevice("DL-001", "蒸馏塔", "distiller", "馏酒区");
        saveCoreDevice("CL-001", "摊凉机", "conveyor", "摊凉区");
        saveCoreDevice("PM-001", "输送泵", "pump", "水循环区");

        // 2) AGV 8 台 (与 ProcessSimulationService 内存中 AGV-01..AGV-08 一一对应)
        for (int i = 1; i <= 8; i++) {
            saveCoreDevice(String.format("AGV-%02d", i), "AGV-" + i, "agv",
                    "通道-" + i);
        }

        // 3) 余量补足成 totalDevices - 辅助监测设备
        String[] auxTypes = {"pump", "motor", "sensor", "robot", "conveyor"};
        String[] auxNames = {"循环泵", "减速电机", "PH传感器", "装料机器人", "链板输送带"};
        String[] zones = {"A区", "B区", "C区", "D区", "中控室"};
        int already = 5 + 8;
        for (int i = 1; i <= Math.max(0, totalDevices - already); i++) {
            int t = random.nextInt(auxTypes.length);
            Device d = new Device();
            d.setDeviceNo(String.format("%s-%03d", auxTypes[t].substring(0, 1).toUpperCase(), 100 + i));
            d.setName(auxNames[t] + "-" + i);
            d.setType(auxTypes[t]);
            d.setLocation(zones[random.nextInt(zones.length)]);
            d.setStatus("running");
            d.setRunningHours((double) random.nextInt(10000));
            deviceRepository.save(d);
        }
    }

    private void saveCoreDevice(String no, String name, String type, String location) {
        Device d = new Device();
        d.setDeviceNo(no);
        d.setName(name);
        d.setType(type);
        d.setLocation(location);
        d.setStatus("running");
        d.setRunningHours((double) random.nextInt(8000));
        deviceRepository.save(d);
    }
    
    private void initBatches() {
        // 创建 3 个已完成的历史批次，便于 Dashboard 累计产量起始非零
        for (int i = 1; i <= 3; i++) {
            ProductionBatch batch = new ProductionBatch();
            batch.setBatchNo(String.format("BATCH-%s-H%03d",
                    LocalDateTime.now().getYear(), i));
            batch.setProductType("浓香型白酒");
            batch.setTargetVolume(500.0);
            batch.setActualVolume(450.0 + random.nextDouble() * 80);
            batch.setQualityScore(85.0 + random.nextDouble() * 12);
            batch.setStatus("completed");
            batch.setStartDate(LocalDateTime.now().minusDays(7L * i));
            batch.setEndDate(LocalDateTime.now().minusDays(7L * (i - 1)));
            batchRepository.save(batch);
        }
    }
}
