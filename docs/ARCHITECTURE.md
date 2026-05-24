# 系统架构详解

[← 返回 README](../README.md)

## 总体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        浏览器 (React 18)                          │
│                                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │Dashboard │  │DigitalTwin│  │PitMonitor│  │  其他页面...      │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └─────────┬────────┘ │
│       │              │              │                   │          │
│  ┌────▼──────────────▼──────────────▼───────────────────▼──────┐ │
│  │              Zustand Store (全局状态)                         │ │
│  │  simSnapshot · pits · devices · alarms · production          │ │
│  └────┬─────────────────────────────────────────┬──────────────┘ │
│       │ REST (Axios)                              │ WebSocket      │
└───────┼───────────────────────────────────────────┼───────────────┘
        │                                           │
        │ HTTP/1.1                                  │ WS
        ▼                                           ▼
┌───────────────────────────────────────────────────────────────────┐
│                    Spring Boot 3.2.1 (port 8000)                   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    REST Controllers                          │   │
│  │  /api/v1/simulation  /api/v1/dashboard  /api/v1/pits        │   │
│  │  /api/v1/devices     /api/v1/alarms     /api/v1/production  │   │
│  └───────────────────────┬─────────────────────────────────────┘   │
│                           │                                         │
│  ┌────────────────────────▼────────────────────────────────────┐   │
│  │                      Service Layer                           │   │
│  │                                                              │   │
│  │  ┌────────────────────────────────────────────────────────┐ │   │
│  │  │  ProcessSimulationService  ← ⭐ 核心仿真引擎            │ │   │
│  │  │  @Scheduled 1 s/tick                                   │ │   │
│  │  │  · tickAGVs()        AGV 路径规划 & 装卸货             │ │   │
│  │  │  · tickEquipments()  5 设备加工速率                    │ │   │
│  │  │  · advanceFermentation()  窖池发酵推进                 │ │   │
│  │  │  · manageProductionBatch()  批次生命周期                │ │   │
│  │  │  · broadcast() → RealtimeWebSocketHandler              │ │   │
│  │  └────────────────────────────────────────────────────────┘ │   │
│  │                                                              │   │
│  │  SimulatorService   DashboardService   AlarmService          │   │
│  │  PitService         DeviceService      ProductionService     │   │
│  └────────────────────────┬─────────────────────────────────────┘  │
│                            │                                        │
│  ┌─────────────────────────▼──────────────────────────────────┐    │
│  │              Spring Data JPA + H2 File DB                   │    │
│  │  Pit · PitSensorData · Device · DeviceData                  │    │
│  │  Alarm · ProductionBatch                                    │    │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  RealtimeWebSocketHandler  →  /ws/realtime                  │   │
│  │  每 1 秒向所有订阅方广播 sim_snapshot JSON 帧               │   │
│  └─────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────┘
```

---

## 后端模块详解

### ProcessSimulationService（工艺仿真引擎）

所有工艺逻辑均在此服务内以 **内存状态** 驱动，每 1 秒推进一拍：

```
每拍执行顺序：
1. tickAGVs()           — AGV 移动、到达判定、装卸货
2. tickEquipments()     — 5 设备消耗输入 → 产出输出
3. advanceFermentation()— 窖池发酵天数 +0.0833（≈2h），阶段状态机
4. manageProductionBatch()— 批次创建/完成/产量累计
5. broadcast()          — 序列化 SimulationSnapshot → WebSocket 广播
6. persistCoreDeviceData()— 每 5 拍将设备状态写入 DB（供历史查询）
```

#### AGV 任务状态机

```
idle ──→ moving_to_source ──→ loading ──→ moving_to_dest ──→ unloading ──→ idle
         (navigate)          (fill cargo)   (navigate)        (deposit)
