import { useRef, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

export type CargoType = 'grain' | 'fermented' | 'mixed' | 'distilled' | 'cooled' | 'empty'

export interface CargoStats {
  temperature: number
  ph: number
  weight: number
}

interface AGVModelProps {
  path: [number, number, number][]
  speed?: number
  status: string
  cargoType?: CargoType
  agvId?: string
  baseStats?: CargoStats
  onTaskComplete?: (type: 'load' | 'unload', amount: number) => number | void
}

const CARGO_COLORS: Record<CargoType, string> = {
  grain: '#e6c65c',      // 原粮 - 金黄
  fermented: '#5c4033',  // 发酵粮 - 深褐
  mixed: '#8b7355',      // 拌合粮 - 杂色
  distilled: '#f0f0f0',  // 酒糟 - 灰白
  cooled: '#d2b48c',     // 摊凉粮 - 浅褐
  empty: '#333333'       // 空载
}

const CARGO_NAMES: Record<CargoType, string> = {
  grain: '原粮',
  fermented: '出窖糟醅',
  mixed: '拌合粮',
  distilled: '蒸馏酒糟',
  cooled: '加曲粮',
  empty: '空载'
}

export default function AGVModel({ 
  path, 
  speed = 2, 
  status, 
  cargoType = 'grain', 
  agvId = 'AGV-01',
  baseStats = { temperature: 25, ph: 7.0, weight: 500 },
  onTaskComplete
}: AGVModelProps) {
  const group = useRef<THREE.Group>(null!)
  const progress = useRef(0)
  const currentSegment = useRef(0)
  const direction = useRef(1) // 1: Forward, -1: Backward
  
  // 状态管理: moving(去程), unloading(卸货), returning(返程), loading(装货)
  const [internalState, setInternalState] = useState<'moving' | 'loading' | 'unloading' | 'returning'>('loading')
  const [stats, setStats] = useState<CargoStats>(baseStats)
  const waitTimer = useRef(2)
  
  // 使用 ref 存储回调和当前状态，避免 useFrame 中的闭包问题
  const onTaskCompleteRef = useRef(onTaskComplete)
  const statsRef = useRef(stats)

  useEffect(() => {
    onTaskCompleteRef.current = onTaskComplete
  }, [onTaskComplete])

  useEffect(() => {
    statsRef.current = stats
  }, [stats])

  // 装货时重置/波动数据
  useEffect(() => {
    if (internalState === 'loading') {
       const newStats = {
         temperature: Number((baseStats.temperature + (Math.random() * 2 - 1)).toFixed(1)),
         ph: Number((baseStats.ph + (Math.random() * 0.2 - 0.1)).toFixed(1)),
         weight: Math.floor(baseStats.weight + (Math.random() * 10 - 5))
       }
       setStats(newStats)
       // 立即更新 ref 以便 useFrame 能获取到最新值
       statsRef.current = newStats
    }
  }, [internalState, baseStats])

  useFrame((_state, delta) => {
    // 只有 status === 'active' 时才运行动画
    if (status !== 'active' || path.length < 2) return

    // 处理等待逻辑
    if (waitTimer.current > 0) {
      waitTimer.current -= delta
      if (waitTimer.current <= 0) {
        if (internalState === 'loading') {
          setInternalState('moving')
          direction.current = 1
          currentSegment.current = 0
          progress.current = 0
          // 装货完成，携带当前重量出发
          if (onTaskCompleteRef.current) {
            const actualLoad = onTaskCompleteRef.current('load', statsRef.current.weight)
            // 如果回调返回了实际装载量，则更新车辆状态
            if (typeof actualLoad === 'number') {
              const newStats = { ...statsRef.current, weight: actualLoad }
              setStats(newStats)
              statsRef.current = newStats
            }
          }
        } else if (internalState === 'unloading') {
          setInternalState('returning')
          direction.current = -1
          currentSegment.current = path.length - 2 // 从倒数第二段开始往回走
          progress.current = 1 // 进度从1开始递减
          // 卸货完成，卸下当前重量
          if (onTaskCompleteRef.current) {
            const unloadedAmount = onTaskCompleteRef.current('unload', statsRef.current.weight)
            // 如果回调返回了实际卸货量，则更新车辆状态 (通常应变为0)
            if (typeof unloadedAmount === 'number') {
               const remainingWeight = Math.max(0, statsRef.current.weight - unloadedAmount)
               const newStats = { ...statsRef.current, weight: remainingWeight }
               setStats(newStats)
               statsRef.current = newStats
            }
          }
        }
      }
      return
    }

    // 移动逻辑
    const segIdx = currentSegment.current
    const p1 = new THREE.Vector3(...path[segIdx])
    const p2 = new THREE.Vector3(...path[segIdx + 1])
    const dist = p1.distanceTo(p2)
    
    // 更新进度
    if (direction.current === 1) {
        progress.current += (speed * delta) / dist
    } else {
        progress.current -= (speed * delta) / dist
    }

    // 检查段落完成
    if (direction.current === 1 && progress.current >= 1) {
        if (currentSegment.current < path.length - 2) {
            progress.current = 0
            currentSegment.current++
        } else {
            // 到达终点
            setInternalState('unloading')
            waitTimer.current = 2
            return
        }
    } else if (direction.current === -1 && progress.current <= 0) {
        if (currentSegment.current > 0) {
            progress.current = 1
            currentSegment.current--
        } else {
            // 回到起点
            setInternalState('loading')
            waitTimer.current = 2
            return
        }
    }

    // 插值计算位置
    // 无论是去程还是返程，lerpVectors(p1, p2, progress) 都是正确的
    // 去程 progress 0->1 (p1->p2)
    // 返程 progress 1->0 (p2->p1)
    group.current.position.lerpVectors(p1, p2, progress.current)
    
    // 朝向控制
    if (direction.current === 1) {
        group.current.lookAt(p2)
    } else {
        group.current.lookAt(p1)
    }
  })

  return (
    <group 
      ref={group} 
      position={path[0]} 
    >
      {/* 车身 */}
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[2, 1, 3]} />
        <meshStandardMaterial color="#faad14" />
      </mesh>
      
      {/* 轮子 */}
      <mesh position={[1.1, 0.25, 1]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.25, 0.25, 0.2]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      <mesh position={[-1.1, 0.25, 1]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.25, 0.25, 0.2]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      <mesh position={[1.1, 0.25, -1]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.25, 0.25, 0.2]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      <mesh position={[-1.1, 0.25, -1]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.25, 0.25, 0.2]} />
        <meshStandardMaterial color="#333" />
      </mesh>

      {/* 货物 - 仅在装货完成且未卸货时显示 (moving状态) */}
      {internalState === 'moving' && (
        <mesh position={[0, 1.5, 0]}>
          <boxGeometry args={[1.5, 0.8, 2]} />
          <meshStandardMaterial color={CARGO_COLORS[cargoType]} />
        </mesh>
      )}
      
      {/* 装卸货动画效果 (半透明) */}
      {(internalState === 'loading' || internalState === 'unloading') && (
        <mesh position={[0, 1.5, 0]}>
          <boxGeometry args={[1.5, 0.8, 2]} />
          <meshStandardMaterial 
            color={CARGO_COLORS[cargoType]} 
            transparent 
            opacity={0.5} 
          />
        </mesh>
      )}

      {/* 基础标签 */}
      <Html position={[0, 3.5, 0]} center distanceFactor={15} style={{ pointerEvents: 'none' }}>
        <div className="text-xs px-2 py-1 rounded bg-black/60 text-white border border-white/20 backdrop-blur-sm min-w-[120px]">
          <div className="font-bold text-yellow-400 mb-1 flex justify-between">
            <span>{agvId}</span>
            <span className="text-[10px] text-gray-300">
              {internalState === 'moving' ? '运输中' : 
               internalState === 'returning' ? '空载返程' : 
               internalState === 'loading' ? '装货中' : '卸货中'}
            </span>
          </div>
          
          {/* 仅在非空载返程时显示货物详情 */}
          {internalState !== 'returning' && (
            <div className="text-[10px] leading-tight space-y-0.5">
              <div className="flex justify-between">
                <span className="text-gray-400">货物:</span>
                <span>{CARGO_NAMES[cargoType]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">温度:</span>
                <span className={stats.temperature > 40 ? 'text-red-400' : 'text-green-400'}>
                  {stats.temperature}°C
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">pH值:</span>
                <span>{stats.ph}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">重量:</span>
                <span>{stats.weight}kg</span>
              </div>
            </div>
          )}
        </div>
      </Html>
    </group>
  )
}
