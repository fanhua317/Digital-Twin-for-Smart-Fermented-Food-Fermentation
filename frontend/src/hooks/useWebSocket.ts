import { useEffect, useRef, useCallback } from 'react'
import { useStore } from '@/store'

type MessageHandler = (data: any) => void

export function useWebSocket(channel: string = 'all', onMessage?: MessageHandler) {
  const wsRef = useRef<WebSocket | null>(null)
  const onMessageRef = useRef<MessageHandler | undefined>(onMessage)
  const { setWsConnected, setActiveAlarms } = useStore()

  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.port === '3000'
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
      // 自动重连
      setTimeout(() => {
        if (wsRef.current === ws) {
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
    connect()

    // 心跳
    const heartbeat = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send('ping')
      }
    }, 30000)

    return () => {
      clearInterval(heartbeat)
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [connect])

  return wsRef
}
