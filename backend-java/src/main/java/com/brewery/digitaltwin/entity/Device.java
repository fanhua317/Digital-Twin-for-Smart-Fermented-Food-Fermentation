package com.brewery.digitaltwin.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

/**
 * 设备实体
 */
@Data
@Entity
@Table(name = "devices")
public class Device {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false, unique = true)
    private String deviceNo;  // 设备编号
    
    @Column(nullable = false)
    private String name;      // 设备名称
    
    @Column(nullable = false)
    private String type;      // 设备类型: pump/motor/sensor/robot/conveyor
    
    private String location;  // 所在位置
    
    @Column(nullable = false)
    private String status = "running"; // running/stopped/warning/fault/maintenance
    
    private Double runningHours = 0.0; // 运行小时数
    
    private LocalDateTime lastMaintenance;
    
    private LocalDateTime nextMaintenance;
    
    private LocalDateTime createdAt = LocalDateTime.now();
    
    private LocalDateTime updatedAt = LocalDateTime.now();
}
