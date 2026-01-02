import { useEffect, useState } from 'react'
import { Row, Col, Card, Statistic, Progress, Badge, Typography, Space, Tag } from 'antd'
import {
  ExperimentOutlined,
  SettingOutlined,
  AlertOutlined,
  ThunderboltOutlined,
  RiseOutlined,
  FieldTimeOutlined,
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { dashboardApi, alarmsApi } from '@/services/api'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useStore } from '@/store'

const { Title, Text } = Typography

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

interface AlarmItem {
  id: number
  source_code: string
  alarm_level: string
  alarm_message: string
  created_at: string
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [alarms, setAlarms] = useState<AlarmItem[]>([])
  const [overview, setOverview] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const { setDashboardStats, setActiveAlarms } = useStore()

  // WebSocket实时更新
  useWebSocket('dashboard', (data) => {
    if (data.type === 'dashboard_update') {
      // 更新部分数据
      setStats(prev => prev ? {
        ...prev,
        avg_temperature: data.data.temperature?.average || prev.avg_temperature,
        active_alarms: data.data.alarms?.active || prev.active_alarms,
      } : prev)
    }
  })

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 30000) // 30秒刷新
    return () => clearInterval(interval)
  }, [])

  const loadData = async () => {
    try {
      const [statsData, overviewData, alarmsData] = await Promise.all([
        dashboardApi.getStats(),
        dashboardApi.getOverview(),
        alarmsApi.getActive(),
      ])
      setStats(statsData as unknown as DashboardStats)
      setDashboardStats(statsData as unknown as DashboardStats)
      setOverview(overviewData)
      setAlarms((alarmsData as unknown as AlarmItem[]).slice(0, 5))
      setActiveAlarms((alarmsData as unknown as AlarmItem[]).length)
    } catch (error) {
      console.error('加载数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 窖池状态饼图配置
  const pitChartOption = {
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, textStyle: { color: '#fff' } },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      data: [
        { value: stats?.fermenting_pits || 0, name: '发酵中', itemStyle: { color: '#52c41a' } },
        { value: stats?.idle_pits || 0, name: '空闲', itemStyle: { color: '#1890ff' } },
        { value: (stats?.total_pits || 0) - (stats?.fermenting_pits || 0) - (stats?.idle_pits || 0), name: '其他', itemStyle: { color: '#faad14' } },
      ],
      label: { color: '#fff' },
    }]
  }

  // 设备状态饼图配置
  const deviceChartOption = {
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, textStyle: { color: '#fff' } },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      data: [
        { value: stats?.running_devices || 0, name: '运行中', itemStyle: { color: '#52c41a' } },
        { value: stats?.warning_devices || 0, name: '警告', itemStyle: { color: '#faad14' } },
        { value: stats?.error_devices || 0, name: '故障', itemStyle: { color: '#ff4d4f' } },
        { value: (stats?.total_devices || 0) - (stats?.running_devices || 0) - (stats?.warning_devices || 0) - (stats?.error_devices || 0), name: '空闲', itemStyle: { color: '#1890ff' } },
      ],
      label: { color: '#fff' },
    }]
  }

  // 告警趋势图配置
  const alarmTrendOption = {
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 20, top: 20, bottom: 30 },
    xAxis: {
      type: 'category',
      data: overview?.alarm_trend?.map((t: any) => t.hour) || [],
      axisLabel: { color: '#888' },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#888' },
      splitLine: { lineStyle: { color: '#303030' } },
    },
    series: [{
      data: overview?.alarm_trend?.map((t: any) => t.count) || [],
      type: 'line',
      smooth: true,
      areaStyle: { color: 'rgba(24, 144, 255, 0.3)' },
      lineStyle: { color: '#1890ff' },
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

      {/* 核心指标卡片 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="hover-card" style={{ background: '#1f1f1f' }}>
            <Statistic
              title={<Text type="secondary">窖池总数</Text>}
              value={stats?.total_pits || 0}
              prefix={<ExperimentOutlined style={{ color: '#1890ff' }} />}
              suffix={
                <Text type="secondary" style={{ fontSize: 14 }}>
                  / 发酵中 {stats?.fermenting_pits || 0}
                </Text>
              }
            />
            <Progress 
              percent={stats ? (stats.fermenting_pits / stats.total_pits * 100) : 0} 
              showInfo={false}
              strokeColor="#52c41a"
              trailColor="#303030"
              style={{ marginTop: 8 }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card className="hover-card" style={{ background: '#1f1f1f' }}>
            <Statistic
              title={<Text type="secondary">设备总数</Text>}
              value={stats?.total_devices || 0}
              prefix={<SettingOutlined style={{ color: '#52c41a' }} />}
              suffix={
                <Text type="secondary" style={{ fontSize: 14 }}>
                  / 运行 {stats?.running_devices || 0}
                </Text>
              }
            />
            <Progress 
              percent={stats ? (stats.running_devices / stats.total_devices * 100) : 0} 
              showInfo={false}
              strokeColor="#52c41a"
              trailColor="#303030"
              style={{ marginTop: 8 }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card className="hover-card" style={{ background: '#1f1f1f' }}>
            <Statistic
              title={<Text type="secondary">活跃告警</Text>}
              value={stats?.active_alarms || 0}
              prefix={<AlertOutlined style={{ color: stats?.active_alarms ? '#ff4d4f' : '#52c41a' }} />}
              valueStyle={{ color: stats?.active_alarms ? '#ff4d4f' : '#52c41a' }}
            />
            <div style={{ marginTop: 8 }}>
              <Space>
                <Badge status="error" text={<Text type="secondary">严重 {overview?.alarm_trend?.[0]?.count || 0}</Text>} />
                <Badge status="warning" text={<Text type="secondary">警告 {stats?.warning_devices || 0}</Text>} />
              </Space>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card className="hover-card" style={{ background: '#1f1f1f' }}>
            <Statistic
              title={<Text type="secondary">今日产量</Text>}
              value={stats?.today_production || 0}
              precision={0}
              prefix={<RiseOutlined style={{ color: '#faad14' }} />}
              suffix="kg"
            />
            <div style={{ marginTop: 8 }}>
              <Text type="secondary">
                <FieldTimeOutlined /> 平均温度: {stats?.avg_temperature || 0}℃
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
            style={{ background: '#1f1f1f' }}
            headStyle={{ borderBottom: '1px solid #303030' }}
          >
            <ReactECharts option={pitChartOption} style={{ height: 260 }} />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card 
            title="设备状态分布" 
            style={{ background: '#1f1f1f' }}
            headStyle={{ borderBottom: '1px solid #303030' }}
          >
            <ReactECharts option={deviceChartOption} style={{ height: 260 }} />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card 
            title="24小时告警趋势" 
            style={{ background: '#1f1f1f' }}
            headStyle={{ borderBottom: '1px solid #303030' }}
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
            style={{ background: '#1f1f1f' }}
            headStyle={{ borderBottom: '1px solid #303030' }}
            extra={<a href="/alarms">查看全部</a>}
          >
            {alarms.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Text type="secondary">暂无活跃告警</Text>
              </div>
            ) : (
              alarms.map((alarm) => (
                <div 
                  key={alarm.id} 
                  style={{ 
                    padding: '12px 0', 
                    borderBottom: '1px solid #303030',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <Tag color={getAlarmColor(alarm.alarm_level)}>
                      {alarm.source_code}
                    </Tag>
                    <Text style={{ marginLeft: 8 }}>{alarm.alarm_message}</Text>
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {new Date(alarm.created_at).toLocaleTimeString()}
                  </Text>
                </div>
              ))
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card 
            title="生产进度" 
            style={{ background: '#1f1f1f' }}
            headStyle={{ borderBottom: '1px solid #303030' }}
          >
            {overview?.production_progress?.length ? (
              overview.production_progress.map((batch: any) => (
                <div key={batch.batch_code} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text>{batch.batch_code}</Text>
                    <Text type="secondary">{batch.grain_type}</Text>
                  </div>
                  <Progress 
                    percent={batch.progress} 
                    strokeColor={{
                      '0%': '#1890ff',
                      '100%': '#52c41a',
                    }}
                    trailColor="#303030"
                  />
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Text type="secondary">暂无进行中的生产批次</Text>
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}
