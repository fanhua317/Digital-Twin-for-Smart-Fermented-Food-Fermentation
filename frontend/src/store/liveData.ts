/**
 * 模块级可变缓存：供 useFrame 直接读写，完全绕过 React 渲染周期。
 *
 * 设计原则：
 * - 位置/阶段等每 500ms 变化的高频数据只写入此处，不触发 setState
 * - React store (Zustand) 仅用于需要驱动 React 重渲染的低频数据（每 2s 节流）
 * - Three.js useFrame 从此处读取数据，实现 60fps 平滑动画
 */

export interface LiveAGVEntry {
  position: [number, number, number]
  stage: string
  cargoType: string
  weight: number
  weightCapacity: number
  temperature: number
  ph: number
  task: string
  sourcePitNo?: string
}

/** AGV 实时状态缓存（mutable，不触发 React 渲染） */
export const liveAgvCache: Record<string, LiveAGVEntry> = {}

/** 从 sim_snapshot 更新 AGV 缓存 */
export function updateLiveAgvCache(agvs: Record<string, any>) {
  for (const [code, agv] of Object.entries(agvs)) {
    liveAgvCache[code] = {
      position: agv.position ?? [0, 0, 0],
      stage: agv.stage ?? 'idle',
      cargoType: agv.cargoType ?? 'empty',
      weight: agv.weight ?? 0,
      weightCapacity: agv.weightCapacity ?? 900,
      temperature: agv.temperature ?? 25,
      ph: agv.ph ?? 4,
      task: agv.task ?? '',
      sourcePitNo: agv.sourcePitNo,
    }
  }
}
