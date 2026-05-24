# API 完整文档

[← 返回 README](../README.md)

> Base URL: `http://localhost:8000`  
> 所有 REST 响应均封装为 `ApiResponse<T>`：
> ```json
> { "success": true, "message": "success", "data": <T> }
> ```
> - `success: true`  → 返回业务数据 `data`
> - `success: false` → `message` 为错误描述
>
> 前端 `api.ts` 的 axios 响应拦截器会自动解包，业务代码直接拿到 `data` 字段。

---

## 🔄 工艺仿真 API

### GET `/api/v1/simulation/snapshot`

获取当前完整工艺快照（AGV 状态 / 设备状态 / 窖池状态 / 储罐 / 原料）。

**响应示例：**
```json
{
  "success": true,
  "message": "success",
  "data": {
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
        "taskPhase": "moving_to_dest",
        "targetX": 5.0, "targetZ": 0.0
      }
    ],
    "equipments": {
      "MIXER":     { "inputLevel": 1800, "outputLevel": 250,  "running": true, "processRate": 18.0 },
      "STEAMER":   { "inputLevel": 1500, "outputLevel": 300,  "running": true, "processRate": 20.0 },
      "DISTILLER": { "inputLevel": 1200, "outputLevel": 180,  "running": true, "processRate": 22.0,
                     "auxLevel": 1600,   "auxCapacity": 2000 },
      "COOLER":    { "inputLevel": 900,  "outputLevel": 140,  "running": true, "processRate": 15.0,
                     "stage1Temp": 80.0, "stage2Temp": 55.0,  "stage3Temp": 35.0 },
      "PUMP":      { "inputLevel": 2000, "outputLevel": 400,  "running": true, "processRate": 10.0 }
    },
    "pits": [
      {
        "pitNo": "A-001", "zone": "A",
        "stage": "fermenting",
        "grainType": "zaopei",
        "fermentDay": 23.5,
        "temperature": 34.2, "humidity": 68.0,
        "ph": 4.3, "alcoholContent": 12.5
      }
    ],
    "liquorStorage": {
      "headLiquor": 820.0,  "headCapacity": 5000.0,
      "midLiquor":  6430.0, "midCapacity":  15000.0,
      "tailLiquor": 530.0,  "tailCapacity": 5000.0
    },
    "rawMaterials": {
      "grainPowder": 4200.0, "grainPowderCapacity": 5000.0,
      "riceCrust":   1800.0, "riceCrustCapacity":   3000.0,
      "starter":     1100.0, "starterCapacity":     2000.0
    },
    "diuzaoBuffer":   320.0,
    "totalLiquorKg":  12480.0,
    "activeBatchId":  "BATCH-2026-4783",
    "batchProgress":  0.728
  }
}
```

---

### GET `/api/v1/simulation/equipments`

仅返回设备状态 Map（用于轻量轮询）。

---

### GET `/api/v1/simulation/agvs`

仅返回 AGV 状态列表。

---

### POST `/api/v1/simulation/pause`

暂停仿真推进（停止 @Scheduled tick）。

**响应：** `{ "paused": true }`

---

### POST `/api/v1/simulation/resume`

继续仿真。

**响应：** `{ "paused": false }`

---

### POST `/api/v1/simulation/reset`

重置仿真（清空所有内存状态，重新初始化）。

**响应：** `{ "reset": true, "paused": false }`

---

## 📊 Dashboard API

### GET `/api/v1/dashboard/stats`

全厂统计 KPI。

**响应：**
```json
{
  "data": {
    "totalPits": 100,
    "normalPits": 100,
    "totalDevices": 53,
    "runningDevices": 21,
    "activeAlarms": 15,
    "criticalAlarms": 3,
    "warningAlarms": 4,
    "totalProduction": 7443.0,
    "avgTemperature": 23.5,
    "pitStageDistribution": {
      "empty": 17, "filling": 5, "fermenting": 3,
      "ready": 73, "discharging": 2
    },
    "pitTypeDistribution": {
      "zaopei": 71, "hongzao": 25, "diuzao": 4
    },
    "deviceStatusDistribution": {
      "running": 21, "stopped": 15, "maintenance": 10, "fault": 5
    }
  }
}
```

---

### GET `/api/v1/dashboard/overview`

概览数据（生产进度 / 设备效率）。

---

### GET `/api/v1/dashboard/heatmap`

窖池温湿度热力图数据（100 × 3 矩阵）。

---

### GET `/api/v1/dashboard/system-info`

系统信息（版本 / 运行时间 / JVM 信息）。

---

## 🕳️ 窖池 API

### GET `/api/v1/pits`

所有窖池列表。

**查询参数：**

| 参数 | 类型 | 说明 |
|---|---|---|
| `zone` | string | 过滤区域（A/B/C/D） |
| `status` | string | 过滤状态 |
| `page` | int | 页码（0-based） |
| `size` | int | 每页数量（默认 20） |

**响应（单条窖池）：**
```json
{
  "id": "pit-A-001",
  "pitNo": "A-001",
  "zone": "A",
  "status": "normal",
  "stage": "fermenting",
  "grainType": "zaopei",
  "fermentDay": 23,
  "temperature": 34.2,
  "humidity": 68.0,
  "ph": 4.3,
  "alcoholContent": 12.5,
  "co2Concentration": 2.1,
  "createdAt": "2024-01-15T08:00:00"
}
```

