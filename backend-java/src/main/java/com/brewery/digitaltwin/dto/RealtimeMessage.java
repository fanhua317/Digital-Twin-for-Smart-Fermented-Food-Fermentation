package com.brewery.digitaltwin.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class RealtimeMessage {
    private String type;  // pit_data, device_data, alarm, system
    private Object data;
    private LocalDateTime timestamp = LocalDateTime.now();
    
    public RealtimeMessage(String type, Object data) {
        this.type = type;
        this.data = data;
    }
}
