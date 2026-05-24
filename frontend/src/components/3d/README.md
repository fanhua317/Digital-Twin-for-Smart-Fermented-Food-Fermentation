# 3D 数字孪生模块

基于 **React Three Fiber + Three.js 0.182** 实现的酿酒车间 3D 数字孪生场景，
所有元素均由后端 `ProcessSimulationService` 通过 WebSocket `sim_snapshot` 帧实时驱动。

## 模块特性

- **3D 车间全景**：100 个窖池（A/B/C/D 四区） + 5 核心设备 + 8 AGV
- **OrbitControls 交互**：鼠标拖拽旋转、滚轮缩放、右键平移
- **实时驱动**：每秒接收一次后端快照，AGV 时间基插值动画消除抖动
- **HUD 在画布外**（`SceneHUDStrip`），不遮挡 3D 视野
- **工艺导览**：`SimulationController` 7 步骤引导，自动定位摄像机

## 文件清单

| 文件 | 作用 |
|---|---|
| `Scene.tsx` | 主场景容器，包含灯光、相机、全部子模型 + `SceneHUDStrip` |
| `PitModel.tsx` | 100 个窖池模型，按 `stage` + `grainType` 颜色编码 |
| `DeviceModel.tsx` | 5 核心设备（搅拌机 / 上甑机 / 蒸馏塔 / 摊凉机 / 输送泵） |
| `DistillationTower.tsx` | 高塔蒸馏设备 + 摘酒动画 + 三联储罐 + PUMP→塔水管道 |
| `AGVModel.tsx` | 8 个 AGV 时间基插值动画（1200 ms 窗口、0.5 m 抖动阈值），带气泡标签 |
| `CameraController.tsx` | OrbitControls 封装 + 工艺步骤定位 |
| `SimulationController.tsx` | 7 步工艺导览卡 + 暂停/继续/重置控制条 |
| `PerformanceAnalysis.tsx` | OEE / 能耗 / 出酒率 实时图表面板 |

## 数据来源

数据流：

```
ProcessSimulationService (后端 1s/tick)
    ↓ broadcast sim_snapshot
WebSocket /ws/realtime
    ↓ useWebSocket hook
Zustand store.simSnapshot
    ↓ 细粒度 selector
3D 组件 (PitModel / AGVModel / ...)
```

> **不要在 3D 组件内部生成模拟数据** — 所有状态来自 `store.simSnapshot`。

## AGV 平滑动画原理

```typescript
// 每帧根据时间差线性插值
const t = Math.min((now - lastUpdate) / LERP_WINDOW, 1)
position.lerpVectors(prevPos, targetPos, t)
```

- **LERP_WINDOW = 1200 ms** — 比 WebSocket 1 s 间隔略长，确保下一帧到达前已抵达上一目标
- **位置阈值 0.5 m** — 低于此差异不更新 prevPos，避免微抖
- **`React.memo` 包裹** — 仅当 AGV 自身 props 变化时重渲

## 扩展指南

### 加载 GLTF/GLB 高精度模型

```tsx
import { useGLTF } from '@react-three/drei'

function RobotModel() {
  const { scene } = useGLTF('/models/robot.glb')
  return <primitive object={scene} />
}
```

### 添加新设备类型

1. 在后端 `ProcessSimulationService` 增加设备状态
2. 在 `SimulationSnapshot.equipments` 暴露该设备
3. 在 `Scene.tsx` 引入新组件并放置坐标

## 运行

确保后端 `http://localhost:8000` 已启动（提供 WebSocket）：

```bash
npm run dev
# → http://localhost:3000 / 数字孪生 / 仿真模拟
```
