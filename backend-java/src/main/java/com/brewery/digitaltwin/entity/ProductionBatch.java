package com.brewery.digitaltwin.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

/**
 * 生产批次
 */
@Data
@Entity
@Table(name = "production_batches")
public class ProductionBatch {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false, unique = true)
    private String batchNo;  // 批次号
    
    @Column(nullable = false)
    private String productType = "浓香型白酒";
    
    private Double targetVolume;  // 目标产量 (吨)
    
    private Double actualVolume;  // 实际产量 (吨)
    
    private Double qualityScore;  // 质量评分
    
    @Column(nullable = false)
    private String status = "planning"; // planning/in_progress/completed/cancelled
    
    private LocalDateTime startDate;
    
    private LocalDateTime endDate;
    
    private LocalDateTime createdAt = LocalDateTime.now();
}
