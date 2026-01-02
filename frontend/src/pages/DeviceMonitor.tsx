import { useEffect, useState } from 'react'
import { 
  Row, Col, Card, Table, Tag, Space, Input, Select, 
  Button, Modal, Descriptions, Statistic, Typography, Progress 
} from 'antd'
import {
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
  SettingOutlined,
  ToolOutlined,
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { devicesApi } from '@/services/api'

const { Title, Text } = Typography
const { Option } = Select

interface Device {
  id: number
  device_code: string
  device_name: string
  device_type: string
  status: string
  running_hours: number
  last_maintenance: string | null
  location_x: number
  location_y: number
}

interface DeviceData {
  power: number
  speed: number
  vibration: number
  temperature: number
  current: number
  voltage: number
  recorded_at: string
}

export default function DeviceMonitor() {
  const [devices, setDevices] = useState<Device[]>([])
  const [stats, setStats] = useState<any>(null)
  const [deviceTypes, setDeviceTypes] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [typeFilter, setTypeFilter] = useState<string | undefined>()
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)
  const [deviceData, setDeviceData] = useState<DeviceData | null>(null)
  const [deviceHistory, setDeviceHistory] = useState<DeviceData[]>([])
  const [modalVisible, setModalVisible] = useState(false)

  useEffect(() => {
    loadData()
  }, [typeFilter, statusFilter])

  const loadData = async () => {
    setLoading(true)
    try {
      const [devicesData, statsData, types] = await Promise.all([
        devicesApi.list({ device_type: typeFilter, status: statusFilter }),
        devicesApi.getStats(),
        devicesApi.getTypes(),
      ])
      setDevices(devicesData as unknown as Device[])
      setStats(statsData)
      setDeviceTypes(types as unknown as string[])
    } catch (error) {
      console.error('加载数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleViewDevice = async (device: Device) => {
    setSelectedDevice(device)
    setModalVisible(true)
    try {
      const [latest, history] = await Promise.all([
        devicesApi.getLatestData(device.id),
        devicesApi.getData(device.id, 24),
      ])
      setDeviceData(latest as unknown as DeviceData)
      setDeviceHistory(history as unknown as DeviceData[])
    } catch (error) {
      console.error('加载设备数据失败:', error)
    }
  }

  const getStatusTag = (status: string) => {
    const config: Record<string, { color: string; text: string }> = {
      running: { color: 'green', text: '运行中' },
      idle: { color: 'blue', text: '空闲' },
      warning: { color: 'orange', text: '警告' },
      error: { color: 'red', text: '故障' },
      maintenance: { color: 'purple', text: '维护中' },
    }
    const { color, text } = config[status] || { color: 'default', text: status }
    return <Tag color={color}>{text}</Tag>
  }

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      AGV: '智能运输车',
      Robot: '机器人',
      Conveyor: '输送带',
      Mixer: '拌料机',
      Steamer: '蒸汽发生器',
      Cooler: '摊凉机',
      Pump: '输送泵',
      Sensor: '传感器节点',
    }
    return labels[type] || type
  }

  const columns = [
    {
      title: '设备编号',
      dataIndex: 'device_code',
      key: 'device_code',
    },
    {
      title: '设备名称',
      dataIndex: 'device_name',
      key: 'device_name',
    },
    {
      title: '类型',
      dataIndex: 'device_type',
      key: 'device_type',
      render: (type: string) => <Tag>{getTypeLabel(type)}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => getStatusTag(status),
    },
    {
      title: '运行时长',
      dataIndex: 'running_hours',
      key: 'running_hours',
      render: (hours: number) => `${hours.toFixed(0)} 小时`,
    },
    {
      title: '上次维护',
      dataIndex: 'last_maintenance',
      key: 'last_maintenance',
      render: (date: string) => date ? new Date(date).toLocaleDateString() : '-',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Device) => (
        <Button 
          type="link" 
          icon={<EyeOutlined />}
          onClick={() => handleViewDevice(record)}
        >
          查看详情
        </Button>
      ),
    },
  ]

  // 设备类型分布图
  const typeChartOption = {
    tooltip: { trigger: 'item' },
    legend: { 
      orient: 'vertical', 
      right: 10, 
      top: 'center',
      textStyle: { color: '#888' }
    },
    series: [{
      type: 'pie',
      radius: ['45%', '70%'],
      center: ['35%', '50%'],
      data: Object.entries(stats?.by_type || {}).map(([name, value]) => ({
        name: getTypeLabel(name),
        value,
      })),
      label: { show: false },
      emphasis: {
        label: { show: true, fontSize: 14, fontWeight: 'bold' }
      }
    }]
  }

  // 设备运行数据图表
  const deviceChartOption = {
    tooltip: { trigger: 'axis' },
    legend: { 
      data: ['功率', '振动', '温度'],
      textStyle: { color: '#888' },
      bottom: 0
    },
    grid: { left: 50, right: 50, top: 20, bottom: 40 },
    xAxis: {
      type: 'category',
      data: deviceHistory.map(d => new Date(d.recorded_at).toLocaleTimeString()),
      axisLabel: { color: '#888', rotate: 45 },
    },
    yAxis: [
      {
        type: 'value',
        name: '功率(kW)',
        axisLabel: { color: '#888' },
        splitLine: { lineStyle: { color: '#303030' } },
      },
      {
        type: 'value',
        name: '振动/温度',
        axisLabel: { color: '#888' },
        splitLine: { show: false },
      }
    ],
    series: [
      {
        name: '功率',
        type: 'line',
        data: deviceHistory.map(d => d.power),
        smooth: true,
        itemStyle: { color: '#1890ff' },
      },
      {
        name: '振动',
        type: 'line',
        yAxisIndex: 1,
        data: deviceHistory.map(d => d.vibration),
        smooth: true,
        itemStyle: { color: '#faad14' },
      },
      {
        name: '温度',
        type: 'line',
        yAxisIndex: 1,
        data: deviceHistory.map(d => d.temperature),
        smooth: true,
        itemStyle: { color: '#ff7875' },
      }
    ]
  }

  const filteredDevices = devices.filter(d => 
    !searchText || 
    d.device_code.toLowerCase().includes(searchText.toLowerCase()) ||
    d.device_name.toLowerCase().includes(searchText.toLowerCase())
  )

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>
        <Space>
          <SettingOutlined />
          设备管理
        </Space>
      </Title>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={6}>
          <Card style={{ background: '#1f1f1f' }}>
            <Statistic title="设备总数" value={stats?.total || 0} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ background: '#1f1f1f' }}>
            <Statistic 
              title="运行中" 
              value={stats?.running || 0} 
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ background: '#1f1f1f' }}>
            <Statistic 
              title="警告" 
              value={stats?.warning || 0} 
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ background: '#1f1f1f' }}>
            <Statistic 
              title="故障" 
              value={stats?.error || 0} 
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 设备类型分布 */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card 
            title="设备类型分布"
            style={{ background: '#1f1f1f' }}
            headStyle={{ borderBottom: '1px solid #303030' }}
          >
            <ReactECharts option={typeChartOption} style={{ height: 300 }} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card 
            title={
              <Space>
                <ToolOutlined />
                维护提醒
              </Space>
            }
            style={{ background: '#1f1f1f' }}
            headStyle={{ borderBottom: '1px solid #303030' }}
          >
            {devices
              .filter(d => d.running_hours > 3000)
              .slice(0, 5)
              .map(d => (
                <div key={d.id} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text>{d.device_name}</Text>
                    <Text type="secondary">{d.running_hours.toFixed(0)}h</Text>
                  </div>
                  <Progress 
                    percent={Math.min(100, d.running_hours / 50)}
                    strokeColor={d.running_hours > 4000 ? '#ff4d4f' : '#faad14'}
                    trailColor="#303030"
                    size="small"
                  />
                </div>
              ))
            }
            {devices.filter(d => d.running_hours > 3000).length === 0 && (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Text type="secondary">暂无需要维护的设备</Text>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* 设备列表 */}
      <Card 
        title="设备列表"
        style={{ background: '#1f1f1f', marginTop: 16 }}
        headStyle={{ borderBottom: '1px solid #303030' }}
        extra={
          <Space>
            <Input
              placeholder="搜索设备"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              style={{ width: 200 }}
            />
            <Select
              placeholder="设备类型"
              allowClear
              style={{ width: 140 }}
              value={typeFilter}
              onChange={setTypeFilter}
            >
              {deviceTypes.map(type => (
                <Option key={type} value={type}>{getTypeLabel(type)}</Option>
              ))}
            </Select>
            <Select
              placeholder="状态筛选"
              allowClear
              style={{ width: 120 }}
              value={statusFilter}
              onChange={setStatusFilter}
            >
              <Option value="running">运行中</Option>
              <Option value="idle">空闲</Option>
              <Option value="warning">警告</Option>
              <Option value="error">故障</Option>
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
          dataSource={filteredDevices}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* 设备详情弹窗 */}
      <Modal
        title={`设备详情 - ${selectedDevice?.device_name}`}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        width={800}
        footer={null}
      >
        {selectedDevice && (
          <>
            <Descriptions bordered column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="设备编号">{selectedDevice.device_code}</Descriptions.Item>
              <Descriptions.Item label="设备名称">{selectedDevice.device_name}</Descriptions.Item>
              <Descriptions.Item label="设备类型">
                <Tag>{getTypeLabel(selectedDevice.device_type)}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="状态">{getStatusTag(selectedDevice.status)}</Descriptions.Item>
              <Descriptions.Item label="运行时长">{selectedDevice.running_hours.toFixed(0)} 小时</Descriptions.Item>
              <Descriptions.Item label="上次维护">
                {selectedDevice.last_maintenance 
                  ? new Date(selectedDevice.last_maintenance).toLocaleDateString() 
                  : '-'}
              </Descriptions.Item>
            </Descriptions>

            {deviceData && (
              <>
                <Title level={5}>实时运行数据</Title>
                <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                  <Col span={8}>
                    <Card size="small" style={{ background: '#262626' }}>
                      <Statistic title="功率" value={deviceData.power} suffix="kW" precision={2} />
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card size="small" style={{ background: '#262626' }}>
                      <Statistic title="电压" value={deviceData.voltage} suffix="V" precision={1} />
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card size="small" style={{ background: '#262626' }}>
                      <Statistic title="电流" value={deviceData.current} suffix="A" precision={2} />
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card size="small" style={{ background: '#262626' }}>
                      <Statistic title="速度" value={deviceData.speed} precision={1} />
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card size="small" style={{ background: '#262626' }}>
                      <Statistic title="振动" value={deviceData.vibration} suffix="mm/s" precision={2} />
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card size="small" style={{ background: '#262626' }}>
                      <Statistic title="温度" value={deviceData.temperature} suffix="℃" precision={1} />
                    </Card>
                  </Col>
                </Row>
              </>
            )}

            {deviceHistory.length > 0 && (
              <>
                <Title level={5}>24小时数据趋势</Title>
                <ReactECharts option={deviceChartOption} style={{ height: 250 }} />
              </>
            )}
          </>
        )}
      </Modal>
    </div>
  )
}
