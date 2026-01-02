package com.brewery.digitaltwin.controller;

import com.brewery.digitaltwin.dto.ApiResponse;
import com.brewery.digitaltwin.entity.ProductionBatch;
import com.brewery.digitaltwin.service.ProductionService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

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
}
