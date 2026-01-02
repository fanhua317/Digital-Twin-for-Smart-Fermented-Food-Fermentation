package com.brewery.digitaltwin.controller;

import com.brewery.digitaltwin.dto.ApiResponse;
import com.brewery.digitaltwin.entity.Alarm;
import com.brewery.digitaltwin.service.AlarmService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/alarms")
@RequiredArgsConstructor
public class AlarmController {
    
    private final AlarmService alarmService;
    
    @GetMapping
    public ApiResponse<List<Alarm>> getAlarms(
            @RequestParam(defaultValue = "active") String status) {
        if ("active".equals(status)) {
            return ApiResponse.success(alarmService.getActiveAlarms());
        }
        return ApiResponse.success(alarmService.getRecentAlarms());
    }
    
    @GetMapping("/recent")
    public ApiResponse<List<Alarm>> getRecentAlarms() {
        return ApiResponse.success(alarmService.getRecentAlarms());
    }
    
    @GetMapping("/page")
    public ApiResponse<Page<Alarm>> getAlarmsPage(
            @RequestParam(defaultValue = "active") String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.success(alarmService.getAlarmsByStatus(status, page, size));
    }
    
    @GetMapping("/{id}")
    public ApiResponse<Alarm> getAlarmById(@PathVariable Long id) {
        return alarmService.getAlarmById(id)
                .map(ApiResponse::success)
                .orElse(ApiResponse.error("告警不存在"));
    }
    
    @PostMapping
    public ApiResponse<Alarm> createAlarm(@RequestBody Alarm alarm) {
        return ApiResponse.success(alarmService.createAlarm(alarm));
    }
    
    @PutMapping("/{id}/acknowledge")
    public ApiResponse<Alarm> acknowledgeAlarm(@PathVariable Long id) {
        return alarmService.acknowledgeAlarm(id)
                .map(ApiResponse::success)
                .orElse(ApiResponse.error("告警不存在"));
    }
    
    @PutMapping("/{id}/resolve")
    public ApiResponse<Alarm> resolveAlarm(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        String resolvedBy = body.getOrDefault("resolvedBy", "system");
        return alarmService.resolveAlarm(id, resolvedBy)
                .map(ApiResponse::success)
                .orElse(ApiResponse.error("告警不存在"));
    }
    
    @PostMapping("/batch-resolve")
    public ApiResponse<Map<String, Integer>> batchResolve(@RequestBody Map<String, Object> body) {
        @SuppressWarnings("unchecked")
        List<Long> ids = (List<Long>) body.get("ids");
        String resolvedBy = (String) body.getOrDefault("resolvedBy", "system");
        int count = alarmService.batchResolve(ids, resolvedBy);
        return ApiResponse.success(Map.of("resolved", count));
    }
}
