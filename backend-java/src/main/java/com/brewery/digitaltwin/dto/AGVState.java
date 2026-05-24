package com.brewery.digitaltwin.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

/**
 * AGV 实时状态 - 由 ProcessSimulationService 单一驱动
 * 前端不再自己跑动画，而是按 progress + path 渲染位置
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AGVState {
    /** 编号 AGV-01 .. AGV-05 */
    private String code;
    /** 任务名 */
    private String task;
    /** 装载货物类型：grain/fermented/mixed/distilled/cooled/empty */
    private String cargoType;
    /** 阶段：loading/moving/unloading/returning/idle */
    private String stage;

    /** 来源工位编码 (设备/窖池) */
    private String fromCode;
    /** 目标工位编码 */
    private String toCode;

    /** 当前载重 (kg) */
    private double weight;
    /** 满载量 (kg) */
    private double weightCapacity;
    /** 货物温度 (°C) */
    private double temperature;
    /** 货物 pH */
    private double ph;
    /** 货物水分 (%) */
    private double moisture;

    /** 路径段索引 */
    private int segmentIndex;
    /** 段内进度 0~1 */
    private double segmentProgress;
    /** 路径上的实时坐标 [x, y, z] - 后端预计算，前端直接渲染 */
    private double[] position;
    /** 完整路径，前端绘制轨迹 */
    private double[][] path;

    /** 行驶速度 m/s */
    private double speed;
    /** 完成往返周期数 */
    private long cycleCount;
    /** 累计运输量 (kg) */
    private double totalTransported;

    // ===== RFID 标签信息 (按 PPT 工艺) =====
    /** 糟醅类型: zhapei(楂醅)/hongzao(红糟)/diuzao(丢糟) */
    private String grainCategory;
    /** 来源窖池号 */
    private String sourcePitNo;
    /** 出窖层数 */
    private Integer dischargeLayer;
    /** 出窖时间 (ISO 字符串) */
    private String dischargeTime;
}