```

AGV 专属角色分配：

| AGV | 源 | 目的地 | 货物 |
|---|---|---|---|
| AGV-01 | A 区窖池（起糟） | 搅拌机 MX | zaopei 糟醅 |
| AGV-02 | 搅拌机 MX | 上甑机器人 RB | 拌粮 blended grain |
| AGV-03 | 上甑机器人 RB | 蒸馏塔 DL（主） | 上甑粮 |
| AGV-04 | 蒸馏塔 DL（出甑） | 摊凉机 CL | 蒸馏酒糟 |
| AGV-05 | 摊凉机 CL | B 区窖池（入池） | 摊凉粮 |
| AGV-06 | C 区窖池（起糟） | 搅拌机 MX | zaopei 糟醅 |
| AGV-07 | 上甑机器人 RB | 蒸馏塔 DL（备） | 上甑粮 |
| AGV-08 | 摊凉机 CL | D 区窖池（入池） | 摊凉粮 |

#### 设备处理速率（稳态）

| 设备 | 输入速率 | 输出速率 | 辅料 |
|---|---|---|---|
| 搅拌机 MX | 消耗 zaopei | 产出拌粮 18 kg/s | + 粉粮/稻壳自动补给 |
| 上甑机器人 RB | 消耗拌粮 20 kg/s | 输出上甑粮 | — |
| 蒸馏塔 DL | 消耗上甑粮 22 kg/s | 产出酒糟 + 摘酒 | 底锅水 0.4× |
| 摊凉机 CL | 消耗酒糟 15 kg/s | 输出摊凉粮 | 曲粉 5% |
| 输送泵 PM | — | 底锅水 10 kg/s | — |

#### 窖池阶段状态机

```
empty ──(AGV-05/08入池)──→ filling ──(装满)──→ fermenting
  ↑                                               │
  └──(AGV-01/06起糟完成)── discharging ←──(60天)──┘
                              │
                              └──(丢糟判定)──→ ready (待起糟) ──→ discharging
```

#### 发酵时间模拟

- 1 实秒 = 1 仿真 tick ≈ 2 仿真小时（`fermentDay += 1/12`）
- 60 天发酵 ≈ 720 tick ≈ **12 实分钟**
- 三类糟醅比例：红糟（第 1 轮）/ 楂醅（第 2–N 轮）/ 丢糟（尾批）

---

### 数据持久化

- 开发默认使用 **H2 文件数据库**（`./data/brewing.mv.db`），重启不丢数据
- 生产可切换 PostgreSQL：修改 `application.yml` 中 `datasource.url` 即可
- `ProcessSimulationService` 中核心仿真状态（设备 inputLevel/outputLevel、AGV 位置）均在 **内存**，不持久化到 DB；只有历史采样数据（DeviceData / PitSensorData）写入 DB

---

## 前端模块详解

### 状态管理（Zustand Store）

```typescript
// store/index.ts
{
  simSnapshot: SimulationSnapshot | null,   // WebSocket 实时快照
  pits: Pit[],                              // REST 轮询（30 s）
  devices: Device[],                        // REST 轮询（30 s）
  alarms: Alarm[],                          // REST 轮询（10 s）
  productionBatches: ProductionBatch[],     // REST 轮询（30 s）
  setSimSnapshot, setPits, ...              // setter actions
}
```

### WebSocket 连接（useWebSocket hook）

- 全局单例，App 根组件初始化，所有页面共享
- 收到 `sim_snapshot` 帧 → `setSimSnapshot(data.payload)`
- 自动重连（exponential backoff，最长 30 s）

### 3D 场景（Scene.tsx）

```
<Canvas>
  ├─ <PitModel × 100>          颜色编码 stage + type
  ├─ <DeviceModel × 5>         核心工艺设备
  ├─ <AGVModel × 8>            时间基插值动画（1200ms 窗口）
  ├─ <DistillationTower>       高塔 + 摘酒动画
  ├─ <LiquorTanks>             三联储罐 + 液位动画
  ├─ <WaterPipe>               PUMP → DL 管道
  └─ <CameraController>        OrbitControls
</Canvas>
<SceneHUDStrip>                 ← 画布外！不遮挡 3D 视野
  ├─ 全厂统计卡
  ├─ 摊凉机三段卡
  ├─ 原料仓卡
  └─ 三联储罐卡
