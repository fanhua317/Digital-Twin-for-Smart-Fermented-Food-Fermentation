import { memo, useRef, useState } from 'react'
import { Html, Text } from '@react-three/drei'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { liveAgvCache, LiveAGVEntry } from '@/store/liveData'

export type CargoType = 'grain' | 'fermented' | 'mixed' | 'distilled' | 'cooled' | 'empty'

interface AGVModelProps {
  /** AGV 编号，挂载后不变 */
  agvId: string
  /** 全局暂停时停止插值 */
  isPlaying: boolean
}

const CARGO_COLORS: Record<CargoType, string> = {
  grain: '#e6c65c',
  fermented: '#5c4033',
  mixed: '#8b7355',
  distilled: '#f0f0f0',
  cooled: '#d2b48c',
  empty: '#333333',
}
const CARGO_NAMES: Record<CargoType, string> = {
  grain: '原粮',
  fermented: '出窖糟醅',
  mixed: '拌合粮',
  distilled: '蒸馏酒糟',
  cooled: '加曲粮',
  empty: '空载',
}
const STAGE_TEXT: Record<string, string> = {
  loading: '装货中',
  moving: '运输中',
  unloading: '卸货中',
  returning: '空载返程',
  idle: '待机',
  stopped: '暂停',
}

/** 后端 500ms tick，插值窗略大 */
const BACKEND_TICK_MS = 600
const POSITION_TOLERANCE = 0.3

const EMPTY_LIVE: LiveAGVEntry = {
  position: [0, 0, 0], stage: 'idle', cargoType: 'empty',
  weight: 0, weightCapacity: 900, temperature: 25, ph: 4, task: '',
}

