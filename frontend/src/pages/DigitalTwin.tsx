import { Card, Row, Col, Typography, Space, Tag, Progress, Statistic } from 'antd'
import { AppstoreOutlined, SyncOutlined } from '@ant-design/icons'
import { useLocation } from 'react-router-dom'
import ReactECharts from 'echarts-for-react'
import SimulationController from '../components/3d/SimulationController'
import PerformanceAnalysis from '../components/3d/PerformanceAnalysis'
import Scene from '../components/3d/Scene'
import SimulationPanel from '../components/SimulationPanel'
import { useStore } from '../store'

const { Title, Text } = Typography

const STAGE_LABEL: Record<string, string> = {
  empty: '空池',
  filling: '入池中',
  fermenting: '发酵中',
  ready: '待起糟',
  discharging: '起糟中',
}

const STAGE_COLOR: Record<string, string> = {
  empty: '#8b92a1',
  filling: '#5bc0ff',
  fermenting: '#42e07b',
  ready: '#ffc857',
  discharging: '#ff8c6b',
}

const GRAIN_CATEGORY_LABEL: Record<string, string> = {
  zhapei: '楂醅',
  hongzao: '红糟',
  diuzao: '丢糟',
}

const GRAIN_CATEGORY_COLOR: Record<string, string> = {
  zhapei: '#42e07b',
  hongzao: '#ff7a45',
  diuzao: '#722ed1',
}

