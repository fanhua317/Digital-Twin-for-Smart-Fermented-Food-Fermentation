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
        
        // 平均温湿度和功率
        List<PitSensorData> latestData = pitSensorDataRepository.findLatestForAllPitsFast();
        if (!latestData.isEmpty()) {
            stats.setAvgTemperature(latestData.stream()
                .mapToDouble(d -> d.getTemperature() != null ? d.getTemperature() : 0)
                .average().orElse(0));
            stats.setAvgHumidity(latestData.stream()
                .mapToDouble(d -> d.getHumidity() != null ? d.getHumidity() : 0)
                .average().orElse(0));
        }
        
        Double totalPower = deviceDataRepository.sumPowerSince(LocalDateTime.now().minusHours(1));
        stats.setTotalPower(totalPower != null ? totalPower : 0.0);
        
        return stats;
    }
    
    public List<HeatmapData> getHeatmap() {
        List<Pit> pits = pitRepository.findAll();
        List<PitSensorData> latestData = pitSensorDataRepository.findLatestForAllPitsFast();
        
        Map<Long, PitSensorData> dataMap = latestData.stream()
            .collect(Collectors.toMap(PitSensorData::getPitId, d -> d, (a, b) -> a));
        
        return pits.stream().map(pit -> {
            HeatmapData hd = new HeatmapData();
            hd.setPitId(pit.getId());
            hd.setPitNo(pit.getPitNo());
            hd.setZone(pit.getZone());
            hd.setRow(pit.getRow());
            hd.setCol(pit.getCol());
            hd.setStatus(pit.getStatus());
            
            PitSensorData data = dataMap.get(pit.getId());
            if (data != null) {
                hd.setTemperature(data.getTemperature());
                hd.setHumidity(data.getHumidity());
                hd.setPhValue(data.getPhValue());
            }
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
