package com.brewery.digitaltwin.dto;

import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * 工艺仿真快照 - 后端一拍一推
 * 前端 3D 场景、Dashboard、生产管理共享同一份数据
 */
@Data
@NoArgsConstructor
public class SimulationSnapshot {
    /** 仿真已运行时间 (秒) */
    private long uptimeSeconds;
    /** 仿真时间换算 (1 实秒 = N 仿真分钟) */
    private double timeScale;
    /** 是否已暂停 */
    private boolean paused;

    /** 设备实时状态 (key=code) */
    private Map<String, EquipmentState> equipments;
    /** AGV 实时状态 (key=code) */
    private Map<String, AGVState> agvs;

    /** 全厂累计统计 */
    private SimulationStats stats;

    /** 当前活跃生产批次摘要 */
    private List<BatchSummary> activeBatches;

    /** 当前各阶段窖池数量 */
    private Map<String, Long> pitStageCounts;

    /** 当前各糟醅类型窖池分布 */
    private Map<String, Long> pitGrainCategoryCounts;

    /** 分级摘酒罐 - 头酒/中段/尾酒 */
    private LiquorStorage liquorStorage;

    /** 原料发放中心 - 粉粮/稻壳/曲粉 三仓 */
    private Map<String, RawMaterialBin> rawMaterials;

    /** 摊凉机三段冷却实时温度 */
    private CoolerStages coolerStages;

    /** 丢糟暂存仓 */
    private RawMaterialBin diuzaoBin;

    @Data
    @NoArgsConstructor
    public static class SimulationStats {
        /** AGV 累计运输 (kg) */
        private double totalTransported;
        /** 设备累计处理 (kg) */
        private double totalProcessed;
        /** 蒸馏累计产酒 (kg) */
        private double totalLiquor;
        /** 完成生产周期数 */
        private long completedCycles;
        /** 系统效率 (%) */
        private double efficiency;
        /** 全厂功率 (kW) */
        private double totalPower;
        /** 单位粮食出酒率 (%) - 实测 */
        private double yieldRate;
        /** 仿真总日期 (天)，由 uptime 推导 */
        private double simulatedDays;
    }

    @Data
    @NoArgsConstructor
    public static class BatchSummary {
        private Long id;
        private String batchNo;
        private String productType;
        private double targetVolume;
        private double actualVolume;
        private double progress;
        private String stage;
    }

    /** 分级摘酒储罐 (头酒/中段/尾酒) */
    @Data
    @NoArgsConstructor
    public static class LiquorStorage {
        /** 头酒 (酒头) - 高酸度，~5% 产量 */
        private double headLiquor;
        /** 中段优级 (中流) - 主要产品，~85% 产量 */
        private double midLiquor;
        /** 尾酒 (酒尾) - 低度，~10% 产量 */
        private double tailLiquor;
        /** 储罐容量 (kg) */
        private double capacity;
        /** 累计中段酒精度 (%vol) - 受蒸馏温度影响 */
        private double midAlcoholDegree;
    }

    /** 原料发放仓 (粉粮/稻壳/曲粉) */
    @Data
    @NoArgsConstructor
    public static class RawMaterialBin {
        /** 仓名：grain(粉粮)/husk(稻壳)/koji(曲粉)/diuzao(丢糟) */
        private String code;
        /** 显示名 */
        private String name;
        /** 当前存量 (kg) */
        private double level;
        /** 仓容 (kg) */
        private double capacity;
        /** 出料速率 (kg/s) - 当前正在向工位发放 */
        private double feedRate;
        /** 累计发放量 (kg) */
        private double totalFed;
    }

    /** 摊凉机三段冷却 */
    @Data
    @NoArgsConstructor
    public static class CoolerStages {
        /** 第一段温度 (°C) - 目标 40-45 */
        private double stage1Temp;
        /** 第二段温度 (°C) - 目标 22-28 */
        private double stage2Temp;
        /** 第三段温度 (°C) - 目标 12-14 */
        private double stage3Temp;
        /** 鼓风机功率 (%) */
        private double fanPower;
        /** 出口糟温 (°C) */
        private double outletTemp;
    }
}
