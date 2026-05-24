package com.brewery.digitaltwin.service;

import lombok.Data;

@Data
public class ProductionParam {
    private Long id;
    private String processName;
    private String name;
    private Double value;
    private String unit;
    private Double min;
    private Double max;

    public ProductionParam(Long id, String processName, String name, Double value, String unit, Double min, Double max) {
        this.id = id;
        this.processName = processName;
        this.name = name;
        this.value = value;
        this.unit = unit;
        this.min = min;
        this.max = max;
    }
}
