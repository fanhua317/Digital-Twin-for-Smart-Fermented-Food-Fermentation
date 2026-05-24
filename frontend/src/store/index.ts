import { create } from 'zustand'

// ========== 仪表盘 ==========
interface DashboardStats {
  totalPits: number
  normalPits: number
  warningPits: number
  alarmPits: number
  totalDevices: number
  runningDevices: number
  faultDevices: number
  activeAlarms: number
  inProgressBatches: number
  totalProduction: number
  avgTemperature: number
  avgHumidity: number
}

// ========== 后端工艺仿真快照 (SSoT) ==========

/** 设备工位实时状态 */
export interface EquipmentState {
  code: string
  deviceId?: number
  name: string
  type: string
  stage: string
  status: string
  inputName: string
  outputName: string
  inputLevel: number
  outputLevel: number
  inputCapacity: number
  outputCapacity: number
  processRate: number
  conversionRate: number
  auxName?: string
  auxLevel?: number
  auxCapacity?: number
  power: number
  temperature: number
  totalProcessed: number
  totalOutput: number
  position: [number, number, number]
}

/** AGV 实时状态 */
export interface AGVState {
  code: string
  task: string
  cargoType: string
  stage: string
  fromCode?: string
  toCode?: string
  weight: number
  weightCapacity: number
  temperature: number
  ph: number
  moisture: number
  segmentIndex: number
  segmentProgress: number
  position: [number, number, number]
  path: [number, number, number][]
  speed: number
  cycleCount: number
  totalTransported: number
  /** RFID 写入：起糟时记录来源窖池号 (仅 AGV-01/06) */
  sourcePitNo?: string
  grainCategory?: string
  dischargeLayer?: number
  dischargeTime?: string
}

export interface SimulationStats {
  totalTransported: number
  totalProcessed: number
  totalLiquor: number
  completedCycles: number
  efficiency: number
  totalPower: number
  yieldRate: number
  simulatedDays: number
}

export interface BatchSummary {
  id: number
  batchNo: string
  productType: string
  targetVolume: number
  actualVolume: number
  progress: number
  stage: string
}

export interface LiquorStorage {
  headLiquor: number
  midLiquor: number
  tailLiquor: number
  capacity: number
  midAlcoholDegree: number
}

export interface RawMaterialBin {
  code: string
  name: string
  level: number
  capacity: number
  feedRate: number
  totalFed: number
}

export interface CoolerStages {
  stage1Temp: number
  stage2Temp: number
  stage3Temp: number
  fanPower: number
  outletTemp: number
}

export interface SimulationSnapshot {
  uptimeSeconds: number
  timeScale: number
  paused: boolean
  equipments: Record<string, EquipmentState>
  agvs: Record<string, AGVState>
  stats: SimulationStats
  activeBatches: BatchSummary[]
  pitStageCounts: Record<string, number>
  pitGrainCategoryCounts?: Record<string, number>
  liquorStorage?: LiquorStorage
  rawMaterials?: Record<string, RawMaterialBin>
  coolerStages?: CoolerStages
  diuzaoBin?: RawMaterialBin
}

interface AppState {
  // 仪表盘
  dashboardStats: DashboardStats | null
  setDashboardStats: (stats: DashboardStats) => void

  // 活跃告警数
  activeAlarms: number
  setActiveAlarms: (count: number) => void

  // WebSocket
  wsConnected: boolean
  setWsConnected: (connected: boolean) => void

  // 后端推送的工艺仿真快照
  simulation: SimulationSnapshot | null
  setSimulation: (snapshot: SimulationSnapshot) => void
}

export const useStore = create<AppState>((set) => ({
  dashboardStats: null,
  setDashboardStats: (stats) => set({ dashboardStats: stats }),

  activeAlarms: 0,
  setActiveAlarms: (count) => set({ activeAlarms: count }),

  wsConnected: false,
  setWsConnected: (connected) => set({ wsConnected: connected }),

  simulation: null,
  setSimulation: (snapshot) => set({ simulation: snapshot }),
}))
