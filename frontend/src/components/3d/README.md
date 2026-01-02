# 3D 数字孪生模块说明

本模块基于 React Three Fiber (Three.js) 实现，提供了酿酒生产全流程的 3D 可视化与仿真功能。

## 功能特性

- **全场景漫游**：支持旋转、缩放、平移视角的 3D 场景。
- **实时数据驱动**：通过 WebSocket 连接后端，实时更新窖池温度、设备状态。
- **全流程展示**：
  - **起窖转运**：AGV 小车自动巡航演示。
  - **配料/上甑**：搅拌机与机器人模型。
  - **馏酒冲酸**：蒸馏塔模型与状态指示。
  - **入池发酵**：50 个窖池的温度热力图可视化。
- **交互功能**：鼠标悬停显示详细信息，点击设备可触发事件。

## 目录结构

```
frontend/src/components/3d/
├── Scene.tsx              # 主场景组件，包含灯光、相机和所有子模型
├── PitModel.tsx           # 窖池模型，支持温度颜色映射
├── DeviceModel.tsx        # 通用设备模型（泵、电机、机器人等）
├── AGVModel.tsx           # AGV 小车模型，支持路径跟随动画
└── DistillationTower.tsx  # 蒸馏塔模型
```

## 扩展指南

### 1. 加载高精度模型
目前使用基础几何体 (Box, Cylinder) 进行示意。如需高精度模型，可使用 `@react-three/drei` 的 `useGLTF` 钩子加载 `.glb` 或 `.gltf` 文件。

```tsx
import { useGLTF } from '@react-three/drei'

function RobotModel() {
  const { scene } = useGLTF('/models/robot.glb')
  return <primitive object={scene} />
}
```

### 2. 添加新的生产环节
在 `Scene.tsx` 中引入新的模型组件，并根据坐标放置在场景中。

### 3. 对接更多实时数据
修改 `Scene.tsx` 中的 `useWebSocket` 回调，解析后端发送的更多类型的消息，并更新组件状态。

## 运行方式

确保后端服务已启动（提供 WebSocket 服务），然后在前端目录下运行：

```bash
npm run dev
```

进入“数字孪生”页面，点击“3D”按钮即可切换到 3D 视图。
