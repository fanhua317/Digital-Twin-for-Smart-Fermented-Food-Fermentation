package com.brewery.digitaltwin.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

/**
 * 设备运行数据
 */
@Data
@Entity
@Table(
    name = "device_data",
    indexes = {
        @Index(name = "idx_device_data_device_time", columnList = "device_id, recorded_at")
    }
)
public class DeviceData {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "device_id", nullable = false)
    private Long deviceId;
    
    private Double power;       // 功率 kW
    
    private Double speed;       // 转速 RPM
    
    private Double vibration;   // 振动 mm/s
    
    private Double temperature; // 温度 ℃
    
    private Double current;     // 电流 A
    
    @Column(name = "recorded_at")
    private LocalDateTime recordedAt = LocalDateTime.now();
}
