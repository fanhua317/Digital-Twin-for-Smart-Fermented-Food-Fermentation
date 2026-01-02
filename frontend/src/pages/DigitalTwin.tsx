import { useState } from 'react'
import { Card, Row, Col, Typography, Space, Tag, Button, Tabs, Slider, Switch } from 'antd'
import {
  AppstoreOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  ReloadOutlined,
  EyeOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'

const { Title, Text, Paragraph } = Typography

export default function DigitalTwin() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d')
  const [showLabels, setShowLabels] = useState(true)
  const [timeSpeed, setTimeSpeed] = useState(1)

  // 模拟3D场景的2D俯视图
  const sceneOption = {
    tooltip: { trigger: 'item' },
    grid: { left: 40, right: 40, top: 40, bottom: 40 },
    xAxis: {
      type: 'value',
      min: 0,
      max: 100,
      axisLabel: { show: false },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      axisLabel: { show: false },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
    },
    series: [
      // 窖池区域
      {
        type: 'scatter',
        name: '窖池',
        symbolSize: 15,
        data: Array.from({ length: 50 }, (_, i) => [
          10 + (i % 10) * 5,
          10 + Math.floor(i / 10) * 10,
        ]),
        itemStyle: { 
          color: (params: any) => {
            const status = Math.random()
            if (status > 0.7) return '#42e07b'
            if (status > 0.3) return '#5bc0ff'
            return '#ffc857'
          }
        },
        label: {
          show: showLabels,
          formatter: (params: any) => `J${params.dataIndex + 1}`,
          fontSize: 8,
          color: '#8b92a1',
        }
      },
      // 设备位置
      {
        type: 'effectScatter',
        name: '运行设备',
        symbolSize: 12,
        data: [
          [70, 20], [75, 35], [80, 50], [85, 65],
          [70, 80], [20, 85], [40, 85], [60, 85],
        ],
        rippleEffect: { brushType: 'stroke' },
        itemStyle: { color: '#ff8c6b' },
      },
      // AGV路径
      {
        type: 'lines',
        name: 'AGV路径',
        coordinateSystem: 'cartesian2d',
        polyline: true,
        lineStyle: { color: '#5bc0ff', width: 2, type: 'dashed' },
        effect: {
          show: isPlaying,
          period: 4,
          trailLength: 0.2,
          symbol: 'arrow',
          symbolSize: 8,
        },
        data: [
          { coords: [[5, 50], [60, 50], [60, 20], [90, 20]] },
          { coords: [[5, 70], [60, 70], [60, 85], [90, 85]] },
        ]
      }
    ]
  }

  // 流程状态监控
  const processSteps = [
    { name: '起窖转运', status: 'active', progress: 75, color: '#42e07b' },
    { name: '配料拌粮', status: 'active', progress: 60, color: '#5bc0ff' },
    { name: '润粮', status: 'active', progress: 45, color: '#5bc0ff' },
    { name: '上甑给料', status: 'waiting', progress: 0, color: '#8b92a1' },
    { name: '馏酒冲酸', status: 'waiting', progress: 0, color: '#8b92a1' },
    { name: '摊凉加曲', status: 'waiting', progress: 0, color: '#8b92a1' },
    { name: '入池发酵', status: 'waiting', progress: 0, color: '#8b92a1' },
  ]

  // 实时性能指标
  const performanceOption = {
    tooltip: { trigger: 'axis' },
    radar: {
      indicator: [
        { name: '产能利用', max: 100 },
        { name: '设备效率', max: 100 },
        { name: '能源效率', max: 100 },
        { name: '质量合格', max: 100 },
        { name: '生产进度', max: 100 },
      ],
      axisName: { color: '#8b92a1' },
      splitArea: { areaStyle: { color: ['rgba(255,255,255,0.03)', 'rgba(255,255,255,0.06)'] } },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
    },
    series: [{
      type: 'radar',
      data: [{
        value: [85, 78, 72, 92, 68],
        name: '当前状态',
        areaStyle: { color: 'rgba(91, 192, 255, 0.25)' },
        lineStyle: { color: '#5bc0ff' },
      }]
    }]
  }

  const tabItems = [
    {
      key: 'overview',
      label: '车间概览',
      children: (
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={16}>
            <Card 
              title="数字孪生模型"
              className="glass-card"
              styles={{ header: { borderBottom: '1px solid rgba(255,255,255,0.06)' } }}
              extra={
                <Space>
                  <Button 
                    type={viewMode === '3d' ? 'primary' : 'default'}
                    size="small"
                    onClick={() => setViewMode('3d')}
                  >
                    3D
                  </Button>
                  <Button 
                    type={viewMode === '2d' ? 'primary' : 'default'}
                    size="small"
                    onClick={() => setViewMode('2d')}
                  >
                    2D
                  </Button>
                </Space>
              }
            >
              <div style={{ position: 'relative' }}>
                <ReactECharts option={sceneOption} style={{ height: 400 }} />
                
                {/* 控制面板 */}
                <div style={{ 
                  position: 'absolute', 
                  bottom: 16, 
                  left: 16, 
                  background: 'rgba(26, 28, 36, 0.6)',
                  padding: '8px 16px',
                  borderRadius: 8,
                }}>
                  <Space>
                    <Button
                      type="text"
                      icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                      onClick={() => setIsPlaying(!isPlaying)}
                      style={{ color: '#fff' }}
                    >
                      {isPlaying ? '暂停' : '播放'}
                    </Button>
                    <Text style={{ color: '#b7bcc7' }}>标签</Text>
                    <Switch 
                      size="small" 
                      checked={showLabels}
                      onChange={setShowLabels}
                    />
                  </Space>
                </div>

                {/* 图例 */}
                <div style={{ 
                  position: 'absolute', 
                  top: 16, 
                  right: 16, 
                  background: 'rgba(26, 28, 36, 0.6)',
                  padding: 12,
                  borderRadius: 8,
                }}>
                  <Space direction="vertical" size={4}>
                    <Space><div style={{ width: 12, height: 12, borderRadius: '50%', background: '#42e07b' }} /><Text style={{ fontSize: 12 }}>发酵中</Text></Space>
                    <Space><div style={{ width: 12, height: 12, borderRadius: '50%', background: '#5bc0ff' }} /><Text style={{ fontSize: 12 }}>空闲</Text></Space>
                    <Space><div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ffc857' }} /><Text style={{ fontSize: 12 }}>维护</Text></Space>
                    <Space><div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff8c6b' }} /><Text style={{ fontSize: 12 }}>设备</Text></Space>
                  </Space>
                </div>
              </div>
            </Card>
          </Col>

          <Col xs={24} lg={8}>
            <Card 
              title="性能分析"
              className="glass-card"
              styles={{ header: { borderBottom: '1px solid rgba(255,255,255,0.06)' } }}
              style={{ marginBottom: 16 }}
            >
              <ReactECharts option={performanceOption} style={{ height: 200 }} />
            </Card>

            <Card 
              title="生产流程状态"
              className="glass-card"
              styles={{ header: { borderBottom: '1px solid rgba(255,255,255,0.06)' } }}
            >
              {processSteps.map((step, index) => (
                <div 
                  key={step.name}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    padding: '8px 0',
                    borderBottom: index < processSteps.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                  }}
                >
                  <div style={{ 
                    width: 8, 
                    height: 8, 
                    borderRadius: '50%', 
                    background: step.color,
                    marginRight: 12,
                  }} />
                  <Text style={{ flex: 1 }}>{step.name}</Text>
                  {step.status === 'active' ? (
                    <Tag color="green">{step.progress}%</Tag>
                  ) : (
                    <Tag>等待</Tag>
                  )}
                </div>
              ))}
            </Card>
          </Col>
        </Row>
      ),
    },
    {
      key: 'simulation',
      label: '仿真模拟',
      children: (
        <Card className="glass-card">
          <div style={{ textAlign: 'center', padding: 60 }}>
            <AppstoreOutlined style={{ fontSize: 64, color: '#5bc0ff' }} />
            <Title level={4} style={{ marginTop: 24 }}>仿真模拟功能</Title>
            <Paragraph type="secondary">
              基于Unity和3D建模的高精度数字孪生仿真模块正在开发中...
            </Paragraph>
            <Space style={{ marginTop: 24 }}>
              <Button type="primary" disabled>启动仿真</Button>
              <Button disabled>加载场景</Button>
            </Space>
          </div>
        </Card>
      ),
    },
    {
      key: 'analysis',
      label: '性能分析',
      children: (
        <Card className="glass-card">
          <div style={{ textAlign: 'center', padding: 60 }}>
            <SettingOutlined style={{ fontSize: 64, color: '#42e07b' }} />
            <Title level={4} style={{ marginTop: 24 }}>智能分析功能</Title>
            <Paragraph type="secondary">
              基于机器学习的生产预测与优化分析模块正在开发中...
            </Paragraph>
            <Space style={{ marginTop: 24 }}>
              <Button type="primary" disabled>生成报告</Button>
              <Button disabled>预测分析</Button>
            </Space>
          </div>
        </Card>
      ),
    },
  ]

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>
        <Space>
          <AppstoreOutlined />
          数字孪生
          <Tag color="blue">实时同步</Tag>
        </Space>
      </Title>

      <Tabs items={tabItems} />
    </div>
  )
}
