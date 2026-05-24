import { useEffect, useRef } from 'react'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

export type CargoType = 'grain' | 'fermented' | 'mixed' | 'distilled' | 'cooled' | 'empty'

interface AGVModelProps {
  agvId: string
  /** 由后端驱动的目标位置，组件内平滑插值跟随 */
  position: [number, number, number]
  /** AGV 阶段 (loading/moving/unloading/returning) 或 'stopped' */
  status: string
  cargoType?: CargoType
  weight?: number
  weightCapacity?: number
  temperature?: number
  ph?: number
  task?: string
  sourcePitNo?: string
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

/**
 * 后端每秒推送一帧 AGV 目标位置。
 * 我们用 1200ms 作为插值窗 (略大于 1000ms tick), 这样:
 *   - AGV 在 1.0s 时还在向 toPos 移动 (走了 ~83% 路程)
 *   - 此时下一帧 tick 到来, fromPos = 当前位置 (mid-flight), toPos = 新目标
 *   - 自然衔接, 没有 "到达后等待" 的停顿感
 *
 * 容差: 0.5 单位. 后端位置抖动 < 0.5 不触发插值重启 (避免浮点抖动导致的微闪)
 */
const BACKEND_TICK_MS = 1200
const POSITION_TOLERANCE = 0.5

export default function AGVModel({
  agvId,
  position,
  status,
  cargoType = 'empty',
  weight = 0,
  weightCapacity = 900,
  temperature = 25,
  ph = 4,
  task = '',
  sourcePitNo,
}: AGVModelProps) {
  const group = useRef<THREE.Group>(null!)
  const fromPos = useRef(new THREE.Vector3(position[0], position[1], position[2]))
  const toPos = useRef(new THREE.Vector3(position[0], position[1], position[2]))
  const tStartMs = useRef<number>(performance.now())
  const yawTarget = useRef<number>(0)

  // 新目标到达：把当前位置记为 from，新目标记为 to，重置插值时钟
  // 关键: 用 position 的 3 个标量做 deps, 而不是 position 数组引用
  // (Scene 每次 store 变化都生成新 array, 用 [position] 会导致 useEffect 每帧误触发 → AGV 闪烁停顿)
  useEffect(() => {
    // 真正位置不变时跳过 (容差 POSITION_TOLERANCE = 0.5 单位)
    if (
      Math.abs(toPos.current.x - position[0]) < POSITION_TOLERANCE &&
      Math.abs(toPos.current.y - position[1]) < POSITION_TOLERANCE &&
      Math.abs(toPos.current.z - position[2]) < POSITION_TOLERANCE
    ) {
      return
    }
    if (group.current) {
      fromPos.current.copy(group.current.position)
    } else {
      fromPos.current.set(position[0], position[1], position[2])
    }
    toPos.current.set(position[0], position[1], position[2])
    tStartMs.current = performance.now()
    // 朝向目标 = from→to 方向
    const dx = toPos.current.x - fromPos.current.x
    const dz = toPos.current.z - fromPos.current.z
    if (Math.abs(dx) + Math.abs(dz) > 0.01) {
      yawTarget.current = Math.atan2(dx, dz)
    }
  }, [position[0], position[1], position[2]])

  // 每帧：按 (now - tStart) / BACKEND_TICK_MS 计算插值进度 [0,1]，匀速过渡
  useFrame((_state, delta) => {
    if (!group.current) return
    if (status === 'stopped') return
    const elapsed = performance.now() - tStartMs.current
    const t = Math.min(1, elapsed / BACKEND_TICK_MS)
    group.current.position.lerpVectors(fromPos.current, toPos.current, t)
    // 朝向：插值到目标 yaw（避免突然转向）
    const cur = group.current.rotation.y
    let diff = yawTarget.current - cur
    // 归一到 [-pi, pi]
    while (diff > Math.PI) diff -= Math.PI * 2
    while (diff < -Math.PI) diff += Math.PI * 2
    group.current.rotation.y = cur + diff * Math.min(1, delta * 8)
  })

  // 货物可见性只依赖 weight (不依赖 status)
  // 之前 `weight > 1 && (status === 'moving' || 'unloading')` 在阶段切换瞬间会闪烁
  const showCargo = weight > 1
  const stageLabel = STAGE_TEXT[status] || status

  // LED 颜色稳定化：装/卸属"工作中"统一橙黄；运/返属"行驶中"统一绿色
  const statusLedColor =
    status === 'loading' || status === 'unloading' ? '#ffc857' :
    status === 'stopped' ? '#ff6b6b' :
    '#42e07b'

  return (
    <group ref={group} position={position}>
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
            <meshStandardMaterial color={CARGO_COLORS[cargoType] || '#888'} roughness={0.7} />
          </mesh>
          {/* 货物顶部装载提示线 */}
          <mesh position={[0, 0.38, 0]}>
            <boxGeometry args={[1.55, 0.04, 1.85]} />
            <meshBasicMaterial color="#000" transparent opacity={0.4} />
          </mesh>
        </group>
      )}

      {/* 状态信息标签 - 始终显示完整工艺信息 */}
      <Html position={[0, 3.5, 0]} center distanceFactor={15} style={{ pointerEvents: 'none' }}>
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
                {weight > 0 ? (CARGO_NAMES[cargoType] || '物料') : '空载'}
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
    </group>
  )
}
