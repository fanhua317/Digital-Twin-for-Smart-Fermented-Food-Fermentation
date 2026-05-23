import { useEffect, useRef, useCallback } from 'react'
import { useStore } from '@/store'

type MessageHandler = (data: any) => void

export function useWebSocket(channel: string = 'all', onMessage?: MessageHandler) {
  const wsRef = useRef<WebSocket | null>(null)
  const onMessageRef = useRef<MessageHandler | undefined>(onMessage)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isUnmountedRef = useRef(false)
  const { setWsConnected, setActiveAlarms } = useStore()

  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  const connect = useCallback(() => {
    if (isUnmountedRef.current) return

    // 开发环境(localhost/127.0.0.1)直连后端 8000 端口，避免 Vite/Browser Preview 的 WS 代理问题
    // 生产环境使用同源（由 nginx 等反向代理 /ws）
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    const isBackendItself = window.location.port === '8000'
    const host = isDev && !isBackendItself
      ? `${window.location.hostname}:8000`
      : window.location.host
    const wsUrl = `${protocol}//${host}/ws/realtime`

    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      console.log(`WebSocket connected to ${channel}`)
      setWsConnected(true)
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        // 更新活跃告警数
        if (data.type === 'dashboard_update' && data.data?.alarms?.active !== undefined) {
          setActiveAlarms(data.data.alarms.active)
        }

        // 调用自定义处理器
        onMessageRef.current?.(data)
      } catch (error) {
        console.error('WebSocket message parse error:', error)
      }
    }

    ws.onclose = () => {
      console.log('WebSocket disconnected', ws.readyState)
      setWsConnected(false)
      // 卸载后不再触发重连
      if (isUnmountedRef.current) return
      // 自动重连（保存 timer 以便卸载时清除）
      reconnectTimerRef.current = setTimeout(() => {
        if (wsRef.current === ws && !isUnmountedRef.current) {
          connect()
        }
      }, 3000)
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error, ws.readyState)
    }

    wsRef.current = ws
  }, [channel, setWsConnected, setActiveAlarms])

  useEffect(() => {
    isUnmountedRef.current = false
    connect()

    // 心跳
    const heartbeat = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send('ping')
      }
    }, 30000)

    return () => {
      isUnmountedRef.current = true
      clearInterval(heartbeat)
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [connect])

  return wsRef
}
