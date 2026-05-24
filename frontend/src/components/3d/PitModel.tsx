import { memo, useState } from 'react'
import { Html } from '@react-three/drei'

interface PitModelProps {
  position: [number, number, number]
  pitNo: string
  status: string
  stage?: string
  fermentationDay?: number
  phValue?: number
  temperature: number
  onClick?: () => void
}

const COLOR_BY_STATUS: Record<string, string> = {
  alarm: '#ff4d4f',
  warning: '#faad14',
  normal: '#1890ff',
}

const STAGE_LABEL: Record<string, string> = {
  empty: '空池',
  filling: '入池中',
  fermenting: '发酵中',
  ready: '待起糟',
  discharging: '起糟中',
}

/**
 * 窖池 3D 模型 (优化版)
 * - boxGeometry 缩到 2.2 单位以匹配 3 单位间距, 让池子之间留出 0.8 单位空隙
 * - 半透明池面 + 边缘高亮，凸显单个窖池
 * - Hover 时 Html 浮卡显示工艺信息 (温度/pH/阶段/发酵天数)
 */
function PitModelImpl({ position, pitNo, status, stage, fermentationDay, phValue, temperature, onClick }: PitModelProps) {
  const [hovered, setHovered] = useState(false)
  const color = hovered
    ? '#69c0ff'
    : COLOR_BY_STATUS[status] || COLOR_BY_STATUS.normal

  return (
    <group position={position}>
      {/* 池体主壁 (缩小到 2.2 单位, 在 3 单位间距下留 0.8 单位通道) */}
      <mesh
        onClick={(e) => {
          e.stopPropagation()
          onClick?.()
        }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true) }}
        onPointerOut={(e) => { e.stopPropagation(); setHovered(false) }}
        position={[0, -0.3, 0]}
      >
        <boxGeometry args={[2.2, 1.1, 2.2]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={status === 'alarm' ? 0.75 : (hovered ? 1.0 : 0.85)}
          roughness={0.85}
          metalness={0.15}
          emissive={status === 'alarm' ? '#ff4d4f' : (hovered ? color : '#000')}
          emissiveIntensity={status === 'alarm' ? 0.3 : (hovered ? 0.2 : 0)}
        />
      </mesh>
      {/* 池子石框边缘 (略大于池壁) */}
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[2.5, 0.15, 2.5]} />
        <meshStandardMaterial color={hovered ? '#999' : '#555'} metalness={0.4} roughness={0.6} />
      </mesh>

      {/* Hover 时显示详细工艺信息卡 */}
      {hovered && (
        <Html position={[0, 1.5, 0]} center distanceFactor={14} style={{ pointerEvents: 'none' }}>
          <div className="bg-black/85 text-white px-2 py-1.5 rounded text-[10px] whitespace-nowrap border border-cyan-400/40 shadow-lg">
            <div className="font-bold text-cyan-300 text-[11px]">{pitNo}</div>
            <div className="border-t border-white/10 my-1" />
            <div>温度 <span className="text-orange-300">{temperature.toFixed(1)}°C</span></div>
            {phValue != null && (
              <div>pH值 <span className="text-blue-300">{phValue.toFixed(2)}</span></div>
            )}
            <div>状态 <span className={
              status === 'alarm' ? 'text-red-400' :
              status === 'warning' ? 'text-yellow-400' :
              'text-green-400'
            }>{status === 'normal' ? '正常' : status === 'warning' ? '警告' : status === 'alarm' ? '告警' : status}</span></div>
            {stage && (
              <div>阶段 <span className="text-purple-300">{STAGE_LABEL[stage] || stage}</span></div>
            )}
            {fermentationDay != null && fermentationDay > 0 && (
              <div>发酵 <span className="text-cyan-300">{fermentationDay} 天</span></div>
            )}
          </div>
        </Html>
      )}
    </group>
  )
}

export default memo(PitModelImpl, (prev, next) =>
  prev.pitNo === next.pitNo &&
  prev.status === next.status &&
  prev.stage === next.stage &&
  prev.fermentationDay === next.fermentationDay &&
  // 温度按 0.5°C 颗粒度比较；pH 按 0.1 颗粒度（避免每次微小抖动都重渲染）
  Math.abs(prev.temperature - next.temperature) < 0.5 &&
  Math.abs((prev.phValue ?? 0) - (next.phValue ?? 0)) < 0.1 &&
  prev.position[0] === next.position[0] &&
  prev.position[1] === next.position[1] &&
  prev.position[2] === next.position[2]
)
