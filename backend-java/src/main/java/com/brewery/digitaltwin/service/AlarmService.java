package com.brewery.digitaltwin.service;

import com.brewery.digitaltwin.entity.Alarm;
import com.brewery.digitaltwin.repository.AlarmRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class AlarmService {
    
    private final AlarmRepository alarmRepository;
    
    public List<Alarm> getActiveAlarms() {
        return alarmRepository.findByStatus("active");
    }
    
    public List<Alarm> getRecentAlarms() {
        return alarmRepository.findTop20ByOrderByCreatedAtDesc();
    }

    public List<Alarm> getAlarmsByLevelAndStatus(String level, String status) {
        return alarmRepository.findByLevelAndStatus(level, status);
    }
    
    public Page<Alarm> getAlarmsByStatus(String status, int page, int size) {
        return alarmRepository.findByStatusOrderByCreatedAtDesc(status, PageRequest.of(page, size));
    }
    
    public Optional<Alarm> getAlarmById(Long id) {
        return alarmRepository.findById(id);
    }

    public Map<String, Object> getStats() {
        Map<String, Object> stats = new HashMap<>();
        long active = alarmRepository.countByStatus("active");
        long total = alarmRepository.count();
        long today = alarmRepository.findByCreatedAtAfter(LocalDateTime.now()
                .with(LocalTime.MIN)).size();
        Map<String, Long> byLevel = new HashMap<>();
        alarmRepository.countActiveByLevel().forEach(row ->
            byLevel.put((String) row[0], (Long) row[1])
        );
        stats.put("active", active);
        stats.put("total", total);
        stats.put("today", today);
        stats.put("by_level", byLevel);
        return stats;
    }
    
    @Transactional
    public Alarm createAlarm(Alarm alarm) {
        return alarmRepository.save(alarm);
    }
    
    @Transactional
    public Optional<Alarm> acknowledgeAlarm(Long id) {
        return alarmRepository.findById(id).map(alarm -> {
            alarm.setStatus("acknowledged");
            return alarmRepository.save(alarm);
        });
    }
    
    @Transactional
    public Optional<Alarm> resolveAlarm(Long id, String resolvedBy) {
        return alarmRepository.findById(id).map(alarm -> {
            alarm.setStatus("resolved");
            alarm.setResolvedBy(resolvedBy);
            alarm.setResolvedAt(LocalDateTime.now());
            return alarmRepository.save(alarm);
        });
    }
    
    @Transactional
    public int batchResolve(List<Long> ids, String resolvedBy) {
        int count = 0;
        for (Long id : ids) {
            if (resolveAlarm(id, resolvedBy).isPresent()) {
                count++;
            }
        }
        return count;
    }
}
