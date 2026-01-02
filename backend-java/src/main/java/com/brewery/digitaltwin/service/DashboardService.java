package com.brewery.digitaltwin.service;

import com.brewery.digitaltwin.dto.DashboardStats;
import com.brewery.digitaltwin.dto.HeatmapData;
import com.brewery.digitaltwin.entity.Pit;
import com.brewery.digitaltwin.entity.PitSensorData;
import com.brewery.digitaltwin.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DashboardService {
    
    private final PitRepository pitRepository;
    private final PitSensorDataRepository pitSensorDataRepository;
    private final DeviceRepository deviceRepository;
    private final DeviceDataRepository deviceDataRepository;
    private final AlarmRepository alarmRepository;
    private final ProductionBatchRepository batchRepository;
    
    // 热力图缓存 - 由SimulatorService更新
    private final Map<Long, HeatmapData> heatmapCache = new ConcurrentHashMap<>();
    private volatile long lastHeatmapUpdate = 0;
    
    public void updateHeatmapCache(Long pitId, HeatmapData data) {
        heatmapCache.put(pitId, data);
        lastHeatmapUpdate = System.currentTimeMillis();
    }
    
    public DashboardStats getStats() {
        DashboardStats stats = new DashboardStats();
        
        // 窖池统计
        stats.setTotalPits(pitRepository.count());
        stats.setNormalPits(pitRepository.countByStatus("normal"));
        stats.setWarningPits(pitRepository.countByStatus("warning"));
        stats.setAlarmPits(pitRepository.countByStatus("alarm"));
        
        // 设备统计
        stats.setTotalDevices(deviceRepository.count());
        stats.setRunningDevices(deviceRepository.countByStatus("running"));
        stats.setFaultDevices(deviceRepository.countByStatus("fault"));
        
        // 告警统计
        stats.setActiveAlarms(alarmRepository.countByStatus("active"));
        Map<String, Long> alarmsByLevel = new HashMap<>();
        alarmRepository.countActiveByLevel().forEach(row -> 
            alarmsByLevel.put((String) row[0], (Long) row[1])
        );
        stats.setAlarmsByLevel(alarmsByLevel);
        
        // 生产统计
        stats.setInProgressBatches(batchRepository.countByStatus("in_progress"));
        stats.setTotalProduction(Optional.ofNullable(batchRepository.sumCompletedVolume()).orElse(0.0));
        
        // 平均温湿度 - 使用热力图缓存，避免慢查询
        if (!heatmapCache.isEmpty()) {
            stats.setAvgTemperature(heatmapCache.values().stream()
                .mapToDouble(d -> d.getTemperature() != null ? d.getTemperature() : 0)
                .average().orElse(25.0));
            stats.setAvgHumidity(heatmapCache.values().stream()
                .mapToDouble(d -> d.getHumidity() != null ? d.getHumidity() : 0)
                .average().orElse(65.0));
        } else {
            stats.setAvgTemperature(25.0);
            stats.setAvgHumidity(65.0);
        }
        
        // 总功率 - 使用简化查询
        stats.setTotalPower(0.0); // 先用默认值，实际功率由设备数据实时更新
        
        return stats;
    }
    
    public List<HeatmapData> getHeatmap() {
        // 优先使用缓存（由SimulatorService实时更新）
        if (!heatmapCache.isEmpty()) {
            return new ArrayList<>(heatmapCache.values());
        }
        
        // 首次加载或缓存为空时从数据库查询
        List<Pit> pits = pitRepository.findAll();
        return pits.stream().map(pit -> {
            HeatmapData hd = new HeatmapData();
            hd.setPitId(pit.getId());
            hd.setPitNo(pit.getPitNo());
            hd.setZone(pit.getZone());
            hd.setRow(pit.getRow());
            hd.setCol(pit.getCol());
            hd.setStatus(pit.getStatus());
            // 首次加载不查传感器数据，等SimulatorService更新
            hd.setTemperature(25.0 + Math.random() * 10);
            hd.setHumidity(65.0 + Math.random() * 10);
            hd.setPhValue(3.5 + Math.random() * 0.5);
            heatmapCache.put(pit.getId(), hd);
            return hd;
        }).collect(Collectors.toList());
    }

    public Map<String, Object> getOverview() {
        Map<String, Object> overview = new HashMap<>();
        overview.put("alarm_trend", buildAlarmTrend());
        overview.put("production_progress", buildProductionProgress());
        return overview;
    }

    private List<Map<String, Object>> buildAlarmTrend() {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime start = now.minusHours(24);
        List<Map<String, Object>> trend = new ArrayList<>();

        Map<Long, Long> bucketCounts = new HashMap<>();
        alarmRepository.findByCreatedAtAfter(start).forEach(alarm -> {
            long bucket = ChronoUnit.HOURS.between(start, alarm.getCreatedAt());
            if (bucket >= 0 && bucket < 24) {
                bucketCounts.put(bucket, bucketCounts.getOrDefault(bucket, 0L) + 1);
            }
        });

        for (int i = 0; i < 24; i++) {
            LocalDateTime hour = start.plusHours(i);
            Map<String, Object> point = new HashMap<>();
            point.put("hour", hour.getHour() + ":00");
            point.put("count", bucketCounts.getOrDefault((long) i, 0L));
            trend.add(point);
        }
        return trend;
    }

    private List<Map<String, Object>> buildProductionProgress() {
        LocalDateTime now = LocalDateTime.now();
        return batchRepository.findByStatus("in_progress").stream().map(batch -> {
            Map<String, Object> item = new HashMap<>();
            item.put("batch_code", batch.getBatchNo());
            item.put("grain_type", batch.getProductType());
            double progress = 0.0;
            if (batch.getStartDate() != null) {
                long hours = ChronoUnit.HOURS.between(batch.getStartDate(), now);
                progress = Math.min(100.0, hours / (24.0 * 7.0) * 100.0);
            }
            item.put("progress", Math.round(progress));
            return item;
        }).collect(Collectors.toList());
    }
}
