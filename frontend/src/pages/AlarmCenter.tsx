import { useEffect, useState } from 'react'
import { 
  Row, Col, Card, Table, Tag, Space, Select, 
  Button, Typography, Badge, Popconfirm, message 
} from 'antd'
import {
  ReloadOutlined,
  CheckCircleOutlined,
  AlertOutlined,
  BellOutlined,
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { alarmsApi } from '@/services/api'
import { useWebSocket } from '@/hooks/useWebSocket'

const { Title, Text } = Typography
const { Option } = Select

interface Alarm {
  id: number
  level: string
  type: string
  source: string
  message: string
  status: string
  createdAt: string
}

export default function AlarmCenter() {
  const [alarms, setAlarms] = useState<Alarm[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [levelFilter, setLevelFilter] = useState<string | undefined>()
  const [resolvedFilter, setResolvedFilter] = useState<boolean | undefined>(false)
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([])

  // WebSocket实时更新
  useWebSocket('alarms', (data) => {
    if (data.type === 'alarm_update') {
      loadData()
    }
  })

  useEffect(() => {
    loadData()
  }, [levelFilter, resolvedFilter])

  const loadData = async () => {
    setLoading(true)
    try {
      const [alarmsData, statsData] = await Promise.all([
        alarmsApi.list({ level: levelFilter, is_resolved: resolvedFilter }),
        alarmsApi.getStats(),
      ])
      setAlarms(alarmsData as unknown as Alarm[])
      setStats(statsData)
    } catch (error) {
      console.error('加载数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleResolve = async (id: number) => {
    try {
      await alarmsApi.resolve(id)
      message.success('告警已解决')
      loadData()
    } catch (error) {
      message.error('操作失败')
    }
  }

  const handleBatchResolve = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要解决的告警')
      return
    }
    try {
      await alarmsApi.resolveBatch(selectedRowKeys)
      message.success(`已解决 ${selectedRowKeys.length} 条告警`)
      setSelectedRowKeys([])
      loadData()
    } catch (error) {
      message.error('操作失败')
    }
  }

  const getLevelTag = (level: string) => {
    const config: Record<string, { color: string; text: string }> = {
      critical: { color: 'red', text: '严重' },
      error: { color: 'orange', text: '错误' },
      warning: { color: 'gold', text: '警告' },
      info: { color: 'blue', text: '信息' },
    }
    const { color, text } = config[level] || { color: 'default', text: level }
    return <Tag color={color}>{text}</Tag>
  }

  const parseSourceType = (source: string) => {
    const prefix = source?.split('-')[0]
    return prefix === 'pit' ? '窖池' : prefix === 'device' ? '设备' : prefix
  }

  const columns = [
    {
      title: '级别',
      dataIndex: 'level',
      key: 'level',
      width: 80,
      render: (level: string) => getLevelTag(level),
    },
    {
      title: '来源',
      key: 'source',
      width: 150,
      render: (_: any, record: Alarm) => (
        <Space>
          <Tag>{parseSourceType(record.source)}</Tag>
          <Text>{record.source}</Text>
        </Space>
      ),
    },
    {
      title: '告警类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
    },
    {
      title: '告警信息',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: string) => (
        status === 'resolved'
          ? <Badge status="success" text="已解决" />
          : <Badge status="processing" text="活跃" />
      ),
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (time: string) => new Date(time).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: Alarm) => (
        record.status !== 'resolved' && (
          <Popconfirm
            title="确认解决此告警？"
            onConfirm={() => handleResolve(record.id)}
          >
            <Button type="link" icon={<CheckCircleOutlined />}>
              解决
            </Button>
          </Popconfirm>
        )
      ),
    },
  ]

  // 告警级别分布图
  const levelChartOption = {
    tooltip: { trigger: 'item' },
    legend: { 
      bottom: 0,
      textStyle: { color: '#b7bcc7' }
    },
    series: [{
      type: 'pie',
      radius: '65%',
      data: [
        { value: stats?.by_level?.critical || 0, name: '严重', itemStyle: { color: '#ff6b6b' } },
        { value: stats?.by_level?.error || 0, name: '错误', itemStyle: { color: '#ff8c6b' } },
        { value: stats?.by_level?.warning || 0, name: '警告', itemStyle: { color: '#ffc857' } },
        { value: stats?.by_level?.info || 0, name: '信息', itemStyle: { color: '#5bc0ff' } },
      ],
      label: { color: '#fff' },
    }]
  }

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => setSelectedRowKeys(keys as number[]),
    getCheckboxProps: (record: Alarm) => ({
      disabled: record.status === 'resolved',
    }),
  }

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>
        <Space>
          <AlertOutlined />
          告警中心
        </Space>
      </Title>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={6}>
          <Card className="glass-card">
            <Statistic 
              title="活跃告警"
              value={stats?.active || 0}
              prefix={<BellOutlined />}
              valueStyle={{ color: stats?.active > 0 ? 'var(--accent-red)' : 'var(--accent-green)' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="glass-card">
            <Statistic 
              title="今日告警"
              value={stats?.today || 0}
              valueStyle={{ color: 'var(--accent-yellow)' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="glass-card">
            <Statistic 
              title="严重告警"
              value={stats?.by_level?.critical || 0}
              valueStyle={{ color: 'var(--accent-red)' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="glass-card">
            <Statistic 
              title="历史总数"
              value={stats?.total || 0}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        {/* 告警级别分布 */}
        <Col xs={24} lg={8}>
          <Card 
            title="活跃告警级别分布"
            className="glass-card"
            styles={{ header: { borderBottom: '1px solid rgba(255,255,255,0.06)' } }}
          >
            <ReactECharts option={levelChartOption} style={{ height: 280 }} />
          </Card>
        </Col>

        {/* 告警列表 */}
        <Col xs={24} lg={16}>
          <Card 
            title="告警列表"
            className="glass-card"
            styles={{ header: { borderBottom: '1px solid rgba(255,255,255,0.06)' } }}
            extra={
              <Space>
                <Select
                  placeholder="告警级别"
                  allowClear
                  style={{ width: 120 }}
                  value={levelFilter}
                  onChange={setLevelFilter}
                >
                  <Option value="critical">严重</Option>
                  <Option value="error">错误</Option>
                  <Option value="warning">警告</Option>
                  <Option value="info">信息</Option>
                </Select>
                <Select
                  placeholder="状态"
                  style={{ width: 100 }}
                  value={resolvedFilter}
                  onChange={setResolvedFilter}
                >
                  <Option value={false}>活跃</Option>
                  <Option value={true}>已解决</Option>
                </Select>
                <Button icon={<ReloadOutlined />} onClick={loadData}>
                  刷新
                </Button>
                {selectedRowKeys.length > 0 && (
                  <Popconfirm
                    title={`确认解决选中的 ${selectedRowKeys.length} 条告警？`}
                    onConfirm={handleBatchResolve}
                  >
                    <Button type="primary">
                      批量解决 ({selectedRowKeys.length})
                    </Button>
                  </Popconfirm>
                )}
              </Space>
            }
          >
            <Table
              rowSelection={rowSelection}
              columns={columns}
              dataSource={alarms}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10 }}
              size="small"
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

function Statistic({ title, value, prefix, valueStyle, suffix }: any) {
  return (
    <div>
      <Text type="secondary">{title}</Text>
      <div style={{ fontSize: 24, fontWeight: 'bold', marginTop: 8, ...valueStyle }}>
        {prefix && <span style={{ marginRight: 8 }}>{prefix}</span>}
        {value}
        {suffix && <span style={{ fontSize: 14, marginLeft: 4 }}>{suffix}</span>}
      </div>
    </div>
  )
}