export default function DigitalTwin() {
  const location = useLocation()
  // 根据路径决定视图: /digital-twin/overview | simulation | data | analysis
  // 默认 overview (兼容 /digital-twin 旧链接)
  const segments = location.pathname.split('/').filter(Boolean)
  const view = segments.length >= 2 ? segments[1] : 'overview'
  const simulation = useStore((s) => s.simulation)

  // 实时性能指标
  const performanceOption = {
    tooltip: { trigger: 'axis' },
    radar: {
      indicator: [
        { name: '产能利用', max: 100 },
        { name: '设备效率', max: 100 },
        { name: '能源效率', max: 100 },
        { name: '出酒率', max: 50 },
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
        value: [
          Math.min(100, (simulation?.stats.totalProcessed ?? 0) / 50),
          simulation?.stats.efficiency ?? 0,
          Math.min(100, 80 - (simulation?.stats.totalPower ?? 0) / 4),
          simulation?.stats.yieldRate ?? 0,
          simulation?.activeBatches?.[0]?.progress ?? 0,
        ],
        name: '当前状态',
        areaStyle: { color: 'rgba(91, 192, 255, 0.25)' },
        lineStyle: { color: '#5bc0ff' },
      }],
    }],
  }

  // 设备物料处理流水线状态
  const equipmentSteps = [
    { code: 'MIXER', name: '搅拌机' },
    { code: 'STEAMER_BOT', name: '上甑机器人' },
    { code: 'DISTILLER', name: '蒸馏塔' },
    { code: 'COOLER', name: '摊凉机' },
    { code: 'PUMP', name: '输送泵' },
  ]

  const VIEW_TITLE: Record<string, string> = {
    overview: '车间概览',
    simulation: '仿真模拟',
    data: '实时数据面板',
    analysis: '性能分析',
  }

  const views: Record<string, JSX.Element> = {
    overview: (
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={16}>
            <Card
              title="数字孪生模型 (3D 实时同步)"
              className="glass-card"
              styles={{ header: { borderBottom: '1px solid rgba(255,255,255,0.06)' } }}
              extra={<Tag icon={<SyncOutlined spin />} color="success">后端 SSoT 推送</Tag>}
            >
              <div style={{ height: 420 }}>
                <Scene isPlaying={true} mode="monitor" />
              </div>
            </Card>
          </Col>

          <Col xs={24} lg={8}>
            <Card
              title="实时性能"
              className="glass-card"
              styles={{ header: { borderBottom: '1px solid rgba(255,255,255,0.06)' } }}
              style={{ marginBottom: 16 }}
            >
              <ReactECharts option={performanceOption} style={{ height: 200 }} />
            </Card>

            <Card
              title="生产流程实时状态"
              className="glass-card"
              styles={{ header: { borderBottom: '1px solid rgba(255,255,255,0.06)' } }}
            >
              {equipmentSteps.map((step, index) => {
                const eq = simulation?.equipments[step.code]
                // 利用率 = 输入 + 输出 物料综合占比 (相比单看 inputLevel, 能反映"正在处理中"的设备)
                // 摊凉机这类脉冲喂料 + 快速处理的设备, inputLevel 会快速归零, 但 outputLevel 增长, 仍属于"工作中"
                const utilization = eq
                  ? Math.min(100, ((eq.inputLevel + eq.outputLevel) /
                      Math.max(1, eq.inputCapacity + eq.outputCapacity)) * 100)
                  : 0
                return (
                  <div
                    key={step.code}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '8px 0',
                      borderBottom: index < equipmentSteps.length - 1
                        ? '1px solid rgba(255,255,255,0.06)'
                        : 'none',
                    }}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: eq?.status === 'running' ? '#42e07b' : '#8b92a1',
                        marginRight: 12,
                      }}
                    />
                    <Text style={{ flex: 1 }}>{step.name}</Text>
                    {eq ? (
                      <Tag color="green">{utilization.toFixed(0)}%</Tag>
                    ) : (
                      <Tag>等待</Tag>
                    )}
                  </div>
                )
              })}
            </Card>
          </Col>

          {/* 仿真总览统计 */}
          <Col xs={24}>
            <Card
              title="工艺仿真总览"
              className="glass-card"
              styles={{ header: { borderBottom: '1px solid rgba(255,255,255,0.06)' } }}
            >
              <Row gutter={16}>
                <Col span={4}>
                  <Statistic
                    title="累计基酒"
                    value={simulation?.stats.totalLiquor?.toFixed(0) ?? 0}
                    suffix="kg"
                    valueStyle={{ color: '#eb2f96' }}
                  />
                </Col>
                <Col span={4}>
                  <Statistic
                    title="出酒率"
                    value={simulation?.stats.yieldRate?.toFixed(1) ?? 0}
                    suffix="%"
                    valueStyle={{ color: '#13c2c2' }}
                  />
                </Col>
                <Col span={4}>
                  <Statistic
                    title="累计运输"
                    value={simulation?.stats.totalTransported?.toFixed(0) ?? 0}
                    suffix="kg"
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Col>
                <Col span={4}>
                  <Statistic
                    title="累计处理"
                    value={simulation?.stats.totalProcessed?.toFixed(0) ?? 0}
                    suffix="kg"
                    valueStyle={{ color: '#faad14' }}
                  />
                </Col>
                <Col span={4}>
                  <Statistic
                    title="完成周期"
                    value={simulation?.stats.completedCycles ?? 0}
                    suffix="次"
                    valueStyle={{ color: '#a855f7' }}
                  />
                </Col>
                <Col span={4}>
                  <Statistic
                    title="全厂功率"
                    value={simulation?.stats.totalPower?.toFixed(1) ?? 0}
                    suffix="kW"
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Col>
              </Row>
            </Card>
          </Col>

          {/* 窖池阶段分布 */}
          <Col xs={24} lg={12}>
            <Card
              title="窖池阶段分布"
              className="glass-card"
              styles={{ header: { borderBottom: '1px solid rgba(255,255,255,0.06)' } }}
            >
              <Space direction="vertical" style={{ width: '100%' }} size={12}>
                {Object.entries(simulation?.pitStageCounts || {}).map(([stage, count]) => {
                  const total = Object.values(simulation?.pitStageCounts || {})
                    .reduce((s: number, c: any) => s + (c as number), 0)
                  const percent = total > 0 ? (count as number) / total * 100 : 0
                  return (
                    <div key={stage}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text>
                          <span
                            style={{
                              display: 'inline-block',
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: STAGE_COLOR[stage] || '#888',
                              marginRight: 8,
                            }}
                          />
                          {STAGE_LABEL[stage] || stage}
                        </Text>
                        <Text type="secondary">{count as number} / {total} 池</Text>
                      </div>
                      <Progress
                        percent={percent}
                        strokeColor={STAGE_COLOR[stage] || '#888'}
                        trailColor="rgba(255,255,255,0.06)"
                        showInfo={false}
                      />
                    </div>
                  )
                })}
              </Space>
            </Card>
          </Col>

          {/* 糟醅类型分布 */}
          <Col xs={24} lg={12}>
            <Card
              title="窖池糟醅类型分布"
              className="glass-card"
              styles={{ header: { borderBottom: '1px solid rgba(255,255,255,0.06)' } }}
            >
              <Space direction="vertical" style={{ width: '100%' }} size={12}>
                {Object.entries(simulation?.pitGrainCategoryCounts || {}).map(([cat, count]) => {
                  const total = Object.values(simulation?.pitGrainCategoryCounts || {})
                    .reduce((s: number, c: any) => s + (c as number), 0)
                  const percent = total > 0 ? (count as number) / total * 100 : 0
                  return (
                    <div key={cat}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text>
                          <span
                            style={{
                              display: 'inline-block',
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: GRAIN_CATEGORY_COLOR[cat] || '#888',
                              marginRight: 8,
                            }}
                          />
                          {GRAIN_CATEGORY_LABEL[cat] || cat}
                        </Text>
                        <Text type="secondary">{count as number} / {total} 池 · {percent.toFixed(0)}%</Text>
                      </div>
                      <Progress
                        percent={percent}
                        strokeColor={GRAIN_CATEGORY_COLOR[cat] || '#888'}
                        trailColor="rgba(255,255,255,0.06)"
                        showInfo={false}
                      />
                    </div>
                  )
                })}
              </Space>
            </Card>
          </Col>

          {/* 分级摘酒产量 */}
          <Col xs={24} lg={12}>
            <Card
              title="自动分级摘酒产量"
              className="glass-card"
              styles={{ header: { borderBottom: '1px solid rgba(255,255,255,0.06)' } }}
            >
              {simulation?.liquorStorage ? (
                <ReactECharts
                  option={{
                    tooltip: { trigger: 'item', formatter: '{b}: {c} kg ({d}%)' },
                    legend: { bottom: 0, textStyle: { color: '#b7bcc7' } },
                    series: [{
                      type: 'pie',
                      radius: ['45%', '70%'],
                      center: ['50%', '45%'],
                      label: { color: '#b7bcc7' },
                      data: [
                        { name: '头酒', value: simulation.liquorStorage.headLiquor.toFixed(1), itemStyle: { color: '#ff7a45' } },
                        { name: '中段优级', value: simulation.liquorStorage.midLiquor.toFixed(1), itemStyle: { color: '#52c41a' } },
                        { name: '尾酒', value: simulation.liquorStorage.tailLiquor.toFixed(1), itemStyle: { color: '#13c2c2' } },
                      ],
                    }],
                  }}
                  style={{ height: 220 }}
                />
              ) : (
                <Text type="secondary">等待仿真数据...</Text>
              )}
            </Card>
          </Col>

          {/* 当前活跃批次 */}
          <Col xs={24}>
            <Card
              title="当前活跃批次 (中段优级酒入库)"
              className="glass-card"
              styles={{ header: { borderBottom: '1px solid rgba(255,255,255,0.06)' } }}
            >
              {simulation?.activeBatches?.length ? (
                simulation.activeBatches.map((b) => (
                  <div key={b.id} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text strong>{b.batchNo}</Text>
                      <Tag color="processing">{b.stage}</Tag>
                    </div>
                    <div style={{ color: '#8b92a1', fontSize: 12, margin: '4px 0' }}>
                      {b.productType}
                    </div>
                    <Progress
                      percent={b.progress}
                      strokeColor="#52c41a"
                      format={() => `${b.actualVolume.toFixed(0)} / ${b.targetVolume.toFixed(0)} kg`}
                    />
                  </div>
                ))
              ) : (
                <Text type="secondary">暂无活跃批次</Text>
              )}
            </Card>
          </Col>
        </Row>
    ),
    simulation: <SimulationController />,
    data: <SimulationPanel />,
    analysis: <PerformanceAnalysis />,
  }

  const currentView = views[view] || views.overview
  const currentTitle = VIEW_TITLE[view] || VIEW_TITLE.overview

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>
        <Space>
          <AppstoreOutlined />
          数字孪生 · {currentTitle}
          <Tag icon={<SyncOutlined spin />} color="success">
            后端 SSoT · 仿真 {simulation?.stats.simulatedDays?.toFixed(2) ?? 0} 天
          </Tag>
        </Space>
      </Title>

      {currentView}
    </div>
  )
}
