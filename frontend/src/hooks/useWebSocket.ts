import { useEffect, useRef } from 'react'
import { useStore } from '@/store'

type MessageHandler = (data: any) => void

/**
 * 单例 WebSocket 共享层：
 * - 多个 useWebSocket() 调用共享同一条 TCP 连接，避免每个组件各开一条
 * - 全局自动处理 sim_snapshot / dashboard_update 写入 store
 * - 组件订阅 onMessage 只是注册一个回调，不再创建新连接
 */
type Subscriber = { id: number; handler: MessageHandler }

let sharedWs: WebSocket | null = null
let sharedWsConnecting = false
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let heartbeatTimer: ReturnType<typeof setInterval> | null = null
const subscribers = new Map<number, Subscriber>()
let subscriberSeq = 0

function buildWsUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const isDev =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  const isBackendItself = window.location.port === '8000'
  const host =
    isDev && !isBackendItself
      ? `${window.location.hostname}:8000`
      : window.location.host
  return `${protocol}//${host}/ws/realtime`
}

function ensureSharedWs() {
  if (sharedWs && (sharedWs.readyState === WebSocket.OPEN || sharedWs.readyState === WebSocket.CONNECTING)) {
    return
  }
  if (sharedWsConnecting) return
  sharedWsConnecting = true

  const ws = new WebSocket(buildWsUrl())
  sharedWs = ws

  const setWsConnected = useStore.getState().setWsConnected
  const setActiveAlarms = useStore.getState().setActiveAlarms
  const setSimulation = useStore.getState().setSimulation

  ws.onopen = () => {
    sharedWsConnecting = false
    setWsConnected(true)
    if (heartbeatTimer) clearInterval(heartbeatTimer)
    heartbeatTimer = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send('ping')
    }, 30000)
  }

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data)
      // 全局副作用：写入 store
      if (msg.type === 'dashboard_update' && msg.data?.alarms?.active !== undefined) {
        setActiveAlarms(msg.data.alarms.active)
      }
      if (msg.type === 'sim_snapshot' && msg.data) {
        setSimulation(msg.data)
      }
      // 广播给所有订阅者
      subscribers.forEach((s) => {
        try { s.handler(msg) } catch (e) { console.error('ws subscriber error', e) }
      })
    } catch (e) {
      console.error('WebSocket message parse error:', e)
    }
  }

  ws.onclose = () => {
    sharedWsConnecting = false
    setWsConnected(false)
    sharedWs = null
    if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null }
    // 仍有订阅者时自动重连
    if (subscribers.size > 0) {
      if (reconnectTimer) clearTimeout(reconnectTimer)
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null
        if (subscribers.size > 0) ensureSharedWs()
      }, 3000)
    }
  }

  ws.onerror = () => {
    console.warn('WebSocket error', ws.readyState)
  }
}

function disposeSharedWs() {
  if (subscribers.size > 0) return
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null }
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
  if (sharedWs) {
    const ws = sharedWs
    sharedWs = null
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CLOSING) {
      ws.close()
    } else if (ws.readyState === WebSocket.CONNECTING) {
      ws.addEventListener('open', () => ws.close(), { once: true })
    }
  }
}

/**
 * 订阅共享 WebSocket。多个组件调用本 hook 不会创建新连接，
 * 第一次调用会建立共享连接，最后一个组件卸载后才关闭。
 *
 * @param _channel 仅作语义标记，不影响连接（向后兼容旧调用方）
 * @param onMessage 该订阅者关心的消息回调
 */
export function useWebSocket(_channel: string = 'all', onMessage?: MessageHandler) {
  // 用 ref 持有最新 onMessage，避免回调引用变化引起 effect 重跑
  const onMessageRef = useRef<MessageHandler | undefined>(onMessage)
  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  useEffect(() => {
    const id = ++subscriberSeq
    subscribers.set(id, {
      id,
      handler: (msg) => onMessageRef.current?.(msg),
    })
    ensureSharedWs()
    return () => {
      subscribers.delete(id)
      // 全部组件卸载后关闭连接
      if (subscribers.size === 0) {
        // 延迟关闭以便快速热加载场景下复用
        setTimeout(() => { if (subscribers.size === 0) disposeSharedWs() }, 500)
      }
    }
  }, [])
}
