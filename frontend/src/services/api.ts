import axios from 'axios'

const isDevServer = window.location.port === '3000'
const apiBaseUrl = isDevServer ? 'http://localhost:8000/api/v1' : '/api/v1'

const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    // 可以在这里添加token等认证信息
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    const payload = response.data
    if (payload && typeof payload === 'object' && 'success' in payload) {
      if (!payload.success) {
        return Promise.reject(new Error(payload.message || 'API Error'))
      }
      return payload.data
    }
    return payload
  },
  (error) => {
    console.error('API Error:', error)
    return Promise.reject(error)
  }
)

// Dashboard API
export const dashboardApi = {
  getStats: () => api.get('/dashboard/stats'),
  getOverview: () => api.get('/dashboard/overview'),
  getRealtimeMetrics: () => api.get('/dashboard/realtime-metrics'),
}

// Pits API
export const pitsApi = {
  list: (params?: any) => api.get('/pits', { params }),
  getStats: () => api.get('/pits/stats'),
  getHeatmap: () => api.get('/pits/heatmap'),
  getById: (id: number) => api.get(`/pits/${id}`),
  getSensors: (id: number, hours?: number) => 
    api.get(`/pits/${id}/sensors`, { params: { hours } }),
  getLatestSensor: (id: number) => api.get(`/pits/${id}/sensors/latest`),
  updateStatus: (id: number, status: string, batchCode?: string) =>
    api.put(`/pits/${id}/status`, null, { params: { status, batch_code: batchCode } }),
}

// Devices API
export const devicesApi = {
  list: (params?: any) => api.get('/devices', { params }),
  getStats: () => api.get('/devices/stats'),
  getTypes: () => api.get('/devices/types'),
  getById: (id: number) => api.get(`/devices/${id}`),
  getData: (id: number, hours?: number) => 
    api.get(`/devices/${id}/data`, { params: { hours } }),
  getLatestData: (id: number) => api.get(`/devices/${id}/data/latest`),
  updateStatus: (id: number, status: string) =>
    api.put(`/devices/${id}/status`, null, { params: { status } }),
}

// Alarms API
export const alarmsApi = {
  list: (params?: any) => api.get('/alarms', { params }),
  getActive: () => api.get('/alarms/active'),
  getStats: () => api.get('/alarms/stats'),
  getById: (id: number) => api.get(`/alarms/${id}`),
  resolve: (id: number, resolvedBy?: string) =>
    api.put(`/alarms/${id}/resolve`, null, { params: { resolved_by: resolvedBy } }),
  resolveBatch: (ids: number[], resolvedBy?: string) =>
    api.put('/alarms/resolve-batch', null, { params: { alarm_ids: ids, resolved_by: resolvedBy } }),
}

// Production API
export const productionApi = {
  listBatches: (params?: any) => api.get('/production/batches', { params }),
  getBatchStats: () => api.get('/production/batches/stats'),
  getBatchById: (id: number) => api.get(`/production/batches/${id}`),
  createBatch: (data: any) => api.post('/production/batches', data),
  startBatch: (id: number) => api.put(`/production/batches/${id}/start`),
  completeBatch: (id: number, actualAlcohol: number, wineGrade: string) =>
    api.put(`/production/batches/${id}/complete`, null, { 
      params: { actual_alcohol: actualAlcohol, wine_grade: wineGrade } 
    }),
  getTrends: (days?: number) => api.get('/production/trends', { params: { days } }),
  getParams: (processName?: string) => 
    api.get('/production/params', { params: { process_name: processName } }),
  updateParam: (id: number, value: number) =>
    api.put(`/production/params/${id}`, null, { params: { value } }),
}

export default api
