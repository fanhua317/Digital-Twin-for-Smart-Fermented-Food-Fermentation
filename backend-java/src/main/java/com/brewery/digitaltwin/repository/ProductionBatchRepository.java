package com.brewery.digitaltwin.repository;

import com.brewery.digitaltwin.entity.ProductionBatch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface ProductionBatchRepository extends JpaRepository<ProductionBatch, Long> {
    
    Optional<ProductionBatch> findByBatchNo(String batchNo);
    
    List<ProductionBatch> findByStatus(String status);
    
    List<ProductionBatch> findTop10ByOrderByCreatedAtDesc();
    
    @Query("SELECT COUNT(b) FROM ProductionBatch b WHERE b.status = :status")
    long countByStatus(String status);
    
    @Query("SELECT SUM(b.actualVolume) FROM ProductionBatch b WHERE b.status = 'completed'")
    Double sumCompletedVolume();
}
