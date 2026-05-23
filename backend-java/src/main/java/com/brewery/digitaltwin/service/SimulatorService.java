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
    private final DashboardService dashboardService;
    
    @Value("${app.simulator.enabled:true}")
    private boolean enabled;
    
    private final Random random = new Random();
    
    @Scheduled(fixedRateString = "${app.simulator.interval:5000}")
    @Transactional
    public void generateData() {
        if (!enabled) return;
        
        try {
            generatePitSensorData();
            generateDeviceData();
            maybeGenerateAlarm();
            broadcastDashboardUpdate();
        } catch (Exception e) {
            log.error("数据生成失败", e);
        }
    }

    @Scheduled(fixedDelayString = "${app.simulator.cleanup-interval:3600000}")
    @Transactional
    public void cleanupOldData() {
        if (!enabled) return;
        LocalDateTime cutoff = LocalDateTime.now().minusHours(24);
        pitSensorDataRepository.deleteByRecordedAtBefore(cutoff);
        deviceDataRepository.deleteByRecordedAtBefore(cutoff);
    }
    
    private void generatePitSensorData() {
        List<Pit> pits = pitRepository.findAll();
        List<Map<String, Object>> dataList = new ArrayList<>();
        
        for (Pit pit : pits) {
            PitSensorData data = new PitSensorData();
            data.setPitId(pit.getId());
            
            // 根据发酵天数生成温度曲线
            double baseTemp = 25 + Math.sin(pit.getFermentationDay() * 0.1) * 10;
            data.setTemperature(baseTemp + (random.nextDouble() - 0.5) * 4);
            data.setHumidity(65 + (random.nextDouble() - 0.5) * 20);
            data.setPhValue(3.5 + (random.nextDouble() - 0.5) * 1);
            data.setAcidity(0.5 + random.nextDouble() * 0.5);
            data.setMoisture(55 + (random.nextDouble() - 0.5) * 10);
            data.setAlcohol(random.nextDouble() * 15);
            
            pitSensorDataRepository.save(data);
            
            // 更新窖池状态
            String newStatus = "normal";
            if (data.getTemperature() > 40) {
                newStatus = "alarm";
            } else if (data.getTemperature() > 35) {
                newStatus = "warning";
            }
            
            if (!pit.getStatus().equals(newStatus)) {
                pit.setStatus(newStatus);
                pit.setUpdatedAt(LocalDateTime.now());
                pitRepository.save(pit);
            }
            
            // 更新热力图缓存
            com.brewery.digitaltwin.dto.HeatmapData hd = new com.brewery.digitaltwin.dto.HeatmapData();
            hd.setPitId(pit.getId());
            hd.setPitNo(pit.getPitNo());
            hd.setZone(pit.getZone());
            hd.setRow(pit.getRow());
            hd.setCol(pit.getCol());
            hd.setStatus(newStatus);
            hd.setTemperature(data.getTemperature());
            hd.setHumidity(data.getHumidity());
            hd.setPhValue(data.getPhValue());
            dashboardService.updateHeatmapCache(pit.getId(), hd);
            
            // 构建WebSocket消息
            Map<String, Object> dataMap = new HashMap<>();
            dataMap.put("pitId", pit.getId());
            dataMap.put("pitNo", pit.getPitNo());
            dataMap.put("temperature", data.getTemperature());
            dataMap.put("humidity", data.getHumidity());
            dataMap.put("phValue", data.getPhValue());
            dataMap.put("status", newStatus);
            dataList.add(dataMap);
        }
        
        // 广播WebSocket消息
        try {
            RealtimeMessage msg = new RealtimeMessage("pit_data", dataList);
            webSocketHandler.broadcast(objectMapper.writeValueAsString(msg));
        } catch (Exception e) {
            log.error("WebSocket广播失败", e);
        }
    }
    
    private void generateDeviceData() {
        List<Device> devices = deviceRepository.findAll();
        List<Map<String, Object>> dataList = new ArrayList<>();
        
        for (Device device : devices) {
            // 维护中(maintenance)/停机(stopped) 不生成数据
            if ("maintenance".equals(device.getStatus()) || "stopped".equals(device.getStatus())) continue;

            DeviceData data = new DeviceData();
            data.setDeviceId(device.getId());
            data.setPower(10 + random.nextDouble() * 50);
            data.setSpeed(1000 + random.nextDouble() * 2000);
            // vibration ∈ [0, 10) 才能覆盖告警阈值（原 [0,5) 永远触发不了 fault/warning）
            data.setVibration(random.nextDouble() * 10);
            // temperature ∈ [40, 80) 维持运行区间为主, 偶发越界进入 warning/fault
            data.setTemperature(40 + random.nextDouble() * 40);
            data.setCurrent(5 + random.nextDouble() * 20);
            
            deviceDataRepository.save(data);
            
            // 重新评估设备状态：基于当前样本，使状态可双向恢复
            String newStatus;
            if (data.getVibration() > 8 || data.getTemperature() > 75) {
                newStatus = "fault";
            } else if (data.getVibration() > 6 || data.getTemperature() > 65) {
                newStatus = "warning";
            } else {
                newStatus = "running";
            }
            
            if (!newStatus.equals(device.getStatus())) {
                device.setStatus(newStatus);
                device.setUpdatedAt(LocalDateTime.now());
            }
            
            device.setRunningHours(device.getRunningHours() + 0.0014); // ~5秒
            deviceRepository.save(device);
            
            Map<String, Object> dataMap = new HashMap<>();
            dataMap.put("deviceId", device.getId());
            dataMap.put("deviceNo", device.getDeviceNo());
            dataMap.put("power", data.getPower());
            dataMap.put("temperature", data.getTemperature());
            dataMap.put("vibration", data.getVibration());
            dataMap.put("status", newStatus);
            dataList.add(dataMap);
        }
        
        try {
            RealtimeMessage msg = new RealtimeMessage("device_data", dataList);
            webSocketHandler.broadcast(objectMapper.writeValueAsString(msg));
        } catch (Exception e) {
            log.error("WebSocket广播失败", e);
        }
    }
    
    private void maybeGenerateAlarm() {
        // 5%概率生成告警
        if (random.nextDouble() > 0.05) return;
        
        String[] levels = {"info", "warning", "error", "critical"};
        String[] types = {"temperature", "humidity", "ph", "device", "system"};
        String[] messages = {
            "温度超过上限阈值",
            "湿度异常波动",
            "pH值偏离正常范围",
            "设备振动过大",
            "系统通信延迟"
        };
        
        int idx = random.nextInt(types.length);
        Alarm alarm = new Alarm();
        alarm.setLevel(levels[random.nextInt(levels.length)]);
        alarm.setType(types[idx]);
        // 根据告警类型从真实数据中选择来源，避免硬编码不存在的窖池号
        alarm.setSource(pickAlarmSource(types[idx]));
        alarm.setMessage(messages[idx]);
        alarm.setStatus("active");
        
        alarmRepository.save(alarm);
        
        try {
            RealtimeMessage msg = new RealtimeMessage("alarm", alarm);
            webSocketHandler.broadcast(objectMapper.writeValueAsString(msg));
            RealtimeMessage update = new RealtimeMessage("alarm_update", alarm);
            webSocketHandler.broadcast(objectMapper.writeValueAsString(update));
        } catch (Exception e) {
            log.error("告警广播失败", e);
        }
    }

    /**
     * 根据告警类型从真实窖池/设备中挑选来源，避免硬编码无效编号
     */
    private String pickAlarmSource(String alarmType) {
        boolean preferDevice = "device".equals(alarmType) || "system".equals(alarmType);
        if (preferDevice) {
            List<Device> devices = deviceRepository.findAll();
            if (!devices.isEmpty()) {
                return "device-" + devices.get(random.nextInt(devices.size())).getDeviceNo();
            }
        }
        List<Pit> pits = pitRepository.findAll();
        if (!pits.isEmpty()) {
            return "pit-" + pits.get(random.nextInt(pits.size())).getPitNo();
        }
        // 数据库尚无数据时的兜底
        return preferDevice ? "device-unknown" : "pit-unknown";
    }

    private void broadcastDashboardUpdate() {
        try {
            var stats = dashboardService.getStats();
            Map<String, Object> data = new HashMap<>();
            Map<String, Object> temperature = new HashMap<>();
            temperature.put("average", stats.getAvgTemperature());
            Map<String, Object> alarms = new HashMap<>();
            alarms.put("active", stats.getActiveAlarms());
            data.put("temperature", temperature);
            data.put("alarms", alarms);
            RealtimeMessage msg = new RealtimeMessage("dashboard_update", data);
            webSocketHandler.broadcast(objectMapper.writeValueAsString(msg));
        } catch (Exception e) {
            log.error("仪表盘数据广播失败", e);
        }
    }
}
