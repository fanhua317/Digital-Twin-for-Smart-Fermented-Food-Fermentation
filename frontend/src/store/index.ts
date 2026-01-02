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
}))
