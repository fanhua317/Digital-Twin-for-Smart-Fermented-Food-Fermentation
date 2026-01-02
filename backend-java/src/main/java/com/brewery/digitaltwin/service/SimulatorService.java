package com.brewery.digitaltwin.service;

import com.brewery.digitaltwin.entity.*;
import com.brewery.digitaltwin.repository.*;
import com.brewery.digitaltwin.websocket.RealtimeWebSocketHandler;
import com.brewery.digitaltwin.dto.RealtimeMessage;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

/**
 * 数据模拟器服务 - 生成演示数据
 * 采用随机游走算法生成平滑的仿真曲线，并实时推送到前端
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SimulatorService {

    private final PitRepository pitRepository;
    private final PitSensorDataRepository pitSensorDataRepository;
    private final DeviceRepository deviceRepository;
    private final DeviceDataRepository deviceDataRepository;
    private final AlarmRepository alarmRepository;
    private final RealtimeWebSocketHandler webSocketHandler;
    private final ObjectMapper objectMapper;

    @Value("${app.simulator.enabled:true}")
    private boolean enabled;

    private final Random random = new Random();

    // 定时任务：每隔一段时间（默认5秒）执行一次数据模拟
    @Scheduled(fixedRateString = "${app.simulator.interval:5000}")
    @Transactional
    public void simulateRealtimeData() {
        if (!enabled) return;

        LocalDateTime now = LocalDateTime.now();

        try {
            simulatePitData(now);
            simulateDeviceData(now);
            maybeGenerateAlarm();
        } catch (Exception e) {
            log.error("数据生成失败", e);
        }
    }

    /**
     * 1. 模拟窖池环境数据（平滑曲线 + WebSocket推送）
     */
    private void simulatePitData(LocalDateTime now) {
        List<Pit> pits = pitRepository.findAll();
        List<Map<String, Object>> dataList = new ArrayList<>();

        for (Pit pit : pits) {
            // 获取上一条数据作为基准，实现曲线连续性
            PitSensorData lastData = pitSensorDataRepository
                    .findTopByPitIdOrderByRecordedAtDesc(pit.getId())
                    .orElse(null);

            PitSensorData newData = new PitSensorData();
            newData.setPitId(pit.getId());
            newData.setRecordedAt(now);

            if (lastData != null) {
                // 基于上次数据微调（随机游走算法）
                double tempChange = (random.nextDouble() - 0.5); // -0.5 ~ 0.5
                newData.setTemperature(limit(lastData.getTemperature() + tempChange, 15.0, 45.0));

                double humChange = (random.nextDouble() - 0.5) * 2.0;
                newData.setHumidity(limit(lastData.getHumidity() + humChange, 40.0, 95.0));

                double phChange = (random.nextDouble() - 0.5) * 0.1;
                newData.setPhValue(limit(lastData.getPhValue() + phChange, 3.0, 6.0));

                // 其他指标也加入微小波动
                newData.setAcidity(limit(lastData.getAcidity() + (random.nextDouble()-0.5)*0.05, 0.2, 2.0));
                newData.setMoisture(limit(lastData.getMoisture() + (random.nextDouble()-0.5), 40.0, 70.0));
                newData.setAlcohol(limit(lastData.getAlcohol() + (random.nextDouble()-0.5)*0.2, 0.0, 20.0));
            } else {
                // 如果没有历史数据，给一个初始值
                newData.setTemperature(25.0);
                newData.setHumidity(70.0);
                newData.setPhValue(4.5);
                newData.setAcidity(1.0);
                newData.setMoisture(55.0);
                newData.setAlcohol(5.0);
            }

            pitSensorDataRepository.save(newData);

            // --- 状态判断逻辑 ---
            String newStatus = "normal";
            if (newData.getTemperature() > 40) {
                newStatus = "alarm";
            } else if (newData.getTemperature() > 35) {
                newStatus = "warning";
            }

            if (!pit.getStatus().equals(newStatus)) {
                pit.setStatus(newStatus);
                pit.setUpdatedAt(now);
                pitRepository.save(pit);
            }

            // --- 构建 WebSocket 消息 ---
            Map<String, Object> dataMap = new HashMap<>();
            dataMap.put("pitId", pit.getId());
            dataMap.put("pitNo", pit.getPitNo());
            dataMap.put("temperature", newData.getTemperature());
            dataMap.put("humidity", newData.getHumidity());
            dataMap.put("phValue", newData.getPhValue());
            dataMap.put("status", newStatus);
            dataList.add(dataMap);
        }

        // 广播窖池数据
        broadcast("pit_data", dataList);
    }

    /**
     * 2. 模拟设备运行数据（平滑曲线 + 状态联动）
     */
    private void simulateDeviceData(LocalDateTime now) {
        List<Device> devices = deviceRepository.findAll();
        List<Map<String, Object>> dataList = new ArrayList<>();

        for (Device device : devices) {
            // 只有运行中的设备才产生数据
            if (!"running".equals(device.getStatus()) && !"warning".equals(device.getStatus())) {
                continue;
            }

            DeviceData lastData = deviceDataRepository
                    .findTopByDeviceIdOrderByRecordedAtDesc(device.getId())
                    .orElse(null);

            DeviceData newData = new DeviceData();
            newData.setDeviceId(device.getId());
            newData.setRecordedAt(now);

            if (lastData != null) {
                // 功率和电流小幅波动
                newData.setPower(limit(lastData.getPower() + (random.nextDouble()-0.5)*0.5, 0.0, 100.0));
                newData.setCurrent(limit(lastData.getCurrent() + (random.nextDouble()-0.5)*0.2, 0.0, 50.0));

                // 温度上升趋势：如果是告警状态，温度更容易升高
                double tempChange = (random.nextDouble() - 0.4); // 略微倾向于升温
                newData.setTemperature(limit(lastData.getTemperature() + tempChange, 20.0, 100.0));

                // 振动
                double vibBase = "warning".equals(device.getStatus()) ? 0.2 : 0.0; // 异常状态下振动波动更大
                newData.setVibration(limit(lastData.getVibration() + (random.nextDouble()-0.5 + vibBase), 0.0, 10.0));

                // 转速
                newData.setSpeed(limit(lastData.getSpeed() + (random.nextDouble()-0.5)*10, 0.0, 3000.0));
            } else {
                newData.setPower(15.0);
                newData.setCurrent(5.0);
                newData.setTemperature(45.0);
                newData.setVibration(1.0);
                newData.setSpeed(1400.0);
            }

            deviceDataRepository.save(newData);

            // --- 设备状态更新 ---
            String newStatus = device.getStatus();
            // 简单的故障模拟逻辑
            if (newData.getVibration() > 8 || newData.getTemperature() > 80) {
                newStatus = "fault"; // 故障自动停机逻辑可在此处扩展
            } else if (newData.getVibration() > 5 || newData.getTemperature() > 65) {
                newStatus = "warning";
            } else {
                newStatus = "running";
            }

            if (!device.getStatus().equals(newStatus)) {
                device.setStatus(newStatus);
                device.setUpdatedAt(now);
                deviceRepository.save(device);
            }

            // 增加运行时间
            device.setRunningHours(device.getRunningHours() + 0.0014); // ~5秒

            // --- 构建 WebSocket 消息 ---
            Map<String, Object> dataMap = new HashMap<>();
            dataMap.put("deviceId", device.getId());
            dataMap.put("deviceNo", device.getDeviceNo());
            dataMap.put("power", newData.getPower());
            dataMap.put("temperature", newData.getTemperature());
            dataMap.put("vibration", newData.getVibration());
            dataMap.put("status", newStatus);
            dataList.add(dataMap);
        }

        // 广播设备数据
        broadcast("device_data", dataList);
    }

    /**
     * 3. 随机告警生成
     */
    private void maybeGenerateAlarm() {
        // 5%概率生成告警，保持原逻辑
        if (random.nextDouble() > 0.05) return;

        String[] levels = {"info", "warning", "error", "critical"};
        String[] types = {"temperature", "humidity", "ph", "device", "system"};
        String[] messages = {
                "温度超过上限阈值", "湿度异常波动", "pH值偏离正常范围", "设备振动过大", "系统通信延迟"
        };

        int idx = random.nextInt(types.length);
        Alarm alarm = new Alarm();
        alarm.setLevel(levels[random.nextInt(levels.length)]);
        alarm.setType(types[idx]);
        alarm.setSource("pit-A-" + (random.nextInt(20) + 1));
        alarm.setMessage(messages[idx]);
        alarm.setStatus("active");

        alarmRepository.save(alarm);

        try {
            RealtimeMessage msg = new RealtimeMessage("alarm", alarm);
            webSocketHandler.broadcast(objectMapper.writeValueAsString(msg));
        } catch (Exception e) {
            log.error("告警广播失败", e);
        }
    }

    // 辅助方法：发送WebSocket消息
    private void broadcast(String type, Object data) {
        try {
            RealtimeMessage msg = new RealtimeMessage(type, data);
            webSocketHandler.broadcast(objectMapper.writeValueAsString(msg));
        } catch (Exception e) {
            log.error("WebSocket广播失败: {}", type, e);
        }
    }

    // 辅助方法：限制数值范围
    private double limit(double value, double min, double max) {
        if (value < min) return min;
        if (value > max) return max;
        return Math.round(value * 100.0) / 100.0; // 保留两位小数
    }
}