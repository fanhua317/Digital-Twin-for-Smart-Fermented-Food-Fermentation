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
            @RequestParam(required = false) String level,
            @RequestParam(name = "is_resolved", required = false) Boolean isResolved,
            @RequestParam(required = false, defaultValue = "active") String status) {
        String resolvedStatus = status;
        if (isResolved != null) {
            resolvedStatus = isResolved ? "resolved" : "active";
        }
        List<Alarm> alarms;
        if (level != null) {
            alarms = alarmService.getAlarmsByLevelAndStatus(level, resolvedStatus);
        } else if ("active".equals(resolvedStatus)) {
            alarms = alarmService.getActiveAlarms();
        } else {
            alarms = alarmService.getRecentAlarms();
        }
        return ApiResponse.success(alarms);
    }
    
    @GetMapping("/recent")
    public ApiResponse<List<Alarm>> getRecentAlarms() {
        return ApiResponse.success(alarmService.getRecentAlarms());
    }

    @GetMapping("/active")
    public ApiResponse<List<Alarm>> getActiveAlarms() {
        return ApiResponse.success(alarmService.getActiveAlarms());
    }

    @GetMapping("/stats")
    public ApiResponse<Map<String, Object>> getStats() {
        return ApiResponse.success(alarmService.getStats());
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
            @RequestParam(name = "resolved_by", required = false) String resolvedByParam,
            @RequestBody(required = false) Map<String, String> body) {
        String resolvedBy = resolvedByParam;
        if (resolvedBy == null && body != null) {
            resolvedBy = body.getOrDefault("resolvedBy", "system");
        }
        if (resolvedBy == null) {
            resolvedBy = "system";
        }
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

    @PutMapping("/resolve-batch")
    public ApiResponse<Map<String, Integer>> resolveBatch(
            @RequestParam(name = "alarm_ids", required = false) List<Long> ids,
            @RequestParam(name = "alarm_ids[]", required = false) List<Long> idsAlt,
            @RequestParam(name = "resolved_by", required = false) String resolvedBy) {
        List<Long> resolvedIds = ids != null ? ids : idsAlt;
        if (resolvedIds == null || resolvedIds.isEmpty()) {
            return ApiResponse.error("alarm_ids 不能为空");
        }
        String resolvedUser = resolvedBy != null ? resolvedBy : "system";
        int count = alarmService.batchResolve(resolvedIds, resolvedUser);
        return ApiResponse.success(Map.of("resolved", count));
    }
}
