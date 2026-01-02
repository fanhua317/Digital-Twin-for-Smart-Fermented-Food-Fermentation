package com.brewery.digitaltwin.dto;

import lombok.Data;
import java.util.Map;

@Data
public class DashboardStats {
    private long totalPits;
    private long normalPits;
    private long warningPits;
    private long alarmPits;
    
    private long totalDevices;
    private long runningDevices;
    private long faultDevices;
    
    private long activeAlarms;
    private Map<String, Long> alarmsByLevel;
    
    private long inProgressBatches;
    private Double totalProduction;
    
    private Double avgTemperature;
    private Double avgHumidity;
    private Double totalPower;
}
