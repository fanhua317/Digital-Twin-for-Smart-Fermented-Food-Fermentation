package com.brewery.digitaltwin.service;

import com.brewery.digitaltwin.entity.Alarm;
import com.brewery.digitaltwin.repository.AlarmRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
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
    
    public Page<Alarm> getAlarmsByStatus(String status, int page, int size) {
        return alarmRepository.findByStatusOrderByCreatedAtDesc(status, PageRequest.of(page, size));
    }
    
    public Optional<Alarm> getAlarmById(Long id) {
        return alarmRepository.findById(id);
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
