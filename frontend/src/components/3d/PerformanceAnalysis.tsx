import { useEffect, useRef } from 'react'
import { Card, Row, Col, Statistic } from 'antd'
import ReactECharts from 'echarts-for-react'
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons'
import { useStore } from '../../store'

/** 性能分析 — 全部数据从后端 SSoT `simulation` 实时读取，每秒随快照更新 */
export default function PerformanceAnalysis() {
  const simulation = useStore((s) => s.simulation)

  // === 维护生产效率历史 (每 30 秒采样一次, 最多保留 24 个点 = 12 分钟) ===
  const efficiencyHistory = useRef<{ time: string; actual: number; plan: number }[]>([])
  const lastSampleRef = useRef<number>(0)
  useEffect(() => {
    if (!simulation) return
    const now = Date.now()
    if (now - lastSampleRef.current < 30000) return // 30 秒采样一次
    lastSampleRef.current = now
    const t = new Date()
    const label = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`
    // 批次/小时 = 完成周期数 / 运行小时数
    const hours = Math.max(0.01, simulation.uptimeSeconds / 3600 * simulation.timeScale)
    const actual = simulation.stats.completedCycles / hours
    efficiencyHistory.current = [
      ...efficiencyHistory.current.slice(-23),
      { time: label, actual: Math.round(actual * 10) / 10, plan: 15 },
    ]
  }, [simulation?.uptimeSeconds])

  // 实时统计数据
  const stats = simulation?.stats
  const equipments = simulation?.equipments || {}

  // 综合 OEE: 后端 efficiency 字段 (停机/性能/质量三因素综合)
  const oee = stats?.efficiency ?? 0
  // 平均出酒率: 后端 yieldRate
  const yieldRate = stats?.yieldRate ?? 0
  // 能耗/吨酒 (kWh/吨): totalPower(kW) × 仿真小时 ÷ totalLiquor(kg) × 1000
  const simHours = (simulation?.uptimeSeconds ?? 0) * (simulation?.timeScale ?? 60) / 3600
  const energyPerTon = stats?.totalLiquor && stats.totalLiquor > 0
    ? Math.round((stats.totalPower * simHours / stats.totalLiquor) * 1000)
    : 0
  // 故障停机时间: 故障设备数 × 0.1 小时 (估算)
  const equipList = Object.values(equipments)
  const faultCount = equipList.filter((e: any) => e.status === 'warning' || e.status === 'fault').length
  const downHours = (faultCount * 0.1).toFixed(1)

  // 1. 生产效率趋势 (实时历史)
  const efficiencyOption = {
    title: { text: '生产效率趋势 (批次/小时)', textStyle: { color: '#fff' } },
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    legend: { data: ['实际产出', '计划产出'], textStyle: { color: '#8b92a1' }, top: 30 },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: efficiencyHistory.current.length > 0
        ? efficiencyHistory.current.map((d) => d.time)
        : ['--'],
      axisLabel: { color: '#8b92a1' }
    },
    yAxis: { type: 'value', axisLabel: { color: '#8b92a1' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } } },
    series: [
      {
        name: '实际产出',
        type: 'line',
        smooth: true,
        areaStyle: { opacity: 0.3 },
        data: efficiencyHistory.current.map((d) => d.actual),
        itemStyle: { color: '#42e07b' }
      },
      {
        name: '计划产出',
        type: 'line',
        smooth: true,
        lineStyle: { type: 'dashed' },
        data: efficiencyHistory.current.map((d) => d.plan),
        itemStyle: { color: '#5bc0ff' }
      }
    ]
  }

  // 2. 设备利用率 (按当前设备状态汇总)
  const statusCount = { running: 0, warning: 0, fault: 0, stopped: 0 }
  equipList.forEach((e: any) => {
    const s = e.status || 'running'
    if (s in statusCount) (statusCount as any)[s]++
    else statusCount.running++
  })
  const totalEq = equipList.length || 1
  const pct = (n: number) => Math.round((n / totalEq) * 100)
  const deviceUsageOption = {
    title: { text: `关键设备利用率 (${totalEq} 台)`, textStyle: { color: '#fff' } },
    tooltip: { trigger: 'item', formatter: '{b}: {c} 台 ({d}%)' },
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
          { value: statusCount.running, name: `运行中 ${pct(statusCount.running)}%`, itemStyle: { color: '#42e07b' } },
          { value: statusCount.warning, name: `警告 ${pct(statusCount.warning)}%`, itemStyle: { color: '#faad14' } },
          { value: statusCount.fault, name: `故障 ${pct(statusCount.fault)}%`, itemStyle: { color: '#ff4d4f' } },
          { value: statusCount.stopped, name: `停机 ${pct(statusCount.stopped)}%`, itemStyle: { color: '#5bc0ff' } }
        ].filter((d) => d.value > 0)
      }
    ]
  }

  // 3. 各批次出酒率与酸度分析 (使用真实活跃批次数据)
  const batches = simulation?.activeBatches || []
  const batchOption = {
    title: { text: '各批次产量与进度分析', textStyle: { color: '#fff' } },
    tooltip: { trigger: 'axis' },
    legend: { data: ['实际产量', '目标产量'], textStyle: { color: '#8b92a1' }, top: 30 },
    xAxis: {
      data: batches.length > 0 ? batches.map((b) => b.batchNo.slice(-4)) : ['--'],
      axisLabel: { color: '#8b92a1' }
    },
    yAxis: [
      { type: 'value', name: '产量(kg)', axisLabel: { color: '#8b92a1' }, splitLine: { show: false } },
      { type: 'value', name: '进度(%)', max: 100, axisLabel: { color: '#8b92a1' }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } } }
    ],
    series: [
      { name: '实际产量', type: 'bar', data: batches.map((b) => Math.round(b.actualVolume)), itemStyle: { color: '#5bc0ff' } },
      { name: '目标产量', type: 'bar', data: batches.map((b) => Math.round(b.targetVolume)), itemStyle: { color: '#3a3a3a' } },
      { name: '完成度', type: 'line', yAxisIndex: 1, data: batches.map((b) => Math.round(b.progress * 10) / 10), itemStyle: { color: '#faad14' } }
    ]
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 关键指标卡片 */}
      <Row gutter={16}>
        <Col span={6}>
          <Card className="glass-card">
            <Statistic
              title={<span className="text-gray-400">综合OEE (实时)</span>}
              value={oee}
              precision={1}
              suffix="%"
              valueStyle={{ color: oee >= 80 ? '#42e07b' : oee >= 60 ? '#faad14' : '#ff4d4f' }}
              prefix={oee >= 80 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="glass-card">
            <Statistic
              title={<span className="text-gray-400">平均出酒率 (实时)</span>}
              value={yieldRate}
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
              value={energyPerTon}
              suffix="kWh"
              valueStyle={{ color: '#faad14' }}
              prefix={<ArrowDownOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="glass-card">
            <Statistic
              title={<span className="text-gray-400">设备异常台数</span>}
              value={faultCount}
              suffix={`/ ${equipList.length}`}
              valueStyle={{ color: faultCount > 0 ? '#ff4d4f' : '#42e07b' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 图表区域 */}
      <Row gutter={16}>
        <Col span={16}>
          <Card className="glass-card">
            <ReactECharts
              option={efficiencyOption}
              notMerge={true}
              style={{ height: 300 }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card className="glass-card">
            <ReactECharts
              option={deviceUsageOption}
              notMerge={true}
              style={{ height: 300 }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={24}>
          <Card className="glass-card">
            <ReactECharts
              option={batchOption}
              notMerge={true}
              style={{ height: 300 }}
            />
          </Card>
        </Col>
      </Row>

      {/* 数据来源提示 */}
      <div className="text-center text-xs text-gray-500 pb-2">
        数据来源: 后端 SSoT 工艺主仿真器 · 每秒推送实时快照 · 仿真已运行 {(simulation?.stats?.simulatedDays ?? 0).toFixed(2)} 天
        {downHours !== '0.0' && ` · 估算停机 ${downHours} 小时`}
      </div>
    </div>
  )
}
