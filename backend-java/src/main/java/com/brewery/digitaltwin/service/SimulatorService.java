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
        } catch (Exception e) {
            log.error("数据生成失败", e);
        }
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
            if (!"running".equals(device.getStatus())) continue;
            
            DeviceData data = new DeviceData();
            data.setDeviceId(device.getId());
            data.setPower(10 + random.nextDouble() * 50);
            data.setSpeed(1000 + random.nextDouble() * 2000);
            data.setVibration(random.nextDouble() * 5);
            data.setTemperature(40 + random.nextDouble() * 30);
            data.setCurrent(5 + random.nextDouble() * 20);
            
            deviceDataRepository.save(data);
            
            // 更新设备状态
            String newStatus = device.getStatus();
            if (data.getVibration() > 8 || data.getTemperature() > 80) {
                newStatus = "fault";
            } else if (data.getVibration() > 5 || data.getTemperature() > 65) {
                newStatus = "warning";
            } else {
                newStatus = "running";
            }
            
            if (!device.getStatus().equals(newStatus)) {
                device.setStatus(newStatus);
                device.setUpdatedAt(LocalDateTime.now());
                deviceRepository.save(device);
            }
            
            device.setRunningHours(device.getRunningHours() + 0.0014); // ~5秒
            
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
}
