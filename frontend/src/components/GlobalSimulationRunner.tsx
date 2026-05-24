/**
 * 全局仿真订阅器 - 后端 ProcessSimulationService 是 SSoT
 * 此处仅保留组件壳，订阅由 useWebSocket 完成。保留挂载用于触发 WebSocket 钩子。
 */
import { useWebSocket } from '../hooks/useWebSocket'

export default function GlobalSimulationRunner() {
  // 订阅后端工艺主仿真器推送的 sim_snapshot
  useWebSocket('global-sim')
  return null
}
