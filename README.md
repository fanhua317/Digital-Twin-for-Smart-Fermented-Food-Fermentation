# 🍺 酿酒数字孪生系统

基于物联网、大数据技术的智能酿酒生产全流程数字孪生平台。

## 📋 项目概述

本系统是一个完整的酿酒生产数字孪生解决方案，涵盖：

- **全流程自动化生产**：起窖转运、配料拌粮、上甑给料、馏酒冲酸、摊凉加曲、入池发酵
- **实时数据采集与监控**：100+ 窖池温度监控、50+ 设备状态监控
- **智能决策与优化**：自动分级接酒、故障预测、质量追溯、能源管理
- **数字孪生核心功能**：高精度建模、实时仿真、性能分析、虚拟调试

## 🏗️ 技术架构

### 后端 (Java Spring Boot)
- **框架**: Spring Boot 3.2.1
- **JDK**: Java 17
- **数据库**: H2 内存数据库 (开发) / PostgreSQL (生产)
- **ORM**: Spring Data JPA + Hibernate
- **实时通信**: Spring WebSocket
- **构建工具**: Maven

### 前端 (React + TypeScript)
- **框架**: React 18 + TypeScript
- **构建工具**: Vite
- **UI组件**: Ant Design 5
- **图表**: ECharts
- **状态管理**: Zustand
- **样式**: TailwindCSS

## 📁 项目结构

```
brewing-digital-twin/
├── backend-java/               # Java 后端服务
│   ├── pom.xml                # Maven 配置
│   ├── Dockerfile             # Docker 构建配置
│   └── src/main/
│       ├── java/com/brewery/digitaltwin/
│       │   ├── BrewingDigitalTwinApplication.java
│       │   ├── entity/        # JPA 实体类
│       │   │   ├── Pit.java           # 窖池
│       │   │   ├── PitSensorData.java # 窖池传感器数据
│       │   │   ├── Device.java        # 设备
│       │   │   ├── DeviceData.java    # 设备数据
│       │   │   ├── Alarm.java         # 告警
│       │   │   └── ProductionBatch.java # 生产批次
│       │   ├── repository/    # JPA 仓库
│       │   ├── service/       # 业务逻辑层
│       │   │   ├── DashboardService.java
│       │   │   ├── PitService.java
│       │   │   ├── DeviceService.java
│       │   │   ├── AlarmService.java
│       │   │   ├── ProductionService.java
│       │   │   └── SimulatorService.java # 数据模拟器
│       │   ├── controller/    # REST API 控制器
│       │   ├── dto/           # 数据传输对象
│       │   ├── config/        # 配置类
│       │   └── websocket/     # WebSocket 处理器
│       └── resources/
│           └── application.yml # 应用配置
│
├── frontend/                   # React 前端
│   ├── package.json
│   ├── vite.config.ts
│   ├── Dockerfile             # Docker 构建配置
│   ├── nginx.conf             # Nginx 生产环境配置
│   └── src/
│       ├── App.tsx
│       ├── pages/             # 页面组件
│       │   ├── Dashboard.tsx  # 仪表盘
│       │   ├── PitMonitor.tsx # 窖池监控
│       │   ├── DeviceMonitor.tsx # 设备监控
│       │   ├── AlarmCenter.tsx   # 告警中心
│       │   └── ProductionManage.tsx # 生产管理
│       ├── components/        # 通用组件
│       ├── services/          # API 服务
│       ├── stores/            # Zustand 状态管理
│       └── hooks/             # 自定义 Hooks
│
├── README.md
├── docker-compose.yml          # Docker 编排配置
└── .gitignore
```

## 🚀 快速开始

### 环境要求

- JDK 17+
- Node.js 18+
- Maven 3.9+

### 后端启动

```bash
# 进入后端目录
cd backend-java

# 编译项目
mvn package -DskipTests

# 运行服务器
java -jar target/digital-twin-1.0.0.jar

# 服务器将在 http://localhost:8000 启动
```

