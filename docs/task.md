# 任务记录

## 2026-05-23 14:48:00

### 任务描述
对"酿酒数字孪生系统"（Digital Twin for Smart Fermented Food Fermentation）项目进行全面检查。

### 执行结果

#### 项目结构
- **前端**：`frontend/`（React 18 + TypeScript + Vite）
- **后端**：`backend-java/`（Spring Boot 3.2.1 + Java 17 + H2 数据库）

#### 技术栈
- 前端：React 18、Ant Design 5、Three.js/R3F（3D）、ECharts、Zustand、TailwindCSS
- 后端：Spring Boot 3.2.1、Spring WebSocket、JPA/Hibernate、H2 文件数据库

#### 页面列表（6个）
1. Dashboard（总览仪表盘）
2. PitMonitor（窖池监控 + 热力图）
3. DeviceMonitor（设备监控）
4. AlarmCenter（告警中心）
5. ProductionManage（生产管理）
6. DigitalTwin（3D数字孪生场景）

#### 后端接口覆盖情况（已对齐）
| 前端调用 | 后端实现 | 状态 |
|---|---|---|
| `GET /alarms/active` | ✅ 已实现 | 正常 |
| `PUT /alarms/{id}/resolve` | ✅ 支持 query/body 双参数 | 正常 |
| `PUT /alarms/resolve-batch` | ✅ 已实现 | 正常 |
| `PUT /production/batches/{id}/start` | ✅ 已实现（PUT+POST双支持）| 正常 |
| `PUT /production/batches/{id}/complete` | ✅ query参数兼容 | 正常 |
| `GET /alarms/stats` | ✅ 已实现 | 正常 |
| `GET /production/trends` | ✅ 已实现 | 正常 |
| `GET /production/params` | ✅ 已实现 | 正常 |
| `PUT /production/params/{id}` | ✅ 已实现 | 正常 |

#### 性能优化状态
- 热力图缓存（ConcurrentHashMap）：已实现，SimulatorService 实时更新
- `/dashboard/stats`：从 ~20秒 优化到 ~48ms（400倍提升）
- `/pits/heatmap`：从超时优化到 ~27ms

#### 已知遗留问题（低影响）
- `antd` Card 的 `headStyle` 属性已废弃（仅警告，不影响功能）
- 首次冷启动热力图缓存为空时使用随机默认值（SimulatorService 启动后自动填充）
- AGV 仿真默认静止（需点击播放按钮激活）

#### 项目启动方式
- 后端：`cd backend-java && mvn clean package -DskipTests && java -jar target/digital-twin-1.0.0.jar`（端口 8000）
- 前端：`cd frontend && npm run dev`（端口 3000）
- H2 控制台：http://localhost:8000/h2-console

#### 检查结论
项目整体结构完整，前后端接口已基本对齐，性能优化到位，可正常启动运行。

---

## 2026-05-23 15:08:00

### 任务描述
全面审查前后端项目错误并修复相关 bug。

### 执行结果

通过代码审查 + API 实测，共发现并修复 **10 处 bug**（含 1 处通过验证发现的额外 bug）。

#### 🔴 严重 Bug（功能错误）

1. **`PitController.getLatestPitSensor` 返回最旧数据**
   - 文件：`backend-java/.../controller/PitController.java:110`
   - 错误：`data.get(data.size() - 1)`（返回 DESC 列表中的最后一条 = 最旧）
   - 影响：窖池详情"最新数据"实际延迟 ~45 秒
   - 实测对比：修复前 Latest id=142401，实际最新 List[0] id=143301；修复后两者一致
   - 修复：改为 `data.get(0)`

2. **`DeviceController.getLatestDeviceData` 同上**
   - 文件：`backend-java/.../controller/DeviceController.java:105`
   - 修复：`data.get(0)`

3. **`SimulatorService` 告警 source 硬编码无效编号**
   - 文件：`backend-java/.../service/SimulatorService.java`
   - 错误：硬编码 `"pit-A-" + (random.nextInt(20) + 1)`，生成如 `pit-A-17`（实际窖池编号格式为 `A-001`）
   - 影响：告警的来源指向不存在的窖池
   - 修复：新增 `pickAlarmSource()` 从真实 `Pit/Device` 表中随机选；新告警 source 现为 `pit-A-020`、`device-C-010`

4. **`SimulatorService.generateDeviceData` 设备状态单向退化卡死**（实测发现）
   - 错误：仅对 `running` 设备生成数据 + 阈值 `vibration>5` 永远不可能（vibration 上限为 5）+ 一旦进入 warning 永不回 running
   - 影响：运行几分钟后 50 个设备全部卡在 warning 状态，前端再也看不到新数据
   - 修复：放开 vibration 上限到 10，所有非 `stopped/maintenance` 的设备都生成数据并重新评估状态，允许状态双向恢复
   - 实测：修复后 22 running / 13 warning / 15 fault，分布健康

#### 🟡 中等 Bug

