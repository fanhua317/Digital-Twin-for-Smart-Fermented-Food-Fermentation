import { useEffect, useState } from 'react'
import { 
  Row, Col, Card, Table, Tag, Space, Input, Select, 
  Button, Modal, Descriptions, Statistic, Typography, Tooltip 
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

const { Title, Text } = Typography
const { Option } = Select

interface Pit {
  id: number
  pit_code: string
  status: string
  current_batch: string | null
  ferment_start_time: string | null
  ferment_days: number
  location_x: number
  location_y: number
}

interface SensorData {
  temperature: number
  humidity: number
  ph_value: number
  acidity: number
  moisture: number
  alcohol_content: number
  recorded_at: string
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
      const [pitsData, statsData, heatmap] = await Promise.all([
        pitsApi.list({ status: statusFilter }),
        pitsApi.getStats(),
        pitsApi.getHeatmap(),
      ])
      setPits(pitsData as unknown as Pit[])
      setStats(statsData)
      setHeatmapData(heatmap as unknown as any[])
    } catch (error) {
      console.error('加载数据失败:', error)
    } finally {
      setLoading(false)
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
      fermenting: { color: 'green', text: '发酵中' },
      idle: { color: 'blue', text: '空闲' },
      transferring: { color: 'orange', text: '转运中' },
      maintenance: { color: 'red', text: '维护中' },
    }
    const { color, text } = config[status] || { color: 'default', text: status }
    return <Tag color={color}>{text}</Tag>
  }

  const columns = [
    {
      title: '窖池编号',
      dataIndex: 'pit_code',
      key: 'pit_code',
      filteredValue: searchText ? [searchText] : null,
      onFilter: (value: any, record: Pit) =>
        record.pit_code.toLowerCase().includes(value.toLowerCase()),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => getStatusTag(status),
    },
    {
      title: '当前批次',
      dataIndex: 'current_batch',
      key: 'current_batch',
      render: (text: string) => text || '-',
    },
    {
      title: '发酵天数',
      dataIndex: 'ferment_days',
      key: 'ferment_days',
      render: (days: number, record: Pit) => 
        record.status === 'fermenting' ? `${days} 天` : '-',
    },
    {
      title: '位置',
      key: 'location',
      render: (_: any, record: Pit) => 
        `(${record.location_x.toFixed(1)}, ${record.location_y.toFixed(1)})`,
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
        return `${data?.pit_code}<br/>温度: ${data?.temperature?.toFixed(1)}℃`
      }
    },
    grid: { left: 40, right: 20, top: 20, bottom: 40 },
    xAxis: {
      type: 'category',
      data: Array.from({ length: 10 }, (_, i) => `列${i + 1}`),
      axisLabel: { color: '#888' },
    },
    yAxis: {
      type: 'category',
      data: Array.from({ length: 10 }, (_, i) => `行${i + 1}`),
      axisLabel: { color: '#888' },
    },
    visualMap: {
      min: 15,
      max: 45,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      inRange: {
        color: ['#313695', '#4575b4', '#74add1', '#abd9e9', '#fee090', '#fdae61', '#f46d43', '#d73027']
      },
      textStyle: { color: '#888' }
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
      textStyle: { color: '#888' },
      bottom: 0
    },
    grid: { left: 50, right: 20, top: 20, bottom: 40 },
    xAxis: {
      type: 'category',
      data: sensorHistory.map(d => new Date(d.recorded_at).toLocaleTimeString()),
      axisLabel: { color: '#888', rotate: 45 },
    },
    yAxis: [
      {
        type: 'value',
        name: '温度(℃)',
        axisLabel: { color: '#888' },
        splitLine: { lineStyle: { color: '#303030' } },
      },
      {
        type: 'value',
        name: 'pH/酸度',
        axisLabel: { color: '#888' },
        splitLine: { show: false },
      }
    ],
    series: [
      {
        name: '温度',
        type: 'line',
        data: sensorHistory.map(d => d.temperature),
        smooth: true,
        itemStyle: { color: '#ff7875' },
      },
      {
        name: 'pH值',
        type: 'line',
        yAxisIndex: 1,
        data: sensorHistory.map(d => d.ph_value),
        smooth: true,
        itemStyle: { color: '#69c0ff' },
      },
      {
        name: '酸度',
        type: 'line',
        yAxisIndex: 1,
        data: sensorHistory.map(d => d.acidity),
        smooth: true,
        itemStyle: { color: '#95de64' },
      }
    ]
  }

  const filteredPits = pits.filter(p => 
    !searchText || p.pit_code.toLowerCase().includes(searchText.toLowerCase())
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
          <Card style={{ background: '#1f1f1f' }}>
            <Statistic title="窖池总数" value={stats?.total || 0} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ background: '#1f1f1f' }}>
            <Statistic 
              title="发酵中" 
              value={stats?.fermenting || 0} 
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ background: '#1f1f1f' }}>
            <Statistic 
              title="空闲" 
              value={stats?.idle || 0} 
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ background: '#1f1f1f' }}>
            <Statistic 
              title="维护中" 
              value={stats?.maintenance || 0} 
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 温度热力图 */}
      <Card 
        title={
          <Space>
            <FireOutlined style={{ color: '#ff7875' }} />
            温度热力图
          </Space>
        }
        style={{ background: '#1f1f1f', marginTop: 16 }}
        headStyle={{ borderBottom: '1px solid #303030' }}
      >
        <ReactECharts option={heatmapOption} style={{ height: 350 }} />
      </Card>

      {/* 窖池列表 */}
      <Card 
        title="窖池列表"
        style={{ background: '#1f1f1f', marginTop: 16 }}
        headStyle={{ borderBottom: '1px solid #303030' }}
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
              <Option value="fermenting">发酵中</Option>
              <Option value="idle">空闲</Option>
              <Option value="transferring">转运中</Option>
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
        title={`窖池详情 - ${selectedPit?.pit_code}`}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        width={800}
        footer={null}
      >
        {selectedPit && (
          <>
            <Descriptions bordered column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="窖池编号">{selectedPit.pit_code}</Descriptions.Item>
              <Descriptions.Item label="状态">{getStatusTag(selectedPit.status)}</Descriptions.Item>
              <Descriptions.Item label="当前批次">{selectedPit.current_batch || '-'}</Descriptions.Item>
              <Descriptions.Item label="发酵天数">{selectedPit.ferment_days} 天</Descriptions.Item>
            </Descriptions>

            {sensorData && (
              <>
                <Title level={5}>实时传感器数据</Title>
                <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                  <Col span={6}>
                    <Card size="small" style={{ background: '#262626' }}>
                      <Statistic 
                        title="温度" 
                        value={sensorData.temperature} 
                        suffix="℃"
                        precision={1}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card size="small" style={{ background: '#262626' }}>
                      <Statistic 
                        title="湿度" 
                        value={sensorData.humidity} 
                        suffix="%"
                        precision={1}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card size="small" style={{ background: '#262626' }}>
                      <Statistic 
                        title="pH值" 
                        value={sensorData.ph_value}
                        precision={2}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card size="small" style={{ background: '#262626' }}>
                      <Statistic 
                        title="酒精含量" 
                        value={sensorData.alcohol_content} 
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
