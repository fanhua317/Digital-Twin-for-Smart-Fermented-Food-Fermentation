package com.brewery.digitaltwin.controller;

import com.brewery.digitaltwin.dto.ApiResponse;
import com.brewery.digitaltwin.dto.HeatmapData;
import com.brewery.digitaltwin.entity.Pit;
import com.brewery.digitaltwin.entity.PitSensorData;
import com.brewery.digitaltwin.service.DashboardService;
import com.brewery.digitaltwin.service.PitService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/pits")
@RequiredArgsConstructor
public class PitController {
    
    private final PitService pitService;
    private final DashboardService dashboardService;
    
    @GetMapping
    public ApiResponse<List<Pit>> getAllPits(
            @RequestParam(required = false) String zone,
            @RequestParam(required = false) String status) {
        List<Pit> pits;
        if (zone != null) {
            pits = pitService.getPitsByZone(zone);
        } else if (status != null) {
            pits = pitService.getPitsByStatus(status);
        } else {
            pits = pitService.getAllPits();
        }
        return ApiResponse.success(pits);
    }
    
    @GetMapping("/stats")
    public ApiResponse<Map<String, Object>> getPitStats() {
        Map<String, Object> stats = new HashMap<>();
        List<Pit> allPits = pitService.getAllPits();
        long normalCount = allPits.stream().filter(p -> "normal".equals(p.getStatus())).count();
        long warningCount = allPits.stream().filter(p -> "warning".equals(p.getStatus())).count();
        long alarmCount = allPits.stream().filter(p -> "alarm".equals(p.getStatus())).count();
        stats.put("total", allPits.size());
        stats.put("normal", normalCount);
        stats.put("warning", warningCount);
        stats.put("alarm", alarmCount);
        return ApiResponse.success(stats);
    }
    
    @GetMapping("/heatmap")
    public ApiResponse<List<HeatmapData>> getHeatmap() {
        return ApiResponse.success(dashboardService.getHeatmap());
    }
    
    @GetMapping("/{id}")
    public ApiResponse<Pit> getPitById(@PathVariable Long id) {
        return pitService.getPitById(id)
                .map(ApiResponse::success)
                .orElse(ApiResponse.error("窖池不存在"));
    }
    
    @GetMapping("/no/{pitNo}")
    public ApiResponse<Pit> getPitByNo(@PathVariable String pitNo) {
        return pitService.getPitByNo(pitNo)
                .map(ApiResponse::success)
                .orElse(ApiResponse.error("窖池不存在"));
    }
    
    @PostMapping
    public ApiResponse<Pit> createPit(@RequestBody Pit pit) {
        return ApiResponse.success(pitService.createPit(pit));
    }
    
    @PutMapping("/{id}")
    public ApiResponse<Pit> updatePit(@PathVariable Long id, @RequestBody Pit pit) {
        return pitService.updatePit(id, pit)
                .map(ApiResponse::success)
                .orElse(ApiResponse.error("窖池不存在"));
    }
    
    @PutMapping("/{id}/status")
    public ApiResponse<Pit> updatePitStatus(
            @PathVariable Long id, 
            @RequestParam String status,
            @RequestParam(required = false) String batch_code) {
        return pitService.getPitById(id)
                .map(pit -> {
                    pit.setStatus(status);
                    return ApiResponse.success(pitService.updatePit(id, pit).get());
                })
                .orElse(ApiResponse.error("窖池不存在"));
    }
    
    @GetMapping("/{id}/sensors")
    public ApiResponse<List<PitSensorData>> getPitSensors(
            @PathVariable Long id,
            @RequestParam(required = false, defaultValue = "24") Integer hours) {
        return ApiResponse.success(pitService.getPitSensorData(id, hours));
    }
    
    @GetMapping("/{id}/sensors/latest")
    public ApiResponse<PitSensorData> getLatestPitSensor(@PathVariable Long id) {
        List<PitSensorData> data = pitService.getPitSensorData(id, null);
        if (data.isEmpty()) {
            return ApiResponse.error("暂无传感器数据");
        }
        return ApiResponse.success(data.get(data.size() - 1));
    }
    
    @GetMapping("/{id}/sensor-data")
    public ApiResponse<List<PitSensorData>> getPitSensorData(@PathVariable Long id) {
        return ApiResponse.success(pitService.getPitSensorData(id, null));
    }
    
    @GetMapping("/sensor-data/latest")
    public ApiResponse<List<PitSensorData>> getLatestSensorData() {
        return ApiResponse.success(pitService.getLatestSensorData());
    }
}
