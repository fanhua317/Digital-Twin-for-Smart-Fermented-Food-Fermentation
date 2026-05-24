package com.brewery.digitaltwin.controller;

import com.brewery.digitaltwin.dto.ApiResponse;
import com.brewery.digitaltwin.entity.ProductionBatch;
import com.brewery.digitaltwin.service.ProductionParam;
import com.brewery.digitaltwin.service.ProductionService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/production")
@RequiredArgsConstructor
public class ProductionController {
    
    private final ProductionService productionService;
    
    @GetMapping("/batches")
    public ApiResponse<List<ProductionBatch>> getAllBatches(
            @RequestParam(required = false) String status) {
        if (status != null) {
            return ApiResponse.success(productionService.getBatchesByStatus(status));
        }
        return ApiResponse.success(productionService.getAllBatches());
    }

    @GetMapping("/batches/stats")
    public ApiResponse<Map<String, Object>> getBatchStats() {
        return ApiResponse.success(productionService.getBatchStats());
    }
    
    @GetMapping("/batches/recent")
    public ApiResponse<List<ProductionBatch>> getRecentBatches() {
        return ApiResponse.success(productionService.getRecentBatches());
    }
    
    @GetMapping("/batches/{id}")
    public ApiResponse<ProductionBatch> getBatchById(@PathVariable Long id) {
        return productionService.getBatchById(id)
                .map(ApiResponse::success)
                .orElse(ApiResponse.error("批次不存在"));
    }
    
    @PostMapping("/batches")
    public ApiResponse<ProductionBatch> createBatch(@RequestBody ProductionBatch batch) {
        return ApiResponse.success(productionService.createBatch(batch));
    }
    
    @PutMapping("/batches/{id}")
    public ApiResponse<ProductionBatch> updateBatch(
            @PathVariable Long id,
            @RequestBody ProductionBatch batch) {
        return productionService.updateBatch(id, batch)
                .map(ApiResponse::success)
                .orElse(ApiResponse.error("批次不存在"));
    }
    
    @PostMapping("/batches/{id}/start")
    public ApiResponse<ProductionBatch> startBatch(@PathVariable Long id) {
        return productionService.startBatch(id)
                .map(ApiResponse::success)
                .orElse(ApiResponse.error("批次不存在"));
    }

    @PutMapping("/batches/{id}/start")
    public ApiResponse<ProductionBatch> startBatchByPut(@PathVariable Long id) {
        return startBatch(id);
    }
    
    @PostMapping("/batches/{id}/complete")
    public ApiResponse<ProductionBatch> completeBatch(
            @PathVariable Long id,
            @RequestBody Map<String, Double> body) {
        Double actualVolume = body.get("actualVolume");
        Double qualityScore = body.get("qualityScore");
        return productionService.completeBatch(id, actualVolume, qualityScore)
                .map(ApiResponse::success)
                .orElse(ApiResponse.error("批次不存在"));
    }

    @PutMapping("/batches/{id}/complete")
    public ApiResponse<ProductionBatch> completeBatchByPut(
            @PathVariable Long id,
            @RequestParam(name = "actual_alcohol", required = false) Double actualAlcohol,
            @RequestParam(name = "wine_grade", required = false) String wineGrade,
            @RequestParam(name = "actual_volume", required = false) Double actualVolume,
            @RequestParam(name = "quality_score", required = false) Double qualityScore) {
        Double finalActual = actualVolume != null ? actualVolume : actualAlcohol;
        Double finalQuality = qualityScore;
        if (finalQuality == null && wineGrade != null) {
            finalQuality = "特级".equals(wineGrade) ? 98.0
                    : "优级".equals(wineGrade) ? 92.0
                    : "一级".equals(wineGrade) ? 88.0
                    : "二级".equals(wineGrade) ? 82.0 : 75.0;
        }
        return productionService.completeBatch(id, finalActual, finalQuality)
                .map(ApiResponse::success)
                .orElse(ApiResponse.error("批次不存在"));
    }

    @GetMapping("/trends")
    public ApiResponse<List<Map<String, Object>>> getTrends(
            @RequestParam(required = false, defaultValue = "7") Integer days) {
        return ApiResponse.success(productionService.getProductionTrends(days));
    }

    @GetMapping("/params")
    public ApiResponse<Map<String, List<ProductionParam>>> getParams(
            @RequestParam(name = "process_name", required = false) String processName) {
        Map<String, List<ProductionParam>> params = new HashMap<>(productionService.getProcessParams());
        if (processName != null) {
            List<ProductionParam> data = params.get(processName);
            return ApiResponse.success(Map.of(processName, data == null ? List.of() : data));
        }
        return ApiResponse.success(params);
    }

    @PutMapping("/params/{id}")
    public ApiResponse<ProductionParam> updateParam(
            @PathVariable Long id,
            @RequestParam Double value) {
        return productionService.updateParam(id, value)
                .map(ApiResponse::success)
                .orElse(ApiResponse.error("参数不存在"));
    }
}
