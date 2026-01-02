import { useEffect, useState } from 'react'
import { 
  Row, Col, Card, Table, Tag, Space, Button, 
  Typography, Modal, Form, InputNumber, Select, message 
} from 'antd'
import {
  PlusOutlined,
  ReloadOutlined,
  BarChartOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { productionApi } from '@/services/api'

const { Title, Text } = Typography
const { Option } = Select

interface Batch {
  id: number
  batchNo: string
  productType: string
  targetVolume: number
  actualVolume: number | null
  status: string
  qualityScore: number | null
  createdAt: string
}

interface ProcessParam {
  id: number
  processName: string
  name: string
  value: number
  unit: string
  min: number
  max: number
}

export default function ProductionManage() {
  const [batches, setBatches] = useState<Batch[]>([])
  const [stats, setStats] = useState<any>(null)
  const [trends, setTrends] = useState<any[]>([])
  const [params, setParams] = useState<Record<string, ProcessParam[]>>({})
  const [loading, setLoading] = useState(true)
  const [modalVisible, setModalVisible] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [batchesData, statsData, trendsData, paramsData] = await Promise.all([
        productionApi.listBatches(),
        productionApi.getBatchStats(),
        productionApi.getTrends(7),
        productionApi.getParams(),
      ])
      setBatches(batchesData as unknown as Batch[])
      setStats(statsData)
      setTrends(trendsData as unknown as any[])
      setParams(paramsData as unknown as Record<string, ProcessParam[]>)
    } catch (error) {
      console.error('加载数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateBatch = async (values: any) => {
    try {
      await productionApi.createBatch({
        batchNo: `BATCH-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String(batches.length + 1).padStart(4, '0')}`,
        productType: values.grain_type,
        targetVolume: values.grain_weight,
      })
      message.success('批次创建成功')
      setModalVisible(false)
      form.resetFields()
      loadData()
    } catch (error) {
      message.error('创建失败')
    }
  }

  const getStatusTag = (status: string) => {
    const config: Record<string, { color: string; text: string }> = {
      planning: { color: 'default', text: '待开始' },
      in_progress: { color: 'processing', text: '进行中' },
      completed: { color: 'success', text: '已完成' },
    }
    const { color, text } = config[status] || { color: 'default', text: status }
    return <Tag color={color}>{text}</Tag>
  }

  const columns = [
    {
      title: '批次编号',
      dataIndex: 'batchNo',
      key: 'batchNo',
    },
    {
      title: '产品类型',
      dataIndex: 'productType',
      key: 'productType',
    },
    {
      title: '目标产量',
      dataIndex: 'targetVolume',
      key: 'targetVolume',
      render: (volume: number) => `${volume.toFixed(0)} kg`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => getStatusTag(status),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (time: string) => new Date(time).toLocaleString(),
    },
  ]

  // 产量趋势图
  const productionChartOption = {
    tooltip: { trigger: 'axis' },
    legend: { 
      data: ['产量', '质量合格率'],
      textStyle: { color: '#b7bcc7' },
      bottom: 0
    },
    grid: { left: 60, right: 60, top: 20, bottom: 40 },
    xAxis: {
      type: 'category',
      data: trends.map(t => t.date),
      axisLabel: { color: '#8b92a1' },
    },
    yAxis: [
      {
        type: 'value',
        name: '产量(kg)',
        axisLabel: { color: '#8b92a1' },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      },
      {
        type: 'value',
        name: '合格率(%)',
        min: 0,
        max: 100,
        axisLabel: { color: '#8b92a1' },
        splitLine: { show: false },
      }
    ],
    series: [
      {
        name: '产量',
        type: 'bar',
        data: trends.map(t => t.production),
        itemStyle: { color: '#5bc0ff' },
      },
      {
        name: '质量合格率',
        type: 'line',
        yAxisIndex: 1,
        data: trends.map(t => t.quality_rate),
        smooth: true,
        itemStyle: { color: '#42e07b' },
      }
    ]
  }

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>
        <Space>
          <BarChartOutlined />
          生产管理
        </Space>
      </Title>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={6}>
          <Card className="glass-card">
            <Statistic title="总批次" value={stats?.total || 0} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="glass-card">
            <Statistic 
              title="进行中" 
              value={stats?.processing || 0}
              valueStyle={{ color: 'var(--accent-blue)' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="glass-card">
            <Statistic 
              title="已完成" 
              value={stats?.completed || 0}
              valueStyle={{ color: 'var(--accent-green)' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="glass-card">
            <Statistic 
              title="今日产量" 
              value={stats?.today_production || 0}
              suffix="kg"
              valueStyle={{ color: 'var(--accent-yellow)' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 产量趋势和工艺参数 */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={16}>
          <Card 
            title="7日产量趋势"
            className="glass-card"
            styles={{ header: { borderBottom: '1px solid rgba(255,255,255,0.06)' } }}
          >
            <ReactECharts option={productionChartOption} style={{ height: 300 }} />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card 
            title={
              <Space>
                <SettingOutlined />
                工艺参数
              </Space>
            }
            className="glass-card"
            styles={{ header: { borderBottom: '1px solid rgba(255,255,255,0.06)' } }}
            style={{ height: '100%' }}
          >
            <div style={{ maxHeight: 300, overflow: 'auto' }}>
              {Object.entries(params).slice(0, 3).map(([process, paramList]) => (
                <div key={process} style={{ marginBottom: 16 }}>
                  <Text strong style={{ color: 'var(--accent-blue)' }}>{process}</Text>
                  {paramList.slice(0, 2).map(p => (
                    <div 
                      key={p.name}
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        padding: '4px 0',
                        borderBottom: '1px solid rgba(255,255,255,0.06)'
                      }}
                    >
                      <Text type="secondary">{p.name}</Text>
                      <Text>{p.value} {p.unit}</Text>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      {/* 批次列表 */}
      <Card 
        title="生产批次"
        className="glass-card"
        styles={{ header: { borderBottom: '1px solid rgba(255,255,255,0.06)' } }}
        style={{ marginTop: 16 }}
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadData}>
              刷新
            </Button>
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={() => setModalVisible(true)}
            >
              新建批次
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={batches}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* 新建批次弹窗 */}
      <Modal
        title="新建生产批次"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateBatch}
          initialValues={{
            water_ratio: 1.2,
            yeast_ratio: 0.08,
            soaking_duration: 120,
            target_alcohol: 55,
          }}
        >
          <Form.Item
            name="grain_type"
            label="产品类型"
            rules={[{ required: true, message: '请选择产品类型' }]}
          >
            <Select placeholder="选择产品类型">
              <Option value="高粱">高粱</Option>
              <Option value="小麦">小麦</Option>
              <Option value="玉米">玉米</Option>
              <Option value="大米">大米</Option>
              <Option value="糯米">糯米</Option>
            </Select>
          </Form.Item>
          
          <Form.Item
            name="grain_weight"
            label="目标产量 (kg)"
            rules={[{ required: true, message: '请输入目标产量' }]}
          >
            <InputNumber min={100} max={10000} style={{ width: '100%' }} />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="water_ratio" label="配水比例">
                <InputNumber min={0.5} max={2} step={0.1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="yeast_ratio" label="加曲比例">
                <InputNumber min={0.01} max={0.2} step={0.01} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="soaking_duration" label="润粮时长 (分钟)">
                <InputNumber min={30} max={300} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="target_alcohol" label="目标酒精度">
                <InputNumber min={30} max={70} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">创建</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
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
