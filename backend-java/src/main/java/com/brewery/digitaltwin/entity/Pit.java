package com.brewery.digitaltwin.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

/**
 * 窖池实体
 */
@Data
@Entity
@Table(name = "pits")
public class Pit {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false, unique = true)
    private String pitNo;  // 窖池编号 如 A-001
    
    @Column(nullable = false)
    private String zone;   // 区域 A/B/C/D
    
    @Column(nullable = false, name = "pit_row")
    private Integer row;   // 行
    
    @Column(nullable = false, name = "pit_col")
    private Integer col;   // 列
    
    @Column(nullable = false)
    private String status = "normal"; // normal/warning/alarm/maintenance
    
    private Integer pitAge = 50;  // 窖龄(年)
    
    private String grapeType = "高粱";  // 原料类型
    
    private Integer fermentationDay = 0;  // 发酵天数
    
    private LocalDateTime lastMaintenance;
    
    private LocalDateTime createdAt = LocalDateTime.now();
    
    private LocalDateTime updatedAt = LocalDateTime.now();
}
