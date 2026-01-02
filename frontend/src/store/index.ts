import { create } from 'zustand'

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

// 设备物料状态接口 (3D仿真核心数据)
export interface DeviceMaterialState {
  id: string
  inputName: string
  outputName: string
  inputLevel: number
  outputLevel: number
  processRate: number
  auxLevel?: number
  auxName?: string
}

// AGV 状态接口
export interface AGVState {
  id: string
  status: 'loading' | 'moving' | 'unloading' | 'returning'
  cargoType: string
  weight: number
  temperature: number
  ph: number
  position: [number, number, number]
}

// 仿真统计数据
export interface SimulationStats {
  totalTransported: number      // 总运输量
  totalProcessed: number        // 总处理量
  efficiency: number            // 系统效率 %
  uptime: number                // 运行时间 (秒)
  cycleCount: number            // 完成周期数
}

interface AppState {
  // 仪表盘统计
  dashboardStats: DashboardStats | null
  setDashboardStats: (stats: DashboardStats) => void
  
  // 活跃告警数
  activeAlarms: number
  setActiveAlarms: (count: number) => void
  
  // WebSocket连接状态
  wsConnected: boolean
  setWsConnected: (connected: boolean) => void
  
  // 实时数据
  realtimeData: any
  setRealtimeData: (data: any) => void
  
  // ========== 3D 仿真全局状态 (新增) ==========
  
  // 仿真是否运行
  isSimulationRunning: boolean
  setSimulationRunning: (running: boolean) => void

  // 3D场景是否激活
  is3DSceneActive: boolean
  set3DSceneActive: (active: boolean) => void
  
  // 设备物料状态 (核心同步数据)
  deviceMaterials: Record<string, DeviceMaterialState>
  setDeviceMaterials: (materials: Record<string, DeviceMaterialState>) => void
  updateDeviceMaterial: (deviceId: string, updates: Partial<DeviceMaterialState>) => void
  
  // AGV 状态
  agvStates: Record<string, AGVState>
  setAGVStates: (states: Record<string, AGVState>) => void
  updateAGVState: (agvId: string, updates: Partial<AGVState>) => void
  
  // 仿真统计
  simulationStats: SimulationStats
  updateSimulationStats: (updates: Partial<SimulationStats>) => void
  
  // 物料交易日志 (用于审计和调试)
  materialTransactions: Array<{
    timestamp: number
    agvId: string
    type: 'load' | 'unload'
    deviceId: string
    amount: number
    deviceBefore: number
    deviceAfter: number
    agvBefore: number
    agvAfter: number
  }>
  addMaterialTransaction: (transaction: Omit<AppState['materialTransactions'][0], 'timestamp'>) => void
}

export const useStore = create<AppState>((set) => ({
  // 仪表盘统计
  dashboardStats: null,
  setDashboardStats: (stats) => set({ dashboardStats: stats }),
  
  // 活跃告警数
  activeAlarms: 0,
  setActiveAlarms: (count) => set({ activeAlarms: count }),
  
  // WebSocket连接状态
  wsConnected: false,
  setWsConnected: (connected) => set({ wsConnected: connected }),
  
  // 实时数据
  realtimeData: null,
  setRealtimeData: (data) => set({ realtimeData: data }),
  
  // ========== 3D 仿真全局状态 ==========
  
  isSimulationRunning: false,
  setSimulationRunning: (running) => set({ isSimulationRunning: running }),

  is3DSceneActive: false,
  set3DSceneActive: (active) => set({ is3DSceneActive: active }),
  
  // 设备物料状态
  deviceMaterials: {
    'D001': { id: 'D001', inputName: '出窖糟醅', outputName: '润粮', inputLevel: 500, outputLevel: 200, processRate: 30 },
    'D002': { id: 'D002', inputName: '润粮', outputName: '上甑粮', inputLevel: 400, outputLevel: 300, processRate: 40 },
    'D003': { id: 'D003', inputName: '输送效率', outputName: '累计输送', inputLevel: 50, outputLevel: 0, processRate: 50 },
    'DistillationTower': { 
      id: 'DistillationTower', 
      inputName: '上甑粮', 
      outputName: '酒糟', 
      inputLevel: 600, 
      outputLevel: 100, 
      processRate: 35,
      auxName: '加压热水',
      auxLevel: 500
    },
    'D004': { id: 'D004', inputName: '酒糟', outputName: '入池糟醅', inputLevel: 300, outputLevel: 400, processRate: 45 },
  },
  setDeviceMaterials: (materials) => set({ deviceMaterials: materials }),
  updateDeviceMaterial: (deviceId, updates) => set((state) => ({
    deviceMaterials: {
      ...state.deviceMaterials,
      [deviceId]: { ...state.deviceMaterials[deviceId], ...updates }
    }
  })),
  
  // AGV 状态
  agvStates: {
    'AGV-01': { id: 'AGV-01', status: 'loading', cargoType: 'fermented', weight: 0, temperature: 32.5, ph: 3.8, position: [-15, 0, -30] },
    'AGV-02': { id: 'AGV-02', status: 'loading', cargoType: 'mixed', weight: 0, temperature: 26.0, ph: 4.2, position: [-25, 0, -15] },
    'AGV-03': { id: 'AGV-03', status: 'loading', cargoType: 'mixed', weight: 0, temperature: 26.0, ph: 4.2, position: [-25, 0, 0] },
    'AGV-04': { id: 'AGV-04', status: 'loading', cargoType: 'distilled', weight: 0, temperature: 85.0, ph: 3.5, position: [0, 0, 0] },
    'AGV-05': { id: 'AGV-05', status: 'loading', cargoType: 'cooled', weight: 0, temperature: 28.0, ph: 3.6, position: [25, 0, 0] },
  },
  setAGVStates: (states) => set({ agvStates: states }),
  updateAGVState: (agvId, updates) => set((state) => ({
    agvStates: {
      ...state.agvStates,
      [agvId]: { ...state.agvStates[agvId], ...updates }
    }
  })),
  
  // 仿真统计
  simulationStats: {
    totalTransported: 0,
    totalProcessed: 0,
    efficiency: 95.5,
    uptime: 0,
    cycleCount: 0,
  },
  updateSimulationStats: (updates) => set((state) => ({
    simulationStats: { ...state.simulationStats, ...updates }
  })),
  
  // 物料交易日志
  materialTransactions: [],
  addMaterialTransaction: (transaction) => set((state) => ({
    materialTransactions: [
      ...state.materialTransactions.slice(-99), // 保留最近100条
      { ...transaction, timestamp: Date.now() }
    ]
  })),
}))
