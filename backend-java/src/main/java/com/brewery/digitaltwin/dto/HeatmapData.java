package com.brewery.digitaltwin.dto;

import lombok.Data;

@Data
public class HeatmapData {
    private Long pitId;
    private String pitNo;
    private String zone;
    private Integer row;
    private Integer col;
    private Double temperature;
    private Double humidity;
    private Double phValue;
    private String status;
}