function AGVModelImpl({ agvId, isPlaying }: AGVModelProps) {
  const group = useRef<THREE.Group>(null!)
  const fromPos = useRef(new THREE.Vector3())
  const toPos = useRef(new THREE.Vector3())
  const tStartMs = useRef<number>(performance.now())
  const yawTarget = useRef<number>(0)
  const [hovered, setHovered] = useState(false)
  // 外观状态：仅在 stage/cargoType/weight 真正改变时更新（极低频）
  const [vis, setVis] = useState<LiveAGVEntry>(EMPTY_LIVE)
  const visRef = useRef(vis)

  // 全部动画逻辑在 useFrame 内完成，零 React 渲染参与位置更新
  useFrame((_state, delta) => {
    if (!group.current) return
    const live = liveAgvCache[agvId] ?? EMPTY_LIVE
    if (!isPlaying || live.stage === 'stopped') return

    // 检测位置变化 → 更新插值目标
    const [nx, ny, nz] = live.position
    if (
      Math.abs(toPos.current.x - nx) > POSITION_TOLERANCE ||
      Math.abs(toPos.current.z - nz) > POSITION_TOLERANCE
    ) {
      fromPos.current.copy(group.current.position)
      toPos.current.set(nx, ny, nz)
      tStartMs.current = performance.now()
      const dx = nx - fromPos.current.x
      const dz = nz - fromPos.current.z
      if (Math.abs(dx) + Math.abs(dz) > 0.01) yawTarget.current = Math.atan2(dx, dz)
    }

    const t = Math.min(1, (performance.now() - tStartMs.current) / BACKEND_TICK_MS)
    group.current.position.lerpVectors(fromPos.current, toPos.current, t)

    let diff = yawTarget.current - group.current.rotation.y
    while (diff > Math.PI) diff -= Math.PI * 2
    while (diff < -Math.PI) diff += Math.PI * 2
    group.current.rotation.y += diff * Math.min(1, delta * 8)

    // 外观属性低频更新：仅 stage/cargoType/weight 变化超阈值才触发 React
    const prev = visRef.current
    if (prev.stage !== live.stage || prev.cargoType !== live.cargoType || Math.abs(prev.weight - live.weight) > 5) {
      visRef.current = live
      setVis({ ...live })
    }
  })

  const showCargo = vis.weight > 1
  const stageLabel = STAGE_TEXT[vis.stage] || vis.stage
  const statusLedColor =
    vis.stage === 'loading' || vis.stage === 'unloading' ? '#ffc857' :
    vis.stage === 'stopped' ? '#ff6b6b' : '#42e07b'
  const { cargoType, weight, weightCapacity, temperature, ph, task, sourcePitNo } = vis

  return (
    <group
      ref={group}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true) }}
      onPointerOut={() => setHovered(false)}
    >
      {/* 车底盘 (扁平底座) */}
      <mesh position={[0, 0.18, 0]} castShadow>
        <boxGeometry args={[2.2, 0.3, 3.2]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.5} roughness={0.6} />
      </mesh>
      {/* 车身主体 - 工业黄涂装 */}
      <mesh position={[0, 0.65, 0]}>
        <boxGeometry args={[1.9, 0.55, 2.8]} />
        <meshStandardMaterial color="#faad14" metalness={0.3} roughness={0.45} />
      </mesh>
      {/* 控制柜 (前部) */}
      <mesh position={[0, 1, 1]}>
        <boxGeometry args={[1.4, 0.4, 0.5]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      {/* 状态指示灯 (顶部 LED 灯柱) */}
      <mesh position={[0, 1.35, 1]}>
        <cylinderGeometry args={[0.12, 0.12, 0.25, 16]} />
        <meshBasicMaterial color={statusLedColor} />
      </mesh>
      {/* 方向指示箭头 (车头) - 始终指向 +Z (车体本地朝向) */}
      <mesh position={[0, 0.95, 1.45]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.18, 0.4, 4]} />
        <meshBasicMaterial color={statusLedColor} />
      </mesh>

      {/* 4 个轮子 */}
      {[[1.05, 1], [-1.05, 1], [1.05, -1], [-1.05, -1]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.22, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.22, 0.22, 0.18, 16]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
        </mesh>
      ))}

      {/* 货物 (带边框立体感) */}
      {showCargo && (
        <group position={[0, 1.25, -0.3]}>
          <mesh>
            <boxGeometry args={[1.5, 0.7, 1.8]} />
            <meshStandardMaterial color={CARGO_COLORS[cargoType as CargoType] || '#888'} roughness={0.7} />
          </mesh>
          {/* 货物顶部装载提示线 */}
          <mesh position={[0, 0.38, 0]}>
            <boxGeometry args={[1.55, 0.04, 1.85]} />
            <meshBasicMaterial color="#000" transparent opacity={0.4} />
          </mesh>
        </group>
      )}

      {/* 常驻轻量标签：用 Three.js Text 替代 Html，无 DOM 投影开销 */}
      <Text
        position={[0, 3.2, 0]}
        fontSize={0.55}
        color="#faad14"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.04}
        outlineColor="#000"
        renderOrder={1}
      >
        {agvId}
      </Text>
      {/* 详细信息面板：仅 hover 时显示，避免 15+ Html 常驻 useFrame DOM 投影 */}
      {hovered && (
        <Html position={[0, 4.5, 0]} center distanceFactor={15} style={{ pointerEvents: 'none' }}>
          <div className="text-xs px-2 py-1.5 rounded bg-black/70 text-white border border-white/20 backdrop-blur-sm min-w-[170px]">
            <div className="font-bold text-yellow-400 mb-0.5 flex justify-between items-center">
              <span>{agvId}</span>
              <span className="text-[10px] text-gray-300">{stageLabel}</span>
            </div>
            {task && (
              <div className="text-[10px] text-cyan-300 mb-1 leading-tight">{task}</div>
            )}
            <div className="text-[10px] leading-tight space-y-0.5">
              <div className="flex justify-between">
                <span className="text-gray-400">货物</span>
                <span className={weight > 0 ? 'text-white' : 'text-gray-500'}>
                  {weight > 0 ? (CARGO_NAMES[cargoType as CargoType] || '物料') : '空载'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">载重</span>
                <span className="text-orange-300">{weight.toFixed(0)} / {weightCapacity.toFixed(0)} kg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">温度</span>
                <span className={temperature > 60 ? 'text-red-400' : temperature > 40 ? 'text-yellow-300' : 'text-green-400'}>
                  {temperature.toFixed(1)}°C
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">pH</span>
                <span className="text-blue-300">{ph.toFixed(2)}</span>
              </div>
              {sourcePitNo && (
                <div className="flex justify-between">
                  <span className="text-gray-400">来源池</span>
                  <span className="text-yellow-200">{sourcePitNo}</span>
                </div>
              )}
            </div>
          </div>
        </Html>
      )}
    </group>
  )
}

/**
 * props 只有 agvId + isPlaying，两者在 AGV 生命周期内基本不变。
 * 所有动画/外观通过 liveAgvCache + useFrame 驱动，完全绕开 React reconciliation。
 */
export default memo(AGVModelImpl)
