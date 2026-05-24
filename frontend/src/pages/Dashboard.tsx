import { useEffect, useState } from 'react'
import { Row, Col, Card, Statistic, Progress, Badge, Typography, Space, Tag, Tabs } from 'antd'
import {
  ExperimentOutlined,
  SettingOutlined,
  AlertOutlined,
  RiseOutlined,
  FieldTimeOutlined,
  AppstoreOutlined,
  RobotOutlined,
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { dashboardApi, alarmsApi } from '@/services/api'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useStore } from '@/store'
import SimulationPanel from '@/components/SimulationPanel'

const { Title, Text } = Typography

interface DashboardStats {
  totalPits: number
  normalPits: number
  warningPits: number
  alarmPits: number
  totalDevices: number
  runningDevices: number
  faultDevices: number
  activeAlarms: number
  alarmsByLevel?: Record<string, number>
  inProgressBatches: number
  totalProduction: number
  avgTemperature: number
  avgHumidity: number
}

interface AlarmItem {
  id: number
  source: string
  level: string
  message: string
  createdAt: string
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [alarms, setAlarms] = useState<AlarmItem[]>([])
  const [overview, setOverview] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const { setDashboardStats, setActiveAlarms } = useStore()

  // 实时仿真快照 (1s 更新) - 用于覆盖 累计产量 / 生产进度 等高频字段
  const simulation = useStore((s) => s.simulation)

