import { useEffect, useState } from 'react'
import { 
  Row, Col, Card, Table, Tag, Space, Input, Select, 
  Button, Modal, Descriptions, Statistic, Typography 
} from 'antd'
import {
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
  FireOutlined,
  ExperimentOutlined,
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { pitsApi } from '@/services/api'
import { useWebSocket } from '@/hooks/useWebSocket'

const { Title } = Typography
const { Option } = Select

interface Pit {
  id: number
  pitNo: string
  zone: string
  status: string
  fermentationDay: number
  row: number
  col: number
}

interface SensorData {
  temperature: number
  humidity: number
  phValue: number
  acidity: number
  moisture: number
  alcohol: number
  recordedAt: string
}

export default function PitMonitor() {
  const [pits, setPits] = useState<Pit[]>([])
  const [stats, setStats] = useState<any>(null)
  const [heatmapData, setHeatmapData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [selectedPit, setSelectedPit] = useState<Pit | null>(null)
  const [sensorData, setSensorData] = useState<SensorData | null>(null)
  const [sensorHistory, setSensorHistory] = useState<SensorData[]>([])
  const [modalVisible, setModalVisible] = useState(false)

  // WebSocket实时更新
  useWebSocket('pits', (data) => {
    if (data.type === 'pit_sensor_update') {
      // 可以实时更新传感器数据
    }
  })

  useEffect(() => {
    loadData()
  }, [statusFilter])

  const loadData = async () => {
    setLoading(true)
    try {
      // 先加载主要数据（快速）
      const [pitsResult, statsResult] = await Promise.allSettled([
        pitsApi.list({ status: statusFilter }),
        pitsApi.getStats(),
      ])
      
      if (pitsResult.status === 'fulfilled') {
        let pitsData = pitsResult.value as any
        if (pitsData?.data) pitsData = pitsData.data
        if (Array.isArray(pitsData)) {
          setPits(pitsData as Pit[])
        }
      }
      
      if (statsResult.status === 'fulfilled') {
        let statsData = statsResult.value as any
        if (statsData?.data) statsData = statsData.data
        setStats(statsData)
      }
    } catch (error) {
      console.error('加载数据失败:', error)
    } finally {
      setLoading(false)
    }
    
    // 延迟加载热力图（慢速API，不阻塞主数据显示）
    loadHeatmapAsync()
  }
  
  const loadHeatmapAsync = async () => {
    try {
      const heatmapResult = await pitsApi.getHeatmap()
      let heatmapDataResult = heatmapResult as any
      if (heatmapDataResult?.data) heatmapDataResult = heatmapDataResult.data
      if (Array.isArray(heatmapDataResult)) {
        setHeatmapData(heatmapDataResult)
      }
    } catch (error) {
      console.error('加载热力图失败:', error)
    }
  }

  const handleViewPit = async (pit: Pit) => {
    setSelectedPit(pit)
    setModalVisible(true)
    try {
      const [latest, history] = await Promise.all([
        pitsApi.getLatestSensor(pit.id),
        pitsApi.getSensors(pit.id, 24),
      ])
      setSensorData(latest as unknown as SensorData)
      setSensorHistory(history as unknown as SensorData[])
    } catch (error) {
      console.error('加载传感器数据失败:', error)
    }
  }

  const getStatusTag = (status: string) => {
    const config: Record<string, { color: string; text: string }> = {
      normal: { color: 'green', text: '正常' },
      warning: { color: 'gold', text: '警告' },
      alarm: { color: 'red', text: '告警' },
      maintenance: { color: 'orange', text: '维护中' },
    }
    const { color, text } = config[status] || { color: 'default', text: status }
    return <Tag color={color}>{text}</Tag>
  }

  const columns = [
    {
      title: '窖池编号',
      dataIndex: 'pitNo',
      key: 'pitNo',
      filteredValue: searchText ? [searchText] : null,
      onFilter: (value: any, record: Pit) =>
        record.pitNo.toLowerCase().includes(value.toLowerCase()),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => getStatusTag(status),
    },
    {
      title: '区域',
      dataIndex: 'zone',
      key: 'zone',
    },
    {
      title: '发酵天数',
      dataIndex: 'fermentationDay',
      key: 'fermentationDay',
      render: (days: number) => `${days} 天`,
    },
    {
      title: '位置',
      key: 'location',
      render: (_: any, record: Pit) => 
        `(${record.row}, ${record.col})`,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Pit) => (
        <Button 
          type="link" 
          icon={<EyeOutlined />}
          onClick={() => handleViewPit(record)}
        >
          查看详情
        </Button>
      ),
    },
  ]

  // 温度热力图配置
  const heatmapOption = {
    tooltip: {
      position: 'top',
      formatter: (params: any) => {
        const data = heatmapData[params.dataIndex]
        return `${data?.pitNo}<br/>温度: ${data?.temperature?.toFixed(1)}℃`
      }
    },
    grid: { left: 40, right: 20, top: 20, bottom: 40 },
    xAxis: {
      type: 'category',
      data: Array.from({ length: 10 }, (_, i) => `列${i + 1}`),
      axisLabel: { color: '#8b92a1' },
    },
    yAxis: {
      type: 'category',
      data: Array.from({ length: 10 }, (_, i) => `行${i + 1}`),
      axisLabel: { color: '#8b92a1' },
    },
    visualMap: {
      min: 15,
      max: 45,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      inRange: {
        color: ['#14233b', '#1f3a6b', '#2f5ea5', '#5bc0ff', '#ffe39a', '#ffc857', '#ff8c6b', '#ff6b6b']
      },
      textStyle: { color: '#8b92a1' }
    },
    series: [{
      type: 'heatmap',
      data: heatmapData.map((d, i) => [i % 10, Math.floor(i / 10), d.temperature]),
      label: { show: false },
      emphasis: {
        itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.5)' }
      }
    }]
  }

  // 传感器历史数据图表配置
  const sensorChartOption = {
    tooltip: { trigger: 'axis' },
    legend: { 
      data: ['温度', 'pH值', '酸度'],
      textStyle: { color: '#b7bcc7' },
      bottom: 0
    },
    grid: { left: 50, right: 20, top: 20, bottom: 40 },
    xAxis: {
      type: 'category',
      data: sensorHistory.map(d => new Date(d.recordedAt).toLocaleTimeString()),
      axisLabel: { color: '#8b92a1', rotate: 45 },
    },
    yAxis: [
      {
        type: 'value',
        name: '温度(℃)',
        axisLabel: { color: '#8b92a1' },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      },
      {
        type: 'value',
        name: 'pH/酸度',
        axisLabel: { color: '#8b92a1' },
        splitLine: { show: false },
      }
    ],
    series: [
      {
        name: '温度',
        type: 'line',
        data: sensorHistory.map(d => d.temperature),
        smooth: true,
        itemStyle: { color: '#ff8c6b' },
      },
      {
        name: 'pH值',
        type: 'line',
        yAxisIndex: 1,
        data: sensorHistory.map(d => d.phValue),
        smooth: true,
        itemStyle: { color: '#5bc0ff' },
      },
      {
        name: '酸度',
        type: 'line',
        yAxisIndex: 1,
        data: sensorHistory.map(d => d.acidity),
        smooth: true,
        itemStyle: { color: '#42e07b' },
      }
    ]
  }

  const filteredPits = pits.filter(p => 
    !searchText || p.pitNo.toLowerCase().includes(searchText.toLowerCase())
  )

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>
        <Space>
          <ExperimentOutlined />
          窖池监控
        </Space>
      </Title>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={6}>
          <Card className="glass-card">
            <Statistic title="窖池总数" value={stats?.total || 0} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="glass-card">
            <Statistic 
              title="正常" 
              value={stats?.normal || 0} 
              valueStyle={{ color: 'var(--accent-green)' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="glass-card">
            <Statistic 
              title="警告" 
              value={stats?.warning || 0} 
              valueStyle={{ color: 'var(--accent-yellow)' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="glass-card">
            <Statistic 
              title="告警" 
              value={stats?.alarm || 0} 
              valueStyle={{ color: 'var(--accent-red)' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 温度热力图 */}
      <Card 
        title={
          <Space>
            <FireOutlined style={{ color: 'var(--accent-red)' }} />
            温度热力图
          </Space>
        }
        className="glass-card"
        styles={{ header: { borderBottom: '1px solid rgba(255,255,255,0.06)' } }}
        style={{ marginTop: 16 }}
      >
        <ReactECharts option={heatmapOption} style={{ height: 350 }} />
      </Card>

      {/* 窖池列表 */}
      <Card 
        title="窖池列表"
        className="glass-card"
        styles={{ header: { borderBottom: '1px solid rgba(255,255,255,0.06)' } }}
        style={{ marginTop: 16 }}
        extra={
          <Space>
            <Input
              placeholder="搜索窖池编号"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              style={{ width: 200 }}
            />
            <Select
              placeholder="状态筛选"
              allowClear
              style={{ width: 120 }}
              value={statusFilter}
              onChange={setStatusFilter}
            >
              <Option value="normal">正常</Option>
              <Option value="warning">警告</Option>
              <Option value="alarm">告警</Option>
              <Option value="maintenance">维护中</Option>
            </Select>
            <Button icon={<ReloadOutlined />} onClick={loadData}>
              刷新
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={filteredPits}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* 窖池详情弹窗 */}
      <Modal
        title={`窖池详情 - ${selectedPit?.pitNo}`}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        width={800}
        footer={null}
      >
        {selectedPit && (
          <>
            <Descriptions bordered column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="窖池编号">{selectedPit.pitNo}</Descriptions.Item>
              <Descriptions.Item label="状态">{getStatusTag(selectedPit.status)}</Descriptions.Item>
              <Descriptions.Item label="发酵天数">{selectedPit.fermentationDay} 天</Descriptions.Item>
            </Descriptions>

            {sensorData && (
              <>
                <Title level={5}>实时传感器数据</Title>
                <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                  <Col span={6}>
                    <Card size="small" className="glass-card">
                      <Statistic 
                        title="温度" 
                        value={sensorData.temperature} 
                        suffix="℃"
                        precision={1}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card size="small" className="glass-card">
                      <Statistic 
                        title="湿度" 
                        value={sensorData.humidity} 
                        suffix="%"
                        precision={1}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card size="small" className="glass-card">
                      <Statistic 
                        title="pH值" 
                        value={sensorData.phValue}
                        precision={2}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card size="small" className="glass-card">
                      <Statistic 
                        title="酒精含量" 
                        value={sensorData.alcohol} 
                        suffix="%"
                        precision={1}
                      />
                    </Card>
                  </Col>
                </Row>
              </>
            )}

            {sensorHistory.length > 0 && (
              <>
                <Title level={5}>24小时数据趋势</Title>
                <ReactECharts option={sensorChartOption} style={{ height: 250 }} />
              </>
            )}
          </>
        )}
      </Modal>
    </div>
  )
}
