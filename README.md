# 🍺 浓香型白酒酿造数字孪生系统

> 基于 物联网 · 工艺仿真 · 实时 3D 可视化 的智能酿酒数字孪生平台

[English](./README_EN.md) · [架构说明](./docs/ARCHITECTURE.md) · [功能清单](./docs/FEATURES.md) · [API 文档](./docs/API.md)

![tech](https://img.shields.io/badge/backend-Spring%20Boot%203.2-green) ![tech](https://img.shields.io/badge/frontend-React%2018%20%2B%20TS-blue) ![tech](https://img.shields.io/badge/3D-Three.js%20%2B%20R3F-orange) ![tech](https://img.shields.io/badge/realtime-WebSocket-purple) ![license](https://img.shields.io/badge/license-MIT-lightgrey)

## 📋 项目概述

本系统对应 **浓香型白酒酿造** 全工艺链路进行数字孪生建模，覆盖：

### 🏭 工艺主链路（5 设备 + 8 AGV + 100 窖池）

```
A 区窖池 ─ AGV-01 ─┐                                                ┌─ AGV-05 → B 区窖池
                    ├→ 搅拌机 → 上甑机器人 → 蒸馏塔 → 摊凉机 ─→ ┤
C 区窖池 ─ AGV-06 ─┘   (AGV-02)   (AGV-03/07)  (AGV-04)            └─ AGV-08 → D 区窖池
                       拌粮转运    上甑给料·主备   出甑转运
                                              ↑
                                     输送泵 PUMP (底锅水回水循环)
```

| 工艺环节 | 设备 | AGV | 物料 |
|---|---|---|---|
| ① 起糟（A/C 区） | — | AGV-01 / AGV-06 | 出窖糟醅 |
| ② 配料拌粮 | 搅拌机 MX-001 | AGV-02 转运 | + 粉粮 33% + 稻壳 8% |
| ③ 上甑给料 | 上甑机器人 RB-001 | AGV-03 / AGV-07 | 上甑粮 |
| ④ 馏酒分级 | 蒸馏塔 DL-001 | — | 头酒 5% / 中段 85% / 尾酒 10% |
| ⑤ 出甑转运 | — | AGV-04 | 蒸馏酒糟 (85°C) |
| ⑥ 摊凉加曲 | 摊凉机 CL-001 | — | + 曲粉 5%，三段冷却 |
| ⑦ 入池发酵（B/D 区） | — | AGV-05 / AGV-08 | 入池粮 → 60 天发酵 |
| ⓘ 底锅水循环 | 输送泵 PM-001 | — | PUMP → 蒸馏塔辅料槽 |

### 📊 核心特性

- 🎮 **3D 实时数字孪生场景** — Three.js + R3F 渲染，100 窖池 / 5 设备 / 8 AGV 全部动态可视化
- 🔄 **工艺仿真器** — 后端 1 秒一拍的 ProcessSimulationService，物料严格守恒，发酵 60 天 ≈ 12 实分钟
- 📡 **WebSocket 实时推送** — sim_snapshot 每秒广播，前端零延迟同步
- 🛢️ **自动分级摘酒** — 头/中/尾三联储罐，达 90% 自动放空模拟出厂灌装
- 🌾 **原料自动补给** — 粉粮/稻壳/曲粉仓低于 30% 自动补到 95%
- 🚨 **多级告警中心** — 温度异常 / pH 偏离 / 设备故障实时推送
- 📈 **OEE 性能分析** — 设备综合效率、能耗、出酒率实时计算
- 🎨 **苹果液态玻璃 UI** — 暗色主题 + 高斯模糊 + 圆角，沉浸式工控大屏体验

## 🏗️ 技术架构

### 后端 (`backend-java/`)

| 类别 | 技术栈 | 版本 |
|---|---|---|
| 框架 | Spring Boot | 3.2.1 |
| JDK | OpenJDK | 17 |
| ORM | Spring Data JPA + Hibernate | 内置 |
| 数据库 | H2 文件数据库 (开发) / PostgreSQL (生产可切换) | 2.x |
| 实时通信 | Spring WebSocket | 内置 |
| 构建 | Maven | 3.9+ |
| 日志/工具 | Lombok / SLF4J | 内置 |

### 前端 (`frontend/`)

| 类别 | 技术栈 | 版本 |
|---|---|---|
| 框架 | React + TypeScript | 18 / 5.3 |
| 构建 | Vite | 5 |
| UI 组件 | Ant Design | 5 |
| 3D 渲染 | Three.js + @react-three/fiber + @react-three/drei | 0.182 / 8.18 / 9.122 |
| 图表 | ECharts + echarts-for-react | 5.4 |
| 状态管理 | Zustand | 4 |
| 样式 | TailwindCSS | 3.4 |
| HTTP | Axios | 1.6 |

## 📁 项目结构

```
Digital-Twin-for-Smart-Fermented-Food-Fermentation/
├── backend-java/                          # Java 后端
│   ├── pom.xml                            # Maven 配置
│   ├── Dockerfile
│   └── src/main/
│       ├── java/com/brewery/digitaltwin/
│       │   ├── BrewingDigitalTwinApplication.java
│       │   ├── entity/                    # JPA 实体类
│       │   │   ├── Pit.java               # 窖池 (100 个)
│       │   │   ├── PitSensorData.java     # 窖池传感器历史
│       │   │   ├── Device.java            # 设备 (53 个 = 5 核心 + 8 AGV + 40 辅助)
│       │   │   ├── DeviceData.java        # 设备运行数据
│       │   │   ├── Alarm.java             # 告警
│       │   │   └── ProductionBatch.java   # 生产批次
│       │   ├── repository/                # Spring Data JPA 仓库
│       │   ├── service/
│       │   │   ├── ProcessSimulationService.java  # ⭐ 工艺主仿真器 (1s/tick)
│       │   │   ├── SimulatorService.java          # 辅助设备数据生成
│       │   │   ├── DashboardService.java          # 综合监控聚合
│       │   │   ├── PitService.java
│       │   │   ├── DeviceService.java
│       │   │   ├── AlarmService.java
│       │   │   └── ProductionService.java
│       │   ├── controller/                # REST API
│       │   │   ├── SimulationController.java      # 工艺快照 / pause / resume / reset
│       │   │   ├── DashboardController.java
│       │   │   ├── PitController.java
│       │   │   ├── DeviceController.java
│       │   │   ├── AlarmController.java
│       │   │   └── ProductionController.java
│       │   ├── dto/                        # DTO (SimulationSnapshot 等)
│       │   ├── config/                     # 配置 + DataInitializer
│       │   └── websocket/                  # RealtimeWebSocketHandler
│       └── resources/
│           └── application.yml
│
├── frontend/                               # React 前端
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── Dockerfile
│   ├── nginx.conf
│   └── src/
│       ├── App.tsx
│       ├── pages/
│       │   ├── Dashboard.tsx               # 综合监控中心 (实时同步)
│       │   ├── DigitalTwin.tsx             # 数字孪生主页 (3D 车间概览 + 仿真模拟)
│       │   ├── PitMonitor.tsx              # 100 窖池监控 + 详情弹窗 (13 工艺参数)
│       │   ├── DeviceMonitor.tsx           # 53 设备监控 + 历史曲线
│       │   ├── AlarmCenter.tsx             # 告警中心
│       │   └── ProductionManage.tsx        # 生产批次管理
│       ├── components/
│       │   ├── 3d/
│       │   │   ├── Scene.tsx               # ⭐ 3D 主场景 + SceneHUDStrip
│       │   │   ├── PitModel.tsx            # 100 池实例化模型
│       │   │   ├── DeviceModel.tsx         # 5 核心设备模型
│       │   │   ├── AGVModel.tsx            # 8 AGV 时间基插值动画
│       │   │   ├── DistillationTower.tsx
│       │   │   ├── LiquorTanks.tsx         # 头/中/尾三联储罐
│       │   │   ├── WaterPipe.tsx           # 输送泵→蒸馏塔管道
│       │   │   ├── SimulationController.tsx # 7 步工艺导览 + 控制条
│       │   │   ├── CameraController.tsx
│       │   │   └── PerformanceAnalysis.tsx # OEE / 能耗 / 出酒率
│       │   └── SimulationPanel.tsx         # 实时数据面板
│       ├── services/api.ts                 # REST API 封装
│       ├── store/index.ts                  # Zustand store
│       └── hooks/useWebSocket.ts           # 共享 WS 单例 hook
│
├── docs/
│   ├── ARCHITECTURE.md                     # 系统架构详解
│   ├── FEATURES.md                         # 功能清单
│   ├── API.md                              # API 完整文档
│   ├── task.md                             # 项目演进任务记录
│   ├── 总体修改说明.md
│   ├── 修改清单.md
│   └── UI-苹果液态设计规范.md
│
├── README.md                               # 本文件 (中文主版)
├── README_EN.md                            # English version
├── docker-compose.yml                      # 一键启动
└── .gitignore
```

## 🚀 快速开始

### 环境要求

| 工具 | 最低版本 | 备注 |
|---|---|---|
| JDK | 17 | OpenJDK / Eclipse Temurin 均可 |
| Maven | 3.9 | 或使用项目内 `mvnw` |
| Node.js | 18 LTS | npm 9+ 随附 |

### 方式一：手动启动（开发）

```bash
# ① 启动后端 (终端 1)
cd backend-java
mvn package -DskipTests
java -jar target/digital-twin-1.0.0.jar
# → http://localhost:8000

# ② 启动前端 (终端 2)
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

> H2 数据库控制台：http://localhost:8000/h2-console  
> JDBC URL: `jdbc:h2:file:./data/brewing` · 用户名/密码均为空

### 方式二：Docker 一键启动（生产/演示）

```bash
docker-compose up --build
```

- 前端：`http://localhost:3000`
- 后端 API：`http://localhost:8000`
- H2 控制台：`http://localhost:8000/h2-console`

### 仿真操控说明

| 操作 | 地址 / 方法 |
|---|---|
| 暂停仿真 | `POST /api/v1/simulation/pause` |
| 继续仿真 | `POST /api/v1/simulation/resume` |
| 重置仿真 | `POST /api/v1/simulation/reset` |
| 获取实时快照 | `GET /api/v1/simulation/snapshot` |
| WebSocket 实时流 | `ws://localhost:8000/ws/realtime` → `sim_snapshot` 帧 |

## 🎯 功能页面

### 1. 📊 综合监控中心 (Dashboard)
- **4 个实时 KPI**：窖池总数 / 设备总数 / 活跃告警 / 累计产量（WebSocket 实时同步）
- 窖池阶段分布、设备状态分布饼图
- 24 小时告警趋势折线图
- 生产批次进度条（actualVolume / targetVolume 实时更新）

### 2. 🏭 数字孪生 (Digital Twin)
- **3D 车间全景** — 100 窖池 + 5 核心设备 + 8 AGV，OrbitControls 自由旋转缩放
- **仿真模拟页** — 7 步工艺导览（起糟 → 配料 → 上甑 → 蒸馏 → 出甑 → 摊凉加曲 → 入池发酵）
- **实时 HUD 条**（画布外，不遮挡 3D 视角）：全厂总览 / 摊凉机三段 / 原料三仓 / 三联储罐
- **AGV 气泡标签**：显示任务状态、货物类型、重量、温度、pH、来源窖池
- **性能分析面板**：OEE / 可用率 / 能耗效率 / 出酒率实时图表

### 3. 🕳️ 窖池监控 (Pit Monitor)
- 100 池卡片列表，按状态着色（空池 / 入池中 / 发酵中 / 待起糟 / 起糟中）
- 过滤 / 排序 / 搜索
- 点击查看详情弹窗：13 项工艺参数 + 温湿度 pH 历史折线图

### 4. ⚙️ 设备监控 (Device Monitor)
- 5 核心设备 + 8 AGV + 40 辅助设备全览
- 单设备详情：运行数据历史、告警历史
- 状态色卡：运行 / 停机 / 维护 / 故障

### 5. 🔔 告警中心 (Alarm Center)
- 多级别告警（CRITICAL / WARNING / INFO）
- 一键处理 / 批量操作
- 告警历史与统计

### 6. 📦 生产管理 (Production Manage)
- 批次列表（在产 / 已完成）、进度百分比
- 手动创建 / 完成批次
- 产量趋势、质量评分

## 📡 REST API 速查

> 完整文档见 [docs/API.md](./docs/API.md)

| 模块 | 方法 | 路径 | 说明 |
|---|---|---|---|
| **仿真** | GET | `/api/v1/simulation/snapshot` | 工艺快照（AGV / 设备 / 窖池 / 储罐） |
| **仿真** | POST | `/api/v1/simulation/pause` | 暂停 |
| **仿真** | POST | `/api/v1/simulation/resume` | 继续 |
| **仿真** | POST | `/api/v1/simulation/reset` | 重置 |
| **Dashboard** | GET | `/api/v1/dashboard/stats` | 全厂统计 KPI |
| **Dashboard** | GET | `/api/v1/dashboard/overview` | 概览（生产进度 / 设备效率） |
| **窖池** | GET | `/api/v1/pits` | 所有窖池列表 |
| **窖池** | GET | `/api/v1/pits/{id}/sensors` | 单池传感器历史 |
| **设备** | GET | `/api/v1/devices` | 所有设备列表 |
| **设备** | GET | `/api/v1/devices/{id}/data` | 设备运行历史 |
| **告警** | GET | `/api/v1/alarms/active` | 当前活跃告警 |
| **告警** | PUT | `/api/v1/alarms/{id}/resolve` | 处理告警 |
| **生产** | GET | `/api/v1/production/batches` | 批次列表 |

**WebSocket** `ws://localhost:8000/ws/realtime`

```json5
// 每 1 秒推送一帧 sim_snapshot
{
  "type": "sim_snapshot",
  "agvs": [ { "id":"AGV-01", "x":12.5, "z":-8.3, "status":"moving", "cargo":"grain", ... } ],
  "equipments": { "MIXER":{"inputLevel":1800,"outputLevel":250,"running":true}, ... },
  "pits": [ { "pitNo":"A-001", "stage":"fermenting", "fermentDay":23, ... } ],
  "liquorStorage": { "headLiquor":820, "midLiquor":6430, "tailLiquor":530 },
  "rawMaterials": { "grainPowder":4200, "riceCrust":1800, "starter":1100 }
}
```

## 🔧 关键配置

```yaml
# backend-java/src/main/resources/application.yml
server:
  port: 8000

spring:
  datasource:
    url: jdbc:h2:file:./data/brewing   # 文件型 H2，重启数据保留
    username: sa
    password:
  h2:
    console:
      enabled: true                    # http://localhost:8000/h2-console

app:
  simulation:
    tick-interval-ms: 1000             # 仿真推进间隔
    ferment-days-per-tick: 0.0833      # 1 tick ≈ 2 小时仿真时间
```

## �️ 仿真参数速查

| 参数 | 值 | 说明 |
|---|---|---|
| 窖池总数 | 100（A/B/C/D 各 25） | A/C 起糟区，B/D 入池区 |
| AGV 数量 | 8 | 各有专属任务角色 |
| 设备数量 | 5 核心 + 8 AGV + 40 辅助 | 共 53 |
| 仿真速率 | 1 实秒 ≈ 2 仿真小时 | 60 天发酵 ≈ 12 实分钟 |
| 蒸馏出酒率 | 30% | 头 5% / 中 85% / 尾 10% |
| 摊凉加曲量 | 5% | 三段降温 85°C → 60°C → 35°C |
| 液罐放空阈值 | 90% → 30% | 模拟出厂灌装 |
| 原料补给阈值 | 30% → 95% | 粉粮 / 稻壳 / 曲粉 |

## 📄 License

MIT License — 可自由用于学术研究、大创竞赛、二次开发。
