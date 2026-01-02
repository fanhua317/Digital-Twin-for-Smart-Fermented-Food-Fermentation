import { useState, useEffect, Suspense, useRef, useMemo, useCallback } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Stars, Grid, Text as ThreeText, Html } from '@react-three/drei'
import * as THREE from 'three'
import PitModel from './PitModel'
import DeviceModel from './DeviceModel'
import AGVModel from './AGVModel'
import DistillationTower from './DistillationTower'
import CameraController from './CameraController'
import { useWebSocket } from '../../hooks/useWebSocket'
import { useStore, DeviceMaterialState } from '../../store'

interface SceneProps {
  isPlaying: boolean
  mode?: 'monitor' | 'simulation'
  simulationStep?: number
}

// 仿真步骤配置
const SIMULATION_STEPS = [
  { pos: [40, 40, 40], lookAt: [0, 0, 0] }, // 全局概览
  { pos: [-15, 20, -30], lookAt: [-25, 0, -25] }, // 起窖转运 (AGV起点)
  { pos: [-35, 15, -15], lookAt: [-25, 0, -15] }, // 配料拌粮 (搅拌机)
  { pos: [-35, 15, 0], lookAt: [-25, 0, 0] }, // 上甑给料 (机器人)
  { pos: [0, 20, 0], lookAt: [0, 5, 0] }, // 馏酒冲酸 (蒸馏塔)
  { pos: [35, 15, 0], lookAt: [25, 0, 0] }, // 摊凉加曲 (摊凉机)
  { pos: [25, 25, -25], lookAt: [25, 0, -25] }, // 入池发酵 (窖池群)
]

// 输送管道组件
function WaterPipe() {
  const path = useMemo(() => {
    // 创建从输送泵(D003)到蒸馏塔(DistillationTower)的路径
    // 避开 AGV 路径 (z <= 0)，走侧面 (z > 0)
    // D003: [-25, 0, 15], Tower: [0, 0, 0]
    return new THREE.CatmullRomCurve3([
      new THREE.Vector3(-25, 0.5, 15),   // 起点: 泵出口
      new THREE.Vector3(-25, 0.2, 16),   // 下地，稍微往外绕一点
      new THREE.Vector3(0, 0.2, 16),     // 沿墙边走 (z=16)，避开所有车辆
      new THREE.Vector3(0, 0.2, 2),      // 接近塔身 (z=2)
      new THREE.Vector3(0, 3, 2),        // 垂直向上
      new THREE.Vector3(0, 4, 1.5)       // 接入塔身
    ], false, 'catmullrom', 0.05)
  }, [])

  // 纹理流动动画
  const textureRef = useRef<THREE.Texture>(null!)
  useFrame((_state, delta) => {
    if (textureRef.current) {
      textureRef.current.offset.x -= delta * 0.5 // 模拟水流方向
    }
  })

  return (
    <group>
      {/* 管道主体 */}
      <mesh>
        <tubeGeometry args={[path, 64, 0.2, 8, false]} />
        <meshStandardMaterial color="#4fc3f7" metalness={0.6} roughness={0.2} opacity={0.9} transparent />
      </mesh>
      {/* 地面固定卡扣 */}
      {[-20, -15, -10, -5, 0].map(x => (
        <mesh key={x} position={[x, 0.1, 16]}>
          <boxGeometry args={[0.5, 0.2, 0.5]} />
          <meshStandardMaterial color="#333" />
        </mesh>
      ))}
    </group>
  )
}