```

#### AGV 平滑动画原理

```typescript
// AGVModel.tsx
// 每帧根据 (当前时间 - lastUpdate) / 插值窗口(1200ms) 计算 lerp 因子
const t = Math.min((now - lastUpdate) / LERP_WINDOW, 1);
position.lerpVectors(prevPos, targetPos, t);
```

- 位置抖动阈值 0.5m（低于此不更新 prevPos，避免微抖）
- 到达目的地时 `status` 切换为 `loading`/`unloading`，显示装卸动画

---

## WebSocket 消息格式

### sim_snapshot（每秒广播）

```json
{
  "type": "sim_snapshot",
  "timestamp": 1716566400000,
  "agvs": [
    {
      "id": "AGV-01",
      "x": 12.5, "z": -8.3,
      "status": "moving",
      "cargo": "zaopei",
      "cargoWeight": 450.0,
      "temperature": 32.5,
      "ph": 4.2,
      "sourcePitNo": "A-007",
      "taskPhase": "moving_to_dest"
    }
  ],
  "equipments": {
    "MIXER":    { "inputLevel": 1800, "outputLevel": 250, "running": true, "processRate": 18.0 },
    "STEAMER":  { "inputLevel": 1500, "outputLevel": 300, "running": true, "processRate": 20.0 },
    "DISTILLER":{ "inputLevel": 1200, "outputLevel": 180, "running": true, "processRate": 22.0,
                  "auxLevel": 1600, "auxCapacity": 2000 },
    "COOLER":   { "inputLevel": 900,  "outputLevel": 140, "running": true, "processRate": 15.0,
                  "stage1Temp": 80.0, "stage2Temp": 55.0, "stage3Temp": 35.0 },
    "PUMP":     { "inputLevel": 2000, "outputLevel": 400, "running": true, "processRate": 10.0 }
  },
  "pits": [
    {
      "pitNo": "A-001", "zone": "A",
      "stage": "fermenting",
      "grainType": "zaopei",
      "fermentDay": 23.5,
      "temperature": 34.2, "humidity": 68.0, "ph": 4.3, "alcoholContent": 12.5
    }
  ],
  "liquorStorage": {
    "headLiquor": 820.0, "headCapacity": 5000.0,
    "midLiquor": 6430.0, "midCapacity": 15000.0,
    "tailLiquor": 530.0, "tailCapacity": 5000.0
  },
  "rawMaterials": {
    "grainPowder": 4200.0, "grainPowderCapacity": 5000.0,
    "riceCrust": 1800.0,   "riceCrustCapacity": 3000.0,
    "starter": 1100.0,     "starterCapacity": 2000.0
  },
  "diuzaoBuffer": 320.0,
  "totalLiquorKg": 12480.0,
  "activeBatchId": "BATCH-2026-4783",
  "batchProgress": 0.728
}
```

### sensor_update（每 5 秒）

```json
{
  "type": "sensor_update",
  "pitId": "pit-A-001",
  "temperature": 34.5,
  "humidity": 68.2,
  "ph": 4.31,
  "alcoholContent": 12.6,
  "timestamp": 1716566405000
}
```

---

## 部署架构

```
                     ┌──────────────────┐
Internet  ──HTTPS──→ │   Nginx (80/443) │
                     │  reverse proxy   │
                     └─────────┬────────┘
                               │
               ┌───────────────┴────────────────┐
               │                                │
               ▼                                ▼
    ┌──────────────────┐              ┌──────────────────┐
    │  React SPA       │              │  Spring Boot     │
    │  (Nginx static)  │              │  (port 8000)     │
    │  port 3000       │              │                  │
    └──────────────────┘              └────────┬─────────┘
                                               │
                                      ┌────────▼─────────┐
                                      │  H2 File DB      │
                                      │  ./data/brewing  │
                                      └──────────────────┘
```

Docker Compose 服务：

| 服务 | 镜像 | 端口 |
|---|---|---|
| `backend` | `backend-java/Dockerfile` | 8000 |
| `frontend` | `frontend/Dockerfile` (Nginx) | 3000 |
