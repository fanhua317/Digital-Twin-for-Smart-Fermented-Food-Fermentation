import { useEffect, useState } from 'react'
import { 
  Row, Col, Card, Table, Tag, Space, Button, 
  Typography, Modal, Form, Input, InputNumber, Select, message 
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
  batch_code: string
  grain_type: string
  grain_weight: number
  status: string
  wine_grade: string | null
  created_at: string
}

interface ProcessParam {
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
        batch_code: `PC-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String(batches.length + 1).padStart(4, '0')}`,
        ...values,
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
      pending: { color: 'default', text: '待开始' },
      processing: { color: 'processing', text: '进行中' },
      completed: { color: 'success', text: '已完成' },
    }
    const { color, text } = config[status] || { color: 'default', text: status }
    return <Tag color={color}>{text}</Tag>
  }

  const getGradeTag = (grade: string | null) => {
    if (!grade) return '-'
    const colors: Record<string, string> = {
      '特级': 'gold',
      '优级': 'green',
      '一级': 'blue',
      '二级': 'default',
      '三级': 'default',
    }
    return <Tag color={colors[grade] || 'default'}>{grade}</Tag>
  }

  const columns = [
    {
      title: '批次编号',
      dataIndex: 'batch_code',
      key: 'batch_code',
    },
    {
      title: '粮食类型',
      dataIndex: 'grain_type',
      key: 'grain_type',
    },
    {
      title: '粮食重量',
      dataIndex: 'grain_weight',
      key: 'grain_weight',
      render: (weight: number) => `${weight.toFixed(0)} kg`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => getStatusTag(status),
    },
    {
      title: '酒品等级',
      dataIndex: 'wine_grade',
      key: 'wine_grade',
      render: (grade: string) => getGradeTag(grade),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (time: string) => new Date(time).toLocaleString(),
    },
  ]

  // 产量趋势图
  const productionChartOption = {
    tooltip: { trigger: 'axis' },
    legend: { 
      data: ['产量', '质量合格率'],
      textStyle: { color: '#888' },
      bottom: 0
    },
    grid: { left: 60, right: 60, top: 20, bottom: 40 },
    xAxis: {
      type: 'category',
      data: trends.map(t => t.date),
      axisLabel: { color: '#888' },
    },
    yAxis: [
      {
        type: 'value',
        name: '产量(kg)',
        axisLabel: { color: '#888' },
        splitLine: { lineStyle: { color: '#303030' } },
      },
      {
        type: 'value',
        name: '合格率(%)',
        min: 0,
        max: 100,
        axisLabel: { color: '#888' },
        splitLine: { show: false },
      }
    ],
    series: [
      {
        name: '产量',
        type: 'bar',
        data: trends.map(t => t.production),
        itemStyle: { color: '#1890ff' },
      },
      {
        name: '质量合格率',
        type: 'line',
        yAxisIndex: 1,
        data: trends.map(t => t.quality_rate),
        smooth: true,
        itemStyle: { color: '#52c41a' },
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
          <Card style={{ background: '#1f1f1f' }}>
            <Statistic title="总批次" value={stats?.total || 0} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ background: '#1f1f1f' }}>
            <Statistic 
              title="进行中" 
              value={stats?.processing || 0}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ background: '#1f1f1f' }}>
            <Statistic 
              title="已完成" 
              value={stats?.completed || 0}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ background: '#1f1f1f' }}>
            <Statistic 
              title="今日产量" 
              value={stats?.today_production || 0}
              suffix="kg"
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 产量趋势和工艺参数 */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={16}>
          <Card 
            title="7日产量趋势"
            style={{ background: '#1f1f1f' }}
            headStyle={{ borderBottom: '1px solid #303030' }}
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
            style={{ background: '#1f1f1f', height: '100%' }}
            headStyle={{ borderBottom: '1px solid #303030' }}
          >
            <div style={{ maxHeight: 300, overflow: 'auto' }}>
              {Object.entries(params).slice(0, 3).map(([process, paramList]) => (
                <div key={process} style={{ marginBottom: 16 }}>
                  <Text strong style={{ color: '#1890ff' }}>{process}</Text>
                  {paramList.slice(0, 2).map(p => (
                    <div 
                      key={p.name}
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        padding: '4px 0',
                        borderBottom: '1px solid #303030'
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
        style={{ background: '#1f1f1f', marginTop: 16 }}
        headStyle={{ borderBottom: '1px solid #303030' }}
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
            label="粮食类型"
            rules={[{ required: true, message: '请选择粮食类型' }]}
          >
            <Select placeholder="选择粮食类型">
              <Option value="高粱">高粱</Option>
              <Option value="小麦">小麦</Option>
              <Option value="玉米">玉米</Option>
              <Option value="大米">大米</Option>
              <Option value="糯米">糯米</Option>
            </Select>
          </Form.Item>
          
          <Form.Item
            name="grain_weight"
            label="粮食重量 (kg)"
            rules={[{ required: true, message: '请输入粮食重量' }]}
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
