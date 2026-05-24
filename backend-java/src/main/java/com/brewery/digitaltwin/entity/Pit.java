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

    /** 工艺阶段：empty(空池)/filling(入池中)/fermenting(发酵中)/ready(待起糟)/discharging(起糟中) */
    @Column(nullable = false)
    private String stage = "fermenting";

    /** 当前粮糟存量 (kg) */
    private Double grainAmount = 0.0;

    /** 入池温度 (°C) */
    private Double entryTemperature = 20.0;

    /** 糟醅类型：zhapei(楂醅)/hongzao(红糟)/diuzao(丢糟) - 按工艺主要分 3 类 */
    @Column(nullable = false)
    private String grainCategory = "zhapei";

    /** 入窖水分 (%) - 工艺典型 51-55% */
    private Double entryMoisture = 53.0;

    /** 入窖酸度 (mmol/10g) - 工艺典型 1.4-2.5 */
    private Double entryAcidity = 1.8;

    /** 入窖淀粉 (%) - 工艺典型 18-24% */
    private Double entryStarch = 20.0;

    /** 粮糠比 (%) - 工艺典型 22-27% */
    private Double grainHullRatio = 24.0;

    /** 粮曲比 (%) - 工艺典型 20-25% */
    private Double grainKojiRatio = 22.0;

    /** 粮醅比 (1:N) - 工艺典型 4-4.5 */
    private Double grainMashRatio = 4.0;

    /** 发酵阶段：early(前缓 0-25天)/middle(中挺 25-40天)/late(后缓落 40-60天) */
    private String fermentationPhase = "early";

    private String currentBatchCode;  // 当前关联生产批次编号

    private LocalDateTime lastMaintenance;
    
    private LocalDateTime createdAt = LocalDateTime.now();
    
    private LocalDateTime updatedAt = LocalDateTime.now();
}
