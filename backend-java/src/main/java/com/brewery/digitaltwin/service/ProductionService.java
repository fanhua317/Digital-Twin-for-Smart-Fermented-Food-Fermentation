package com.brewery.digitaltwin.service;

import com.brewery.digitaltwin.entity.ProductionBatch;
import com.brewery.digitaltwin.repository.ProductionBatchRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ProductionService {
    
    private final ProductionBatchRepository batchRepository;
    
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