---

### GET `/api/v1/pits/stats`

窖池统计（各阶段数量 / 各类型数量 / 平均温度）。

---

### GET `/api/v1/pits/heatmap`

窖池热力图（返回温度矩阵，用于 ECharts heatmap）。

---

### GET `/api/v1/pits/{id}`

单池详情（13 项工艺参数）。

---

### GET `/api/v1/pits/{id}/sensors`

单池传感器历史数据。

**查询参数：**

| 参数 | 类型 | 说明 |
|---|---|---|
| `days` | int | 历史天数（默认 7） |

---

## ⚙️ 设备 API

### GET `/api/v1/devices`

所有设备列表。

**查询参数：**

| 参数 | 类型 | 说明 |
|---|---|---|
| `type` | string | 设备类型过滤 |
| `status` | string | 状态过滤 |

**响应（单条设备）：**
```json
{
  "id": "device-DL-001",
  "deviceCode": "DL-001",
  "name": "蒸馏塔",
  "type": "distiller",
  "status": "running",
  "location": "中央工艺区",
  "manufacturer": "仁怀设备厂",
  "model": "DL-5000",
  "lastMaintenance": "2024-01-01T08:00:00",
  "nextMaintenance": "2024-07-01T08:00:00"
}
```

---

### GET `/api/v1/devices/stats`

设备统计（各状态数量 / 各类型数量）。

---

### GET `/api/v1/devices/types`

设备类型枚举列表。

---

### GET `/api/v1/devices/{id}`

单设备详情。

---

### GET `/api/v1/devices/{id}/data`

设备运行历史数据（功率 / 转速 / 振动 / 温度等）。

**查询参数：**

| 参数 | 类型 | 说明 |
|---|---|---|
| `hours` | int | 历史小时数（默认 24） |

---

## 🔔 告警 API

### GET `/api/v1/alarms`

所有告警列表（含历史）。

**查询参数：**

| 参数 | 类型 | 说明 |
|---|---|---|
| `level` | string | CRITICAL / WARNING / INFO |
| `status` | string | active / resolved |
| `page` | int | 页码 |
| `size` | int | 每页数量 |

**响应（单条告警）：**
```json
{
  "id": "alarm-001",
  "deviceId": "pit-A-025",
  "deviceName": "pit-A-025",
  "level": "WARNING",
  "type": "TEMPERATURE_HIGH",
  "message": "温度超过上限阈值",
  "value": 42.5,
  "threshold": 40.0,
  "status": "active",
  "createdAt": "2024-01-15T01:25:22",
  "resolvedAt": null
}
```

---

### GET `/api/v1/alarms/active`

当前活跃告警（status = active）。

---

### GET `/api/v1/alarms/trend`

24 小时告警趋势（按小时统计各级别数量）。

---

### PUT `/api/v1/alarms/{id}/resolve`

处理单条告警（status → resolved）。

---

## 📦 生产批次 API

### GET `/api/v1/production/batches`

批次列表。

**查询参数：**

| 参数 | 类型 | 说明 |
|---|---|---|
| `status` | string | in_progress / completed |
| `page` | int | 页码 |
| `size` | int | 每页数量 |

**响应（单条批次）：**
```json
{
  "id": "BATCH-2026-4783",
  "batchCode": "BATCH-2026-4783",
  "liquorType": "浓香型白酒",
  "status": "in_progress",
  "targetVolume": 500.0,
  "actualVolume": 364.2,
  "progress": 0.728,
  "qualityScore": 92.5,
  "startTime": "2024-01-15T00:00:00",
  "endTime": null
}
```

---

### POST `/api/v1/production/batches`

创建新批次。

**请求体：**
```json
{
  "liquorType": "浓香型白酒",
  "targetVolume": 500.0
}
```

---

### PUT `/api/v1/production/batches/{id}/start`

开始批次生产（status → in_progress）。

---

### PUT `/api/v1/production/batches/{id}/complete`

手动完成批次（status → completed）。

---

## 📡 WebSocket

**端点：** `ws://localhost:8000/ws/realtime`

连接后，后端每秒推送以下帧：

| 帧类型 | 频率 | 说明 |
|---|---|---|
| `sim_snapshot` | 1 s | 完整工艺快照（见上方 JSON 示例） |
| `sensor_update` | 5 s | 单池传感器采样更新 |
| `alarm_event` | 事件触发 | 新告警 / 告警处理通知 |

**前端订阅示例（TypeScript）：**

```typescript
const ws = new WebSocket('ws://localhost:8000/ws/realtime');

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  switch (msg.type) {
    case 'sim_snapshot':
      store.setSimSnapshot(msg.data);
      break;
    case 'sensor_update':
      store.updatePitSensor(msg.data);
      break;
    case 'alarm_event':
      store.addAlarm(msg.data);
      break;
  }
};
```

---

## HTTP 状态码

| 状态码 | 说明 |
|---|---|
| 200 | 成功（业务结果在响应体 `success` 字段） |
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

业务级错误（参数校验失败、状态非法等）：HTTP 仍为 200，但响应体 `success: false`，详情在 `message`。
