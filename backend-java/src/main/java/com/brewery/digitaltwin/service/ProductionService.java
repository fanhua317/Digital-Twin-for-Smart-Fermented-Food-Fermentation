package com.brewery.digitaltwin.service;

import com.brewery.digitaltwin.entity.ProductionBatch;
import com.brewery.digitaltwin.repository.ProductionBatchRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;

@Service
@RequiredArgsConstructor
public class ProductionService {
    
    private final ProductionBatchRepository batchRepository;
    private final List<ProductionParam> processParams = new ArrayList<>();
    private final AtomicLong paramId = new AtomicLong(1);
    
    public List<ProductionBatch> getAllBatches() {
        return batchRepository.findAll();
    }
    
    public List<ProductionBatch> getRecentBatches() {
        return batchRepository.findTop10ByOrderByCreatedAtDesc();
    }
    
    public Optional<ProductionBatch> getBatchById(Long id) {
        return batchRepository.findById(id);
    }
    
    public List<ProductionBatch> getBatchesByStatus(String status) {
        return batchRepository.findByStatus(status);
    }

    public Map<String, Object> getBatchStats() {
        Map<String, Object> stats = new HashMap<>();
        long total = batchRepository.count();
        long processing = batchRepository.countByStatus("in_progress");
        long completed = batchRepository.countByStatus("completed");
        double todayProduction = batchRepository.findByStatus("completed").stream()
                .filter(batch -> batch.getEndDate() != null && batch.getEndDate().toLocalDate().equals(LocalDate.now()))
                .mapToDouble(batch -> batch.getActualVolume() != null ? batch.getActualVolume() : 0.0)
                .sum();
        stats.put("total", total);
        stats.put("processing", processing);
        stats.put("completed", completed);
        stats.put("today_production", todayProduction);
        return stats;
    }

    public List<Map<String, Object>> getProductionTrends(int days) {
        List<ProductionBatch> completed = batchRepository.findByStatus("completed");
        List<Map<String, Object>> trends = new ArrayList<>();
        for (int i = days - 1; i >= 0; i--) {
            LocalDate date = LocalDate.now().minusDays(i);
            double production = completed.stream()
                    .filter(batch -> batch.getEndDate() != null && batch.getEndDate().toLocalDate().equals(date))
                    .mapToDouble(batch -> batch.getActualVolume() != null ? batch.getActualVolume() : 0.0)
                    .sum();
            double qualityRate = completed.stream()
                    .filter(batch -> batch.getEndDate() != null && batch.getEndDate().toLocalDate().equals(date))
                    .mapToDouble(batch -> batch.getQualityScore() != null ? batch.getQualityScore() : 85.0)
                    .average()
                    .orElse(85.0);
            Map<String, Object> point = new HashMap<>();
            point.put("date", date.toString());
            point.put("production", production);
            point.put("quality_rate", Math.min(100.0, qualityRate));
            trends.add(point);
        }
        return trends;
    }

    public Map<String, List<ProductionParam>> getProcessParams() {
        ensureParams();
        Map<String, List<ProductionParam>> result = new HashMap<>();
        for (ProductionParam param : processParams) {
            result.computeIfAbsent(param.getProcessName(), key -> new ArrayList<>()).add(param);
        }
        return result;
    }

    @Transactional
    public Optional<ProductionParam> updateParam(Long id, Double value) {
        ensureParams();
        for (ProductionParam param : processParams) {
            if (param.getId().equals(id)) {
                param.setValue(value);
                return Optional.of(param);
            }
        }
        return Optional.empty();
    }

    private void ensureParams() {
        if (!processParams.isEmpty()) return;
        processParams.add(new ProductionParam(nextId(), "制曲", "曲块水分", 12.0, "%", 8.0, 16.0));
        processParams.add(new ProductionParam(nextId(), "制曲", "曲房温度", 28.0, "℃", 20.0, 35.0));
        processParams.add(new ProductionParam(nextId(), "发酵", "窖池温度", 30.0, "℃", 25.0, 40.0));
        processParams.add(new ProductionParam(nextId(), "发酵", "入窖水分", 55.0, "%", 45.0, 60.0));
        processParams.add(new ProductionParam(nextId(), "蒸馏", "蒸汽压力", 0.5, "MPa", 0.3, 0.8));
        processParams.add(new ProductionParam(nextId(), "蒸馏", "出酒速度", 2.0, "L/min", 1.0, 3.0));
    }

    private long nextId() {
        return paramId.getAndIncrement();
    }
    
    @Transactional
    public ProductionBatch createBatch(ProductionBatch batch) {
        return batchRepository.save(batch);
    }
    
    @Transactional
    public Optional<ProductionBatch> updateBatch(Long id, ProductionBatch batchData) {
        return batchRepository.findById(id).map(batch -> {
            if (batchData.getProductType() != null) batch.setProductType(batchData.getProductType());
            if (batchData.getTargetVolume() != null) batch.setTargetVolume(batchData.getTargetVolume());
            if (batchData.getActualVolume() != null) batch.setActualVolume(batchData.getActualVolume());
            if (batchData.getQualityScore() != null) batch.setQualityScore(batchData.getQualityScore());
            if (batchData.getStatus() != null) batch.setStatus(batchData.getStatus());
            return batchRepository.save(batch);
        });
    }
    
    @Transactional
    public Optional<ProductionBatch> startBatch(Long id) {
        return batchRepository.findById(id).map(batch -> {
            batch.setStatus("in_progress");
            batch.setStartDate(LocalDateTime.now());
            return batchRepository.save(batch);
        });
    }
    
    @Transactional
    public Optional<ProductionBatch> completeBatch(Long id, Double actualVolume, Double qualityScore) {
        return batchRepository.findById(id).map(batch -> {
            batch.setStatus("completed");
            batch.setEndDate(LocalDateTime.now());
            batch.setActualVolume(actualVolume);
            batch.setQualityScore(qualityScore);
            return batchRepository.save(batch);
        });
    }
}
