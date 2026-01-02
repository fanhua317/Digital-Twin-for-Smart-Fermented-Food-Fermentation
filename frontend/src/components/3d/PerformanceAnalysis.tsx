import { Card, Row, Col, Statistic } from 'antd'
import ReactECharts from 'echarts-for-react'
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons'

export default function PerformanceAnalysis() {
  // 1. 生产效率趋势 (折线图)
  const efficiencyOption = {
    title: { text: '生产效率趋势 (批次/小时)', textStyle: { color: '#fff' } },
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'],
      axisLabel: { color: '#8b92a1' }
    },
    yAxis: { type: 'value', axisLabel: { color: '#8b92a1' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } } },
    series: [
      {
        name: '实际产出',
        type: 'line',
        smooth: true,
        areaStyle: { opacity: 0.3 },
        data: [12, 15, 14, 18, 16, 19, 17],
        itemStyle: { color: '#42e07b' }
      },
      {
        name: '计划产出',
        type: 'line',
        smooth: true,
        lineStyle: { type: 'dashed' },
        data: [15, 15, 15, 15, 15, 15, 15],
        itemStyle: { color: '#5bc0ff' }
      }
    ]
  }

  // 2. 设备利用率 (饼图)
  const deviceUsageOption = {
    title: { text: '关键设备利用率', textStyle: { color: '#fff' } },
    tooltip: { trigger: 'item' },
    series: [
      {
        name: '利用率',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 10, borderColor: '#1f1f1f', borderWidth: 2 },
        label: { show: false, position: 'center' },
        emphasis: { label: { show: true, fontSize: 20, fontWeight: 'bold', color: '#fff' } },
        data: [
          { value: 85, name: '运行中', itemStyle: { color: '#42e07b' } },
          { value: 10, name: '待机', itemStyle: { color: '#5bc0ff' } },
          { value: 3, name: '故障', itemStyle: { color: '#ff4d4f' } },
          { value: 2, name: '维护', itemStyle: { color: '#faad14' } }
        ]
      }
    ]
  }

  // 3. 质量分析 (散点图/柱状图)
  const qualityOption = {
    title: { text: '各批次出酒率与酸度分析', textStyle: { color: '#fff' } },
    tooltip: { trigger: 'axis' },
    xAxis: { data: ['批次1', '批次2', '批次3', '批次4', '批次5', '批次6'], axisLabel: { color: '#8b92a1' } },
    yAxis: [
      { type: 'value', name: '出酒率(%)', axisLabel: { color: '#8b92a1' }, splitLine: { show: false } },
      { type: 'value', name: '酸度(mmol/10g)', axisLabel: { color: '#8b92a1' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } } }
    ],
    series: [
      { name: '出酒率', type: 'bar', data: [42, 45, 43, 46, 44, 47], itemStyle: { color: '#5bc0ff' } },
      { name: '酸度', type: 'line', yAxisIndex: 1, data: [1.2, 1.1, 1.3, 1.0, 1.2, 0.9], itemStyle: { color: '#faad14' } }
    ]
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 关键指标卡片 */}
      <Row gutter={16}>
        <Col span={6}>
          <Card className="glass-card">
            <Statistic 
              title={<span className="text-gray-400">综合OEE</span>}
              value={87.5} 
              precision={1} 
              suffix="%" 
              valueStyle={{ color: '#42e07b' }}
              prefix={<ArrowUpOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="glass-card">
            <Statistic 
              title={<span className="text-gray-400">平均出酒率</span>}
              value={44.2} 
              precision={1} 
              suffix="%" 
              valueStyle={{ color: '#5bc0ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="glass-card">
            <Statistic 
              title={<span className="text-gray-400">能耗/吨酒</span>}
              value={120} 
              suffix="kWh" 
              valueStyle={{ color: '#faad14' }}
              prefix={<ArrowDownOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="glass-card">
            <Statistic 
              title={<span className="text-gray-400">故障停机时间</span>}
              value={1.5} 
              suffix="h" 
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 图表区域 */}
      <Row gutter={16}>
        <Col span={16}>
          <Card className="glass-card">
            <ReactECharts option={efficiencyOption} style={{ height: 300 }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card className="glass-card">
            <ReactECharts option={deviceUsageOption} style={{ height: 300 }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={24}>
          <Card className="glass-card">
            <ReactECharts option={qualityOption} style={{ height: 300 }} />
          </Card>
        </Col>
      </Row>
    </div>
  )
}
