package com.brewery.digitaltwin.controller;

import com.brewery.digitaltwin.dto.AGVState;
import com.brewery.digitaltwin.dto.ApiResponse;
import com.brewery.digitaltwin.dto.EquipmentState;
import com.brewery.digitaltwin.dto.SimulationSnapshot;
import com.brewery.digitaltwin.service.ProcessSimulationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Collection;
import java.util.Map;

/**
 * 工艺仿真 REST API：用于前端在 WebSocket 未连通时拉取首帧快照。
 */
@RestController
@RequestMapping("/api/v1/simulation")
@RequiredArgsConstructor
public class SimulationController {

    private final ProcessSimulationService simulationService;

    @GetMapping("/snapshot")
    public ApiResponse<SimulationSnapshot> snapshot() {
        return ApiResponse.success(simulationService.snapshot());
    }

    @GetMapping("/equipments")
    public ApiResponse<Collection<EquipmentState>> equipments() {
        return ApiResponse.success(simulationService.getEquipments());
    }

    @GetMapping("/agvs")
    public ApiResponse<Collection<AGVState>> agvs() {
        return ApiResponse.success(simulationService.getAgvs());
    }

    @PostMapping("/pause")
    public ApiResponse<Map<String, Object>> pause() {
        simulationService.pause();
        return ApiResponse.success(Map.of("paused", true));
    }

    @PostMapping("/resume")
    public ApiResponse<Map<String, Object>> resume() {
        simulationService.resume();
        return ApiResponse.success(Map.of("paused", false));
    }

    @PostMapping("/reset")
    public ApiResponse<Map<String, Object>> reset() {
        simulationService.reset();
        return ApiResponse.success(Map.of("reset", true, "paused", simulationService.isPaused()));
    }
}
