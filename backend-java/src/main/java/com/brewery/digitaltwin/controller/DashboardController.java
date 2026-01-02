package com.brewery.digitaltwin.controller;

import com.brewery.digitaltwin.dto.ApiResponse;
import com.brewery.digitaltwin.dto.DashboardStats;
import com.brewery.digitaltwin.dto.HeatmapData;
import com.brewery.digitaltwin.service.DashboardService;
import com.brewery.digitaltwin.websocket.RealtimeWebSocketHandler;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/dashboard")
@RequiredArgsConstructor
public class DashboardController {
    
    private final DashboardService dashboardService;
    private final RealtimeWebSocketHandler webSocketHandler;
    
    @GetMapping("/stats")
    public ApiResponse<DashboardStats> getStats() {
        return ApiResponse.success(dashboardService.getStats());
    }
    
    @GetMapping("/overview")
    public ApiResponse<Map<String, Object>> getOverview() {
        return ApiResponse.success(dashboardService.getOverview());
    }
    
    @GetMapping("/realtime-metrics")
    public ApiResponse<Map<String, Object>> getRealtimeMetrics() {
        DashboardStats stats = dashboardService.getStats();
        Map<String, Object> metrics = new HashMap<>();
        metrics.put("temperature", stats.getAvgTemperature());
        metrics.put("humidity", stats.getAvgHumidity());
        metrics.put("power", stats.getTotalPower());
        metrics.put("activePits", stats.getNormalPits());
        metrics.put("runningDevices", stats.getRunningDevices());
        metrics.put("activeAlarms", stats.getActiveAlarms());
        return ApiResponse.success(metrics);
    }
    
    @GetMapping("/heatmap")
    public ApiResponse<List<HeatmapData>> getHeatmap() {
        return ApiResponse.success(dashboardService.getHeatmap());
    }
    
    @GetMapping("/system-info")
    public ApiResponse<Map<String, Object>> getSystemInfo() {
        Map<String, Object> info = new HashMap<>();
        info.put("wsConnections", webSocketHandler.getConnectionCount());
        info.put("javaVersion", System.getProperty("java.version"));
        info.put("uptime", System.currentTimeMillis());
        info.put("freeMemory", Runtime.getRuntime().freeMemory() / 1024 / 1024 + "MB");
        info.put("totalMemory", Runtime.getRuntime().totalMemory() / 1024 / 1024 + "MB");
        return ApiResponse.success(info);
    }
}