export default function Scene({ isPlaying, mode = 'monitor', simulationStep = 0 }: SceneProps) {
  const [pits, setPits] = useState<any[]>([])
  const [devices, setDevices] = useState<any[]>([])
  
  // 从全局 store 获取和同步设备物料状态
  const { 
    deviceMaterials, 
    updateAGVState,
    updateSimulationStats,
    addMaterialTransaction,
    set3DSceneActive
  } = useStore()

  // 注册场景激活状态
  useEffect(() => {
    set3DSceneActive(true)
    return () => set3DSceneActive(false)
  }, [set3DSceneActive])
  
  // 本地状态用于高频更新，定期同步到全局
  const [localDeviceMaterials, setLocalDeviceMaterials] = useState<Record<string, DeviceMaterialState>>(deviceMaterials)

  // 使用 ref 保持对最新状态的引用，以便在回调中同步访问
  const deviceMaterialsRef = useRef(localDeviceMaterials)
  useEffect(() => {
    deviceMaterialsRef.current = localDeviceMaterials
  }, [localDeviceMaterials])
  
  // 定期同步本地状态到全局 store (每500ms)
  useEffect(() => {
    // 如果仿真正在运行，我们从全局 store 同步到本地，而不是反过来
    // 因为 GlobalSimulationRunner 现在负责更新全局状态
    if (isPlaying) {
      const syncTimer = setInterval(() => {
        setLocalDeviceMaterials(useStore.getState().deviceMaterials)
      }, 100) // 提高同步频率以获得更流畅的动画
      return () => clearInterval(syncTimer)
    } else {
      // 即使暂停，也应该同步一次最新状态
      setLocalDeviceMaterials(useStore.getState().deviceMaterials)
    }
  }, [isPlaying])
  
  // 注意: 不再自动同步 isPlaying 到全局 store
  // 全局仿真状态由 SimulationController 组件的按钮直接控制

  // 处理 AGV 装卸货对设备物料的影响 (严格物料守恒)
  const handleAGVTaskComplete = useCallback((agvId: string, type: 'load' | 'unload', requestedAmount: number) => {
    // 获取当前最新的设备状态
    const currentMaterials = deviceMaterialsRef.current
    let actualAmount = requestedAmount
    let sourceDeviceId = ''
    let targetDeviceId = ''
    
    // 确定源设备和目标设备
    const agvConfig: Record<string, { loadFrom?: string, unloadTo: string }> = {
      'AGV-01': { unloadTo: 'D001' },
      'AGV-02': { loadFrom: 'D001', unloadTo: 'D002' },
      'AGV-03': { loadFrom: 'D002', unloadTo: 'DistillationTower' },
      'AGV-04': { loadFrom: 'DistillationTower', unloadTo: 'D004' },
      'AGV-05': { loadFrom: 'D004', unloadTo: '' },
    }
    
    const config = agvConfig[agvId]
    if (!config) return requestedAmount

    // 计算实际交易量
    if (type === 'load' && config.loadFrom) {
      sourceDeviceId = config.loadFrom
      const device = currentMaterials[sourceDeviceId]
      if (device) {
        // 只能装载设备当前有的量
        actualAmount = Math.min(requestedAmount, device.outputLevel)
      }
    }
    
    if (type === 'unload' && config.unloadTo) {
      targetDeviceId = config.unloadTo
      const device = currentMaterials[targetDeviceId]
      if (device) {
        // 只能卸载设备能接收的量 (防止溢出)
        const space = 2000 - device.inputLevel
        actualAmount = Math.min(requestedAmount, space)
      }
    }
    
    // 记录交易前状态
    const deviceBefore = type === 'load' 
      ? currentMaterials[sourceDeviceId]?.outputLevel ?? 0
      : currentMaterials[targetDeviceId]?.inputLevel ?? 0
    const agvBefore = requestedAmount

    console.log(`[物料交易] ${agvId} ${type}: 请求=${requestedAmount}kg, 实际=${actualAmount}kg`)

    // 执行物料转移
    setLocalDeviceMaterials(prev => {
      const next = { ...prev }
      
      if (type === 'load' && sourceDeviceId && next[sourceDeviceId]) {
        // 装货: 从设备输出端取走物料
        next[sourceDeviceId].outputLevel = Math.max(0, next[sourceDeviceId].outputLevel - actualAmount)
      }
      
      if (type === 'unload' && targetDeviceId && next[targetDeviceId]) {
        // 卸货: 向设备输入端添加物料
        next[targetDeviceId].inputLevel = next[targetDeviceId].inputLevel + actualAmount
      }

      return next
    })
    
    // 更新 AGV 状态到全局 store
    updateAGVState(agvId, { 
      weight: type === 'load' ? actualAmount : Math.max(0, requestedAmount - actualAmount),
      status: type === 'load' ? 'moving' : 'returning'
    })
    
    // 记录交易日志
    addMaterialTransaction({
      agvId,
      type,
      deviceId: type === 'load' ? sourceDeviceId : targetDeviceId,
      amount: actualAmount,
      deviceBefore,
      deviceAfter: type === 'load' 
        ? deviceBefore - actualAmount 
        : deviceBefore + actualAmount,
      agvBefore,
      agvAfter: type === 'load' ? actualAmount : 0
    })
    
    // 更新总运输量统计
    if (type === 'unload' && actualAmount > 0) {
      updateSimulationStats({ 
        totalTransported: useStore.getState().simulationStats.totalTransported + actualAmount,
        cycleCount: useStore.getState().simulationStats.cycleCount + 1
      })
    }

    // 返回实际操作的量给 AGV
    return actualAmount
  }, [updateAGVState, addMaterialTransaction, updateSimulationStats])
  
  // 初始化模拟数据
  useEffect(() => {
    // 生成50个窖池，分为两组，中间留出通道
    const initialPits = Array.from({ length: 50 }, (_, i) => {
      const row = Math.floor(i / 10)
      const col = i % 10
      // 增加间距，并在中间留出通道 (col > 4 时偏移)
      const x = col * 6 + (col > 4 ? 10 : 0) 
      const z = row * 6
      return {
        id: i,
        pitNo: `J-${String(i + 1).padStart(3, '0')}`,
        x: x - 15, // 整体偏移
        z: z - 40,
        status: Math.random() > 0.9 ? 'alarm' : (Math.random() > 0.8 ? 'warning' : 'normal'),
        temperature: 25 + Math.random() * 10
      }
    })
    setPits(initialPits)

    // 生成一些设备
    const initialDevices = [
      { id: 1, deviceNo: 'D001', name: '搅拌机', type: 'motor', status: 'running', position: [-25, 0, -15] },
      { id: 2, deviceNo: 'D002', name: '上甑机器人', type: 'robot', status: 'running', position: [-25, 0, 0] },
      { id: 3, deviceNo: 'D003', name: '输送泵', type: 'pump', status: 'running', position: [-25, 0, 15] },
      { id: 4, deviceNo: 'D004', name: '摊凉机', type: 'conveyor', status: 'running', position: [25, 0, 0] },
    ]
    setDevices(initialDevices)
  }, [])

  // 接收实时数据
  useWebSocket('digital-twin', (data) => {
    if (data.type === 'pit_update') {
      setPits(prev => prev.map(p => 
        p.id === data.data.pitId ? { ...p, ...data.data } : p
      ))
    } else if (data.type === 'device_update') {
      setDevices(prev => prev.map(d => 
        d.id === data.data.deviceId ? { ...d, ...data.data } : d
      ))
    }
  })

  // AGV 路径定义 - 优化路径，避免穿模，形成回路
  const agvPaths = {
    transport: [ // 起窖转运: 窖池区 -> 配料区
      [-15, 0, -30], [-30, 0, -30], [-30, 0, -20], [-25, 0, -20]
    ] as [number, number, number][],
    mixing: [ // 配料拌粮: 配料区 -> 上甑区
      [-25, 0, -15], [-30, 0, -15], [-30, 0, 0], [-25, 0, 0]
    ] as [number, number, number][],
    loading: [ // 上甑给料: 上甑区 -> 馏酒区
      [-25, 0, 0], [-15, 0, 0], [-10, 0, 0], [0, 0, 0]
    ] as [number, number, number][],
    distilling: [ // 馏酒冲酸: 馏酒区 -> 摊凉区
      [0, 0, 0], [10, 0, 0], [15, 0, 0], [25, 0, 0]
    ] as [number, number, number][],
    cooling: [ // 摊凉加曲: 摊凉区 -> 入池区
      [25, 0, 0], [35, 0, 0], [35, 0, -30], [15, 0, -30]
    ] as [number, number, number][]
  }

  return (
    <div className="w-full h-full bg-gray-900 rounded-lg overflow-hidden">
      <Canvas camera={{ position: [40, 40, 40], fov: 45 }} shadows>
        <Suspense fallback={null}>
          <color attach="background" args={['#050505']} />
          <fog attach="fog" args={['#050505', 40, 120]} />
          
          <ambientLight intensity={0.4} />
          <pointLight position={[10, 20, 10]} intensity={0.8} castShadow />
          <directionalLight position={[-20, 30, 20]} intensity={1} castShadow shadow-mapSize={[2048, 2048]} />
          
          <Stars radius={150} depth={50} count={6000} factor={4} saturation={0} fade speed={0.5} />
          <Grid infiniteGrid fadeDistance={80} sectionColor="#42e07b" cellColor="#1a2e22" sectionSize={5} cellSize={1} />
          
          <OrbitControls 
            enablePan={true} 
            enableZoom={true} 
            enableRotate={true}
            maxPolarAngle={Math.PI / 2.1}
            makeDefault
          />

          {/* 相机控制器 */}
          {mode === 'simulation' && (
            <CameraController 
              targetPosition={SIMULATION_STEPS[simulationStep]?.pos as [number, number, number]}
              targetLookAt={SIMULATION_STEPS[simulationStep]?.lookAt as [number, number, number]}
            />
          )}

          {/* 道路标线 */}
          <group position={[0, 0.05, 0]}>
             {/* 主通道 */}
             <mesh position={[0, 0, 0]} rotation={[-Math.PI/2, 0, 0]}>
               <planeGeometry args={[80, 4]} />
               <meshStandardMaterial color="#333" />
             </mesh>
             <mesh position={[-30, 0, 0]} rotation={[-Math.PI/2, 0, Math.PI/2]}>
               <planeGeometry args={[80, 4]} />
               <meshStandardMaterial color="#333" />
             </mesh>
          </group>

          {/* 窖池群 - 分布式布局 */}
          <group>
            {pits.map((pit) => (
              <PitModel
                key={pit.id}
                position={[pit.x, 1, pit.z]}
                pitNo={pit.pitNo}
                status={pit.status}
                temperature={pit.temperature}
                onClick={() => console.log('Clicked pit', pit.pitNo)}
              />
            ))}
          </group>

          {/* 设备 */}
          {devices.map((device) => (
            <DeviceModel
              key={device.id}
              position={device.position as [number, number, number]}
              deviceNo={device.deviceNo}
              name={device.name}
              type={device.type}
              status={device.status}
              materialInfo={localDeviceMaterials[device.deviceNo]}
            />
          ))}

          {/* 多AGV协同仿真 - 始终显示，根据状态运动 */}
          <AGVModel 
            path={agvPaths.transport} 
            status={isPlaying ? 'active' : 'stopped'} 
            speed={4} 
            cargoType="fermented"
            agvId="AGV-01"
            baseStats={{ temperature: 32.5, ph: 3.8, weight: 800 }}
            onTaskComplete={(type, amount) => handleAGVTaskComplete('AGV-01', type, amount)}
          />
          <AGVModel 
            path={agvPaths.mixing} 
            status={isPlaying ? 'active' : 'stopped'} 
            speed={4} 
            cargoType="mixed"
            agvId="AGV-02"
            baseStats={{ temperature: 26.0, ph: 4.2, weight: 850 }}
            onTaskComplete={(type, amount) => handleAGVTaskComplete('AGV-02', type, amount)}
          />
          <AGVModel 
            path={agvPaths.loading} 
            status={isPlaying ? 'active' : 'stopped'} 
            speed={4} 
            cargoType="mixed"
            agvId="AGV-03"
            baseStats={{ temperature: 26.0, ph: 4.2, weight: 850 }}
            onTaskComplete={(type, amount) => handleAGVTaskComplete('AGV-03', type, amount)}
          />
          <AGVModel 
            path={agvPaths.distilling} 
            status={isPlaying ? 'active' : 'stopped'} 
            speed={4} 
            cargoType="distilled"
            agvId="AGV-04"
            baseStats={{ temperature: 85.0, ph: 3.5, weight: 700 }}
            onTaskComplete={(type, amount) => handleAGVTaskComplete('AGV-04', type, amount)}
          />
          <AGVModel 
            path={agvPaths.cooling} 
            status={isPlaying ? 'active' : 'stopped'} 
            speed={4} 
            cargoType="cooled"
            agvId="AGV-05"
            baseStats={{ temperature: 28.0, ph: 3.6, weight: 750 }}
            onTaskComplete={(type, amount) => handleAGVTaskComplete('AGV-05', type, amount)}
          />

          {/* 馏酒区 - 蒸馏塔 */}
          <DistillationTower 
            position={[0, 0, 0]} 
            status="running" 
            materialInfo={localDeviceMaterials['DistillationTower']}
          />

          {/* 输送管道 */}
          <WaterPipe />

          {/* 区域标识 */}
          <ThreeText position={[-25, 8, -15]} fontSize={3} color="#ffffff" outlineWidth={0.1} outlineColor="#000">配料区</ThreeText>
          <ThreeText position={[-25, 8, 0]} fontSize={3} color="#ffffff" outlineWidth={0.1} outlineColor="#000">上甑区</ThreeText>
          <ThreeText position={[0, 12, 0]} fontSize={3} color="#ffffff" outlineWidth={0.1} outlineColor="#000">馏酒区</ThreeText>
          <ThreeText position={[25, 8, 0]} fontSize={3} color="#ffffff" outlineWidth={0.1} outlineColor="#000">摊凉区</ThreeText>
          <ThreeText position={[15, 8, -30]} fontSize={3} color="#ffffff" outlineWidth={0.1} outlineColor="#000">发酵区</ThreeText>

          {/* 传感器数据面板 */}
          <group>
             <Html position={[-25, 5, -15]} center>
               <div className="bg-black/60 text-green-400 p-1 text-xs border border-green-500/30 rounded">
                 配料精度: 99.8%
               </div>
             </Html>
             <Html position={[0, 10, 0]} center>
               <div className="bg-black/60 text-blue-400 p-1 text-xs border border-blue-500/30 rounded">
                 流酒温度: 28.5°C<br/>酒度: 65%vol
               </div>
             </Html>
             <Html position={[25, 5, 0]} center>
               <div className="bg-black/60 text-yellow-400 p-1 text-xs border border-yellow-500/30 rounded">
                 摊凉温度: 22.0°C
               </div>
             </Html>
          </group>

        </Suspense>
      </Canvas>
    </div>
  )
}
