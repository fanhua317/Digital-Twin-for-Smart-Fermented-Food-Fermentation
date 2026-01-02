package com.brewery.digitaltwin.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

/**
 * 告警实体
 */
@Data
@Entity
@Table(name = "alarms")
public class Alarm {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false)
    private String level;  // info/warning/error/critical
    
    @Column(nullable = false)
    private String type;   // temperature/humidity/ph/device/system
    
    @Column(nullable = false)
    private String source; // 来源: pit-A-001 或 device-P-001
    
    @Column(nullable = false, length = 500)
    private String message;
    
    @Column(nullable = false)
    private String status = "active"; // active/acknowledged/resolved
    
    private String resolvedBy;
    
    private LocalDateTime resolvedAt;
    
    private LocalDateTime createdAt = LocalDateTime.now();
}