### 前端启动

```bash
# 进入前端目录
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 前端将在 http://localhost:3000 启动
```

### Docker 启动 (推荐)

如果你安装了 Docker 和 Docker Compose，可以使用以下命令一键启动整个系统：

```bash
# 在项目根目录下运行
docker-compose up --build
```

- 后端 API: `http://localhost:8000`
- 前端界面: `http://localhost:3000` (通过 Nginx 转发)
- H2 控制台: `http://localhost:8000/h2-console`

## 📡 API 接口

### Dashboard API
- `GET /api/v1/dashboard/stats` - 获取仪表盘统计数据
- `GET /api/v1/dashboard/overview` - 获取概览数据
- `GET /api/v1/dashboard/heatmap` - 获取热力图数据
- `GET /api/v1/dashboard/system-info` - 获取系统信息

### 窖池 API
- `GET /api/v1/pits` - 获取所有窖池
- `GET /api/v1/pits/stats` - 获取窖池统计
- `GET /api/v1/pits/heatmap` - 获取窖池热力图
- `GET /api/v1/pits/{id}` - 获取单个窖池详情
- `GET /api/v1/pits/{id}/sensors` - 获取窖池传感器数据

### 设备 API
- `GET /api/v1/devices` - 获取所有设备
- `GET /api/v1/devices/stats` - 获取设备统计
- `GET /api/v1/devices/types` - 获取设备类型列表
- `GET /api/v1/devices/{id}` - 获取单个设备详情
- `GET /api/v1/devices/{id}/data` - 获取设备运行数据

### 告警 API
- `GET /api/v1/alarms` - 获取所有告警
- `GET /api/v1/alarms/active` - 获取活跃告警
- `PUT /api/v1/alarms/{id}/resolve` - 处理告警

### 生产 API
- `GET /api/v1/production/batches` - 获取生产批次
- `POST /api/v1/production/batches` - 创建生产批次
- `PUT /api/v1/production/batches/{id}/start` - 开始生产
- `PUT /api/v1/production/batches/{id}/complete` - 完成生产

### WebSocket
- `ws://localhost:8000/ws/realtime` - 实时数据推送

## 🎯 核心功能

### 1. 仪表盘 (Dashboard)
- 实时监控窖池和设备状态
- 温湿度热力图展示
- 生产统计趋势图
- 告警信息实时推送

### 2. 窖池监控 (Pit Monitor)
- 100 个窖池的实时温度/湿度/PH值监控
- 窖池状态可视化（正常/警告/告警）
- 发酵天数追踪
- 历史数据查询

### 3. 设备监控 (Device Monitor)
- 50+ 设备运行状态监控
- 功率、转速、振动等参数监控
- 设备故障预警
- 维护记录管理

### 4. 告警中心 (Alarm Center)
- 多级别告警管理（紧急/严重/一般/提示）
- 告警处理流程
- 告警历史记录
- 告警统计分析

### 5. 生产管理 (Production)
- 生产批次管理
- 生产进度跟踪
- 质量评分
- 产量统计

## 🔧 配置说明

### 后端配置 (application.yml)

```yaml
server:
  port: 8000

spring:
  datasource:
    url: jdbc:h2:mem:brewing
    driver-class-name: org.h2.Driver
    
app:
  total-pits: 100
  total-devices: 50
  simulator:
    enabled: true
    interval: 5000  # 数据生成间隔 (毫秒)
```

## 📝 开发说明

### 数据模拟
系统内置数据模拟器 (SimulatorService)，每 5 秒自动生成：
- 随机窖池传感器数据（温度、湿度、PH值等）
- 随机设备运行数据（功率、转速、振动等）
- 通过 WebSocket 实时推送到前端

### 数据库
开发环境使用 H2 内存数据库，数据在服务重启后会重置。
生产环境建议配置 PostgreSQL 或 MySQL。

## 📄 License

MIT License