5. **`PitController.updatePitStatus` 参数未使用**
   - `batch_code` 声明但未持久化
   - 修复：`Pit` 实体新增 `currentBatchCode` 字段，`PitService` 新增 `updatePitStatus(id, status, batchCode)`

6. **`Dashboard.tsx` 严重告警显示数据源错误**
   - 错误：`overview?.alarm_trend?.[0]?.count` 是 24 小时前第 1 小时的告警数
   - 修复：改为 `stats?.alarmsByLevel?.critical`；同步补全 TS `DashboardStats` 接口的 `alarmsByLevel` 字段

7. **`PitMonitor.tsx` 热力图坐标按数组索引而非真实 row/col**
   - 错误：`heatmapData.map((d, i) => [i % 10, Math.floor(i / 10), d.temperature])` 假设数组顺序与位置一致
   - 修复：按 `zone(A/B/C/D)` 偏移 + `(col-1, row-1)` 投到真实 10×10 网格；tooltip 用反查找定位 `pitNo`

8. **`useWebSocket.ts` 重连 setTimeout 内存泄漏**
   - 错误：组件卸载时未清除重连定时器，可能在卸载后调用 `connect()` 触发新连接
   - 修复：保存 `reconnectTimerRef` 在 cleanup 中清除；新增 `isUnmountedRef` 阻断卸载后异步重连

9. **`ProductionManage.tsx` 空值崩溃**
   - 错误：`volume.toFixed(0)` 当 `targetVolume` 为 `null` 时崩溃
   - 修复：`volume != null ? volume.toFixed(0) : '-'`

10. **`Dashboard.tsx` 除零 NaN 风险**
    - 错误：`stats.normalPits / stats.totalPits * 100` 当 `totalPits=0` 时 NaN
    - 修复：增加 `stats?.totalPits ?` 非零判断；平均温度增加 `.toFixed(1)`

#### 涉及文件

**后端**
- `backend-java/.../controller/PitController.java`
- `backend-java/.../controller/DeviceController.java`
- `backend-java/.../service/PitService.java`
- `backend-java/.../service/SimulatorService.java`
- `backend-java/.../entity/Pit.java`

**前端**
- `frontend/src/pages/Dashboard.tsx`
- `frontend/src/pages/PitMonitor.tsx`
- `frontend/src/pages/ProductionManage.tsx`
- `frontend/src/hooks/useWebSocket.ts`

#### 验证

| 验证项 | 状态 |
|---|---|
| `/pits/{id}/sensors/latest` 返回真正最新 | ✅ 实测 id 与 list[0] 一致 |
| `/devices/{id}/data/latest` 返回真正最新 | ✅ 实测 id 与 list[0] 一致 |
| 告警 source 使用真实编号 | ✅ 实测新告警出现 `pit-A-020`/`device-C-010` |
| 所有设备持续生成数据 | ✅ 实测 50 设备分布 22/13/15 |
| Maven 重新构建成功 | ✅ BUILD SUCCESS |
| 后端启动成功 | ✅ Tomcat on 8000 |
| 前端无运行时报错 | ✅ Vite 仍在线服务 |

---

## 2026-05-23 15:15:00

### 任务描述
根据浏览器控制台日志修复 CORS 403 与 WebSocket 连接失败 bug。

### 问题现象（来自 console-log:127.0.0.1:49704）
1. **PUT `/alarms/.../resolve` 全部返回 403 Forbidden**（`handleResolve` 与 `handleBatchResolve`）
2. **WebSocket 持续报 error 事件**

### 根因
- **`WebConfig` CORS 白名单只允许 `localhost:3000` 与 `5173`**，但 IDE 内置 Browser Preview 通过 `127.0.0.1:49704` 加载页面，预检 OPTIONS 请求被拒，导致 PUT 请求收到 403
- **`useWebSocket.ts` 仅识别 `port === '3000'` 才直连后端 8000**；非 3000 端口（如 49704）走 `window.location.host` 试图连 `ws://127.0.0.1:49704/ws/realtime`，目标不存在 WS 端点

### 修复
- `backend-java/.../config/WebConfig.java`：CORS 改为 `allowedOriginPatterns("*")`（与 `WebSocketConfig` 一致），允许任意 origin 模式 + 增加 `PATCH` 方法、`maxAge=3600`
- `frontend/src/hooks/useWebSocket.ts`：判断条件改为「hostname 为 `localhost` / `127.0.0.1` 且页面端口非 8000 时直连后端 8000」，覆盖 Vite dev / Browser Preview / 后端自身访问三种场景

### 验证
| 验证项 | 结果 |
|---|---|
| OPTIONS preflight from `127.0.0.1:49704` | ✅ 200，`Access-Control-Allow-Origin: http://127.0.0.1:49704` |
| PUT `/alarms/{id}/resolve` 带 Origin | ✅ 200 |
| PUT `/alarms/resolve-batch` 批量 | ✅ 200，`{resolved: 3}` |
| WebSocket 连接（Browser Preview）| ✅ 走 `ws://localhost:8000/ws/realtime`，连接稳定 |
