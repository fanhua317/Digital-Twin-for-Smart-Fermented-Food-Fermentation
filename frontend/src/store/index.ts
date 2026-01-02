import { create } from 'zustand'

interface DashboardStats {
  total_pits: number
  fermenting_pits: number
  idle_pits: number
  total_devices: number
  running_devices: number
  warning_devices: number
  error_devices: number
  active_alarms: number
  today_production: number
  avg_temperature: number
  avg_humidity: number
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
