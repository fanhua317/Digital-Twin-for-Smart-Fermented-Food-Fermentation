package com.brewery.digitaltwin.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

/**
 * 工艺设备实时状态 - 工艺主仿真器维护的核心数据
 * 用于 3D 仿真、物料流转和能耗计算
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class EquipmentState {
    /** 设备工位编码：MIXER/STEAMER/DISTILLER/COOLER/PUMP */
    private String code;
    /** 关联数据库设备主键，便于追溯 */
    private Long deviceId;
    /** 设备名称 */
    private String name;
    /** 设备类型：motor/robot/pump/conveyor/distiller */
    private String type;
    /** 工艺阶段名称 */
    private String stage;
    /** 设备状态：running/idle/warning/fault/maintenance */
    private String status;

    /** 入料品名 */
    private String inputName;
    /** 出料品名 */
    private String outputName;
    /** 当前入料量 (kg) */
    private double inputLevel;
    /** 当前出料量 (kg) */
    private double outputLevel;
    /** 入料缓冲容量 (kg) */
    private double inputCapacity;
    /** 出料缓冲容量 (kg) */
    private double outputCapacity;
    /** 处理速率 (kg/s) - 工厂级 */
    private double processRate;
    /** 设备转化率 (0~1)：蒸馏出酒率、摊凉成品率 */
    private double conversionRate;

    /** 辅料名 (如蒸馏塔的底锅水) */
    private String auxName;
    /** 辅料量 */
    private double auxLevel;
    /** 辅料容量 */
    private double auxCapacity;

    /** 当前功率 (kW) */
    private double power;
    /** 设备温度 (°C) */
    private double temperature;
    /** 累计处理量 (kg) */
    private double totalProcessed;
    /** 累计产出量 (kg) - 蒸馏塔即基酒，摊凉机即入池粮 */
    private double totalOutput;

    /** 3D 场景坐标，便于前端摆放设备 */
    private double[] position;
}
