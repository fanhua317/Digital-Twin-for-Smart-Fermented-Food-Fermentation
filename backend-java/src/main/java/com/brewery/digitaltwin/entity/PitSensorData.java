package com.brewery.digitaltwin.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

/**
 * 窖池传感器数据
 */
@Data
@Entity
@Table(name = "pit_sensor_data")
public class PitSensorData {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false)
    private Long pitId;
    
    private Double temperature;  // 温度 ℃
    
    private Double humidity;     // 湿度 %
    
    private Double phValue;      // pH值
    
    private Double acidity;      // 酸度
    
    private Double moisture;     // 水分 %
    
    private Double alcohol;      // 酒精度
    
    private LocalDateTime recordedAt = LocalDateTime.now();
}
