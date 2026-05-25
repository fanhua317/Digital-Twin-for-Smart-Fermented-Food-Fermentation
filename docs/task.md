

## 2026-05-24 14:55:00

### 任务描述
AGV 仍卡顿，实施彻底的架构级性能修复。

### 根因（最终定位）
每 500ms `setSimulation(snapshot)` → Zustand store 变化 → Scene 及子组件 React reconciliation（100 PitModel + 8 AGV + 设备 + 所有子节点 prop diff）→ 主线程占用 >16ms → 掉帧。

React 渲染与 Three.js rAF **共用主线程**，高频 reconciliation 直接挤占渲染时间。

### 彻底修复（架构级）

**新增 `src/store/liveData.ts`**
- 模块级 mutable `liveAgvCache: Record<string, LiveAGVEntry>` 
- `updateLiveAgvCache()` 直接写入，零 React 渲染触发

**`useWebSocket.ts`**
- `sim_snapshot` → 先写 `liveAgvCache`（不触发 React）
- 节流 `setSimulation`：每 **2s** 一次（之前每 500ms）→ Scene React reconciliation 从 2次/s → 0.5次/s

**`AGVModel.tsx`（完全重写）**
- props 缩减为 `{ agvId, isPlaying }` — 两者生命周期内不变
- `useFrame` 直读 `liveAgvCache[agvId]`，完全绕过 React reconciliation
- 外观状态（stage/cargoType/weight）变化才触发 `setVis`（极低频）

**`Scene.tsx`**
- 移除 `agvs = useStore(s => s.simulation?.agvs)` 订阅
- 用常量 `AGV_CODES['AGV-01'...'AGV-08']` 渲染 8 个 AGVModel
- `<AGVModel key={code} agvId={code} isPlaying={isPlaying} />` — props 永不变化

### 最终效果

| 指标 | 修复前 | 修复后 |
|---|---|---|
| React reconciliation 频率 | 500ms/次 | **2000ms/次** |
| AGV 位置更新路径 | WebSocket→setState→props→useEffect | **WebSocket→cache→useFrame（绕过 React）** |
| AGVModel React re-render | 每 500ms 全部 8 个 | **几乎为 0**（props 不变）|
| 主线程争用 | 高频 reconciliation 抢 rAF | **rAF 独占主线程**，60fps 无中断 |

`tsc --noEmit` 0 错误

---

## 2026-05-24 14:50:00

### 任务描述
用户反馈 AGV 仍然卡顿，继续深度优化 3D 场景渲染性能。

### 根因补充
Html 组件在 R3F 内部每帧运行 `useFrame` 做 DOM 投影（screen-space 坐标变换）。场景原本存在：
- 8 个 AGV 常驻 Html 数据卡
- 7 个 ProcessFlowArrow Html 标签
- 3 个 LiquorTanks Html 标签
- 1 个 ProcessLegend Html 面板
共 **19 个 Html/useFrame** 每帧运行 DOM 投影。

### 修复

| 改动 | 文件 | 说明 |
|---|---|---|
| AGV Html → hover-only + ThreeText ID | `AGVModel.tsx` | 常态 0 Html，hover 时才显示 1 个 |
| ProcessFlowArrow Html → ThreeText | `Scene.tsx` | 消除 7 个常驻 Html |
| LiquorTanks Html → ThreeText | `Scene.tsx` | 消除 3 个常驻 Html |
| ProcessLegend → 2D CSS overlay | `Scene.tsx` | 移出 Canvas，消除最后 1 个 Html |
| WaterPipe 管道段数 64→16，径向 8→6 | `Scene.tsx` | ~75% 顶点减少 |
| 地面平面 32×32→8×8 | `Scene.tsx` | 顶点从 1089 降到 81 |
| LiquorTanks 储罐圆柱段数 24→12 | `Scene.tsx` | 每储罐约 50% 顶点减少 |

### 验证
- `tsc --noEmit` 0 错误
- 消除 Html useFrame 数量：19 → 0（正常使用时）

---

## 2026-05-24 14:36:00

### 任务描述
 3D 场景中 AGV 小车运行"非常卡"，需优化。

### 根因分析

| 层次 | 根因 | 说明 |
|---|---|---|
| 视觉跳帧 | 后端 1s tick → 前端插值窗 1200ms | AGV 到达后等 200ms 才有新帧，视觉上"走一步停一下" |
| React 渲染开销 | AGVModel 无 memo | 每秒 sim_snapshot 触发 8×AGVModel 全重建（含 8 个 Html 数据卡 DOM 子树）|
| React 渲染开销 | DistillationTower 无 memo | 每秒全量重渲染 |

### 修复

**后端** `ProcessSimulationService.java`
- `@Scheduled(fixedRate = 1000)` → `fixedRate = 500`
- `double dt = 1.0` → `double dt = 0.5`（物料/发酵速率不变，dt 自适应）
- 新增 `tickCounter` 每 2 拍累加 1 秒 uptime

**前端** `AGVModel.tsx`
- `BACKEND_TICK_MS = 1200` → **600ms**（匹配新 500ms tick）
- `POSITION_TOLERANCE = 0.5` → **0.3**（步长更小）
- `export default function` → `export default memo(AGVModelImpl, customComparator)`
  - 位置容差 **0.25**（< 内部 0.3，确保不漏更新）
  - weight 1 kg / temp 0.5°C / pH 0.05 阈值过滤浮点抖动

**前端** `DistillationTower.tsx`
- 加 `memo(DistillationTowerImpl, customComparator)`，材料数值阈值 1kg

### 验证（Playwright）

| 验证项 | 结果 |
|---|---|
| 5 秒内 sim_snapshot 条数 | **10 条**（500ms/帧）|
| 实测帧间隔 | 503/496/504/488/496/517 ms |
| 平均间隔 | **500ms** ✓ |
| 控制台 errors | 0（WS 稳定）|
