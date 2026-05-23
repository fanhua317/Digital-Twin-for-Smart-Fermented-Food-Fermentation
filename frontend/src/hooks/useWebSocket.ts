import { useEffect, useRef } from 'react'
import { useStore } from '@/store'

type MessageHandler = (data: any) => void

/**
 * 安全关闭 WebSocket：
 * - 已 OPEN：直接 close
 * - 仍在 CONNECTING：等到 open 后再 close（避免在握手期间 close 触发 onerror）
 */
function safeCloseWebSocket(ws: WebSocket | null) {
  if (!ws) return
  if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CLOSING) {
    ws.close()
  } else if (ws.readyState === WebSocket.CONNECTING) {
    ws.addEventListener('open', () => ws.close(), { once: true })
  }
}

export function useWebSocket(channel: string = 'all', onMessage?: MessageHandler) {
  const wsRef = useRef<WebSocket | null>(null)
  const onMessageRef = useRef<MessageHandler | undefined>(onMessage)

  // 用 ref 持有 store actions, 避免 connect 重新创建导致 useEffect 重跑
  const setWsConnected = useStore((s) => s.setWsConnected)
  const setActiveAlarms = useStore((s) => s.setActiveAlarms)
  const setWsConnectedRef = useRef(setWsConnected)
  const setActiveAlarmsRef = useRef(setActiveAlarms)
  setWsConnectedRef.current = setWsConnected
  setActiveAlarmsRef.current = setActiveAlarms

  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  useEffect(() => {
    let isCancelled = false
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    const buildWsUrl = () => {
      // 开发环境(localhost/127.0.0.1)直连后端 8000 端口，
      // 避免 Vite/Browser Preview 的 WS 代理问题
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

    const connect = () => {
      if (isCancelled) return

      const wsUrl = buildWsUrl()
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        if (isCancelled) {
          ws.close()
          return
        }
        console.log(`WebSocket connected to ${channel}`)
        setWsConnectedRef.current(true)
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (
            data.type === 'dashboard_update' &&
            data.data?.alarms?.active !== undefined
          ) {
            setActiveAlarmsRef.current(data.data.alarms.active)
          }
          onMessageRef.current?.(data)
        } catch (error) {
          console.error('WebSocket message parse error:', error)
        }
      }

      ws.onclose = () => {
        setWsConnectedRef.current(false)
        if (isCancelled) return
        // 自动重连
        reconnectTimer = setTimeout(() => {
          if (!isCancelled) connect()
        }, 3000)
      }

      ws.onerror = () => {
        // CONNECTING 期间被 close 是正常现象（StrictMode/卸载），仅在非取消状态下记录
        if (!isCancelled) {
          console.warn('WebSocket error (will reconnect)', ws.readyState)
        }
      }
    }

    connect()

    // 心跳
    const heartbeat = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send('ping')
      }
    }, 30000)

    return () => {
      isCancelled = true
      clearInterval(heartbeat)
      if (reconnectTimer) clearTimeout(reconnectTimer)
      safeCloseWebSocket(wsRef.current)
      wsRef.current = null
    }
  }, [channel])

  return wsRef
}