  // WebSocket实时更新
  useWebSocket('dashboard', (data) => {
    if (data.type === 'dashboard_update') {
      // 更新部分数据
      setStats(prev => prev ? {
        ...prev,
        avgTemperature: data.data.temperature?.average || prev.avgTemperature,
        activeAlarms: data.data.alarms?.active || prev.activeAlarms,
      } : prev)
    }
  })

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 5000) // 5秒刷新，让 累计产量/告警 等核心 KPI 接近实时
    return () => clearInterval(interval)
  }, [])

  // 用仿真快照实时覆盖 totalProduction (累计基酒) 和 production_progress (批次进度)
  const realtimeTotalProduction = simulation?.stats?.totalLiquor ?? stats?.totalProduction ?? 0
  const realtimeProgress = simulation?.activeBatches?.length
    ? simulation.activeBatches.map((b: any) => ({
        batch_code: b.batchNo,
        grain_type: b.productType,
        progress: Math.round(b.progress ?? 0),
      }))
    : overview?.production_progress ?? []

  const loadData = async () => {
    setLoading(true)
    try {
      // 先加载核心统计数据（快速）
      const [statsResult, alarmsResult] = await Promise.allSettled([
        dashboardApi.getStats(),
        alarmsApi.getActive(),
      ])
      
      if (statsResult.status === 'fulfilled') {
        let statsData = statsResult.value as any
        if (statsData?.data) statsData = statsData.data
        setStats(statsData as DashboardStats)
        setDashboardStats(statsData as DashboardStats)
      }
      
      if (alarmsResult.status === 'fulfilled') {
        let alarmsData = alarmsResult.value as any
        if (alarmsData?.data) alarmsData = alarmsData.data
        if (Array.isArray(alarmsData)) {
          setAlarms(alarmsData.slice(0, 5) as AlarmItem[])
          setActiveAlarms(alarmsData.length)
        }
      }
    } catch (error) {
      console.error('加载数据失败:', error)
    } finally {
      setLoading(false)
    }
    
    // 延迟加载overview（可能较慢，不阻塞主数据显示）
    loadOverviewAsync()
  }
  
  const loadOverviewAsync = async () => {
    try {
      const overviewResult = await dashboardApi.getOverview()
      let overviewData = overviewResult as any
      if (overviewData?.data) overviewData = overviewData.data
      setOverview(overviewData)
    } catch (error) {
      console.error('加载概览数据失败:', error)
    }
  }

  // 窖池状态饼图配置
  const pitChartOption = {
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, textStyle: { color: '#b7bcc7' } },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      data: [
        { value: stats?.normalPits || 0, name: '正常', itemStyle: { color: '#42e07b' } },
        { value: stats?.warningPits || 0, name: '警告', itemStyle: { color: '#ffc857' } },
        { value: stats?.alarmPits || 0, name: '告警', itemStyle: { color: '#ff6b6b' } },
      ],
      label: { color: '#e7e9ee' },
    }]
  }

  // 设备状态饼图配置
  const deviceChartOption = {
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, textStyle: { color: '#b7bcc7' } },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      data: [
        { value: stats?.runningDevices || 0, name: '运行中', itemStyle: { color: '#42e07b' } },
        { value: stats?.faultDevices || 0, name: '故障', itemStyle: { color: '#ff6b6b' } },
        { value: Math.max(0, (stats?.totalDevices || 0) - (stats?.runningDevices || 0) - (stats?.faultDevices || 0)), name: '其他', itemStyle: { color: '#5bc0ff' } },
      ],
      label: { color: '#e7e9ee' },
    }]
  }

  // 告警趋势图配置
  const alarmTrendOption = {
    tooltip: {
      trigger: 'axis',
      valueFormatter: (val: any) =>
        typeof val === 'number' ? val.toFixed(0) : val,
    },
    grid: { left: 40, right: 20, top: 20, bottom: 30 },
    xAxis: {
      type: 'category',
      data: overview?.alarm_trend?.map((t: any) => t.hour) || [],
      axisLabel: { color: '#8b92a1' },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#8b92a1' },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
    },
    series: [{
      data: overview?.alarm_trend?.map((t: any) => t.count) || [],
      type: 'line',
      smooth: true,
      areaStyle: { color: 'rgba(91, 192, 255, 0.25)' },
      lineStyle: { color: '#5bc0ff' },
    }]
  }

  const getAlarmColor = (level: string) => {
    switch (level) {
      case 'critical': return 'red'
      case 'error': return 'orange'
      case 'warning': return 'gold'
      default: return 'blue'
    }
  }

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>
        <Space>
          综合监控中心
          <Tag color={loading ? 'default' : 'green'}>
            {loading ? '加载中...' : '实时'}
          </Tag>
        </Space>
      </Title>

      <Tabs
        defaultActiveKey="overview"
        items={[
          {
            key: 'overview',
            label: (
              <span>
                <AppstoreOutlined />
                系统总览
              </span>
            ),
            children: (
              <>
                {/* 核心指标卡片 */}
                <Row gutter={[16, 16]}>
                  <Col xs={24} sm={12} lg={6}>
                    <Card className="glass-card hover-card">
                      <Statistic
                        title={<Text className="text-secondary">窖池总数</Text>}
                        value={stats?.totalPits || 0}
                        prefix={<ExperimentOutlined style={{ color: 'var(--accent-blue)' }} />}
                        suffix={
                          <Text className="text-secondary" style={{ fontSize: 14 }}>
                            / 正常 {stats?.normalPits || 0}
                          </Text>
                        }
                      />
                      <Progress 
                        percent={stats?.totalPits ? (stats.normalPits / stats.totalPits * 100) : 0} 
                        showInfo={false}
                        strokeColor="var(--accent-green)"
                        trailColor="rgba(255,255,255,0.06)"
                        style={{ marginTop: 8 }}
                      />
                    </Card>
                  </Col>

                  <Col xs={24} sm={12} lg={6}>
                    <Card className="glass-card hover-card">
                      <Statistic
                        title={<Text className="text-secondary">设备总数</Text>}
                        value={stats?.totalDevices || 0}
                        prefix={<SettingOutlined style={{ color: 'var(--accent-green)' }} />}
                        suffix={
                          <Text className="text-secondary" style={{ fontSize: 14 }}>
                            / 运行 {stats?.runningDevices || 0}
                          </Text>
                        }
                      />
                      <Progress 
                        percent={stats?.totalDevices ? (stats.runningDevices / stats.totalDevices * 100) : 0} 
                        showInfo={false}
                        strokeColor="var(--accent-green)"
                        trailColor="rgba(255,255,255,0.06)"
                        style={{ marginTop: 8 }}
                      />
                    </Card>
                  </Col>

                  <Col xs={24} sm={12} lg={6}>
                    <Card className="glass-card hover-card">
                      <Statistic
                        title={<Text className="text-secondary">活跃告警</Text>}
                        value={stats?.activeAlarms || 0}
                        prefix={<AlertOutlined style={{ color: stats?.activeAlarms ? 'var(--accent-red)' : 'var(--accent-green)' }} />}
                        valueStyle={{ color: stats?.activeAlarms ? 'var(--accent-red)' : 'var(--accent-green)' }}
                      />
                      <div style={{ marginTop: 8 }}>
                        <Space>
                          <Badge status="error" text={<Text className="text-secondary">严重 {stats?.alarmsByLevel?.critical || 0}</Text>} />
                          <Badge status="warning" text={<Text className="text-secondary">警告 {stats?.alarmsByLevel?.warning || 0}</Text>} />
                        </Space>
                      </div>
                    </Card>
                  </Col>

                  <Col xs={24} sm={12} lg={6}>
                    <Card className="glass-card hover-card">
                      <Statistic
                        title={<Text className="text-secondary">累计产量 (实时)</Text>}
                        value={realtimeTotalProduction}
                        precision={0}
                        prefix={<RiseOutlined style={{ color: 'var(--accent-yellow)' }} />}
                        suffix="kg"
                      />
                      <div style={{ marginTop: 8 }}>
                        <Text className="text-secondary">
                          <FieldTimeOutlined /> 平均温度: {(stats?.avgTemperature ?? 0).toFixed(1)}℃
                        </Text>
                      </div>
                    </Card>
                  </Col>
                </Row>

                {/* 图表区域 */}
                <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                  <Col xs={24} lg={8}>
                    <Card 
                      title="窖池状态分布" 
                      className="glass-card"
                      styles={{ header: { borderBottom: '1px solid rgba(255,255,255,0.06)' } }}
                    >
                      <ReactECharts option={pitChartOption} style={{ height: 260 }} />
                    </Card>
                  </Col>

                  <Col xs={24} lg={8}>
                    <Card 
                      title="设备状态分布" 
                      className="glass-card"
                      styles={{ header: { borderBottom: '1px solid rgba(255,255,255,0.06)' } }}
                    >
                      <ReactECharts option={deviceChartOption} style={{ height: 260 }} />
                    </Card>
                  </Col>

                  <Col xs={24} lg={8}>
                    <Card 
                      title="24小时告警趋势" 
                      className="glass-card"
                      styles={{ header: { borderBottom: '1px solid rgba(255,255,255,0.06)' } }}
                    >
                      <ReactECharts option={alarmTrendOption} style={{ height: 260 }} />
                    </Card>
                  </Col>
                </Row>

                {/* 告警列表和生产进度 */}
                <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                  <Col xs={24} lg={12}>
                    <Card 
                      title="最新告警" 
                      className="glass-card"
                      styles={{ header: { borderBottom: '1px solid rgba(255,255,255,0.06)' } }}
                      extra={<a href="/alarms">查看全部</a>}
                    >
                      {alarms.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 40 }}>
                          <Text className="text-secondary">暂无活跃告警</Text>
                        </div>
                      ) : (
                        alarms.map((alarm) => (
                          <div 
                            key={alarm.id} 
                            style={{ 
                              padding: '12px 0', 
                              borderBottom: '1px solid rgba(255,255,255,0.06)',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <div>
                              <Tag color={getAlarmColor(alarm.level)}>
                                {alarm.source}
                              </Tag>
                              <Text style={{ marginLeft: 8 }}>{alarm.message}</Text>
                            </div>
                            <Text className="text-secondary" style={{ fontSize: 12 }}>
                              {new Date(alarm.createdAt).toLocaleTimeString()}
                            </Text>
                          </div>
                        ))
                      )}
                    </Card>
                  </Col>

                  <Col xs={24} lg={12}>
                    <Card 
                      title="生产进度" 
                      className="glass-card"
                      styles={{ header: { borderBottom: '1px solid rgba(255,255,255,0.06)' } }}
                    >
                      {realtimeProgress.length ? (
                        realtimeProgress.map((batch: any) => (
                          <div key={batch.batch_code} style={{ marginBottom: 16 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <Text>{batch.batch_code}</Text>
                              <Text className="text-secondary">{batch.grain_type}</Text>
                            </div>
                            <Progress
                              percent={batch.progress}
                              strokeColor={{
                                '0%': '#5bc0ff',
                                '100%': '#42e07b',
                              }}
                              trailColor="rgba(255,255,255,0.06)"
                            />
                          </div>
                        ))
                      ) : (
                        <div style={{ textAlign: 'center', padding: 40 }}>
                          <Text className="text-secondary">暂无进行中的生产批次</Text>
                        </div>
                      )}
                    </Card>
                  </Col>
                </Row>
              </>
            ),
          },
          {
            key: 'simulation',
            label: (
              <span>
                <RobotOutlined />
                3D 仿真数据
              </span>
            ),
            children: <SimulationPanel />,
          },
        ]}
      />
    </div>
  )
}
