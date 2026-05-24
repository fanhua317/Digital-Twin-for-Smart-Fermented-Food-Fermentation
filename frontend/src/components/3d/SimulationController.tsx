import { useState } from 'react'
import { Card, Steps, Button, Typography, Space, Tag, message, Popconfirm } from 'antd'
import {
  StepForwardOutlined,
  StepBackwardOutlined,
  SyncOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import Scene, { SceneHUDStrip } from './Scene'
import SimulationPanel from '../SimulationPanel'
import { useStore } from '../../store'
import { simulationApi } from '../../services/api'

const { Title, Paragraph } = Typography

const steps = [
  { title: '全景概览', description: '酿酒车间整体数字孪生视图，5 区窖池 + 5 台核心生产线 + 5 台 AGV。' },
  { title: '起糟转运', description: 'AGV-01 从 ready 窖池抽取发酵糟醅，运送至搅拌机入料口。' },
  { title: '配料拌粮', description: '搅拌机按工艺配方混合糟醅与曲粉，输出拌合粮供上甑使用。' },
  { title: '上甑给料', description: '上甑机器人按"轻松薄准匀平"原则均匀铺料至蒸馏塔。' },
  { title: '馏酒冲酸', description: '蒸馏塔消耗上甑粮与底锅水，按 30% 出酒率产出基酒并实时累加批次产量。' },
  { title: '摊凉加曲', description: '摊凉机将出甑酒糟从 95°C 快速降至 22°C，并加入 5% 曲粉。' },
  { title: '入池发酵', description: 'AGV-05 将摊凉后的入池粮送回 empty 窖池，开启新一轮 60 天发酵周期。' },
]

export default function SimulationController() {
  const [currentStep, setCurrentStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const paused = useStore((s) => s.simulation?.paused ?? false)

  const handleNext = () => currentStep < steps.length - 1 && setCurrentStep(currentStep + 1)
  const handlePrev = () => currentStep > 0 && setCurrentStep(currentStep - 1)

  const handleTogglePause = async () => {
    if (busy) return
    setBusy(true)
    try {
      if (paused) {
        await simulationApi.resume()
        message.success('仿真已继续')
      } else {
        await simulationApi.pause()
        message.warning('仿真已暂停')
      }
    } catch (e) {
      message.error('控制失败')
    } finally {
      setBusy(false)
    }
  }

  const handleReset = async () => {
    if (busy) return
    setBusy(true)
    try {
      await simulationApi.reset()
      message.success('仿真已重置')
    } catch (e) {
      message.error('重置失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3" style={{ height: '100%' }}>
      {/* 当前步骤说明 - 移到 3D 场景上方独立卡片，不再挡住视野 */}
      <Card styles={{ body: { padding: '10px 16px' } }} className="glass-card">
        <div className="flex items-start gap-3">
          <Tag color="blue" style={{ fontSize: 14, padding: '4px 10px', margin: 0 }}>
            {currentStep + 1}
          </Tag>
          <div style={{ flex: 1 }}>
            <Title level={5} style={{ margin: 0, fontSize: 14 }}>
              {steps[currentStep].title}
            </Title>
            <Paragraph style={{ marginBottom: 0, marginTop: 4, fontSize: 12, lineHeight: 1.5, color: 'rgba(255,255,255,0.7)' }}>
              {steps[currentStep].description}
            </Paragraph>
          </div>
        </div>
      </Card>

      {/* 实时 KPI 条 - 4 卡横排, 不再遮挡 3D 视野 */}
      <SceneHUDStrip />

      {/* 3D 场景区域 - 大幅放大: 75vh, 最小 560px, 全宽 */}
      <div
        className="relative bg-gray-900 rounded-lg overflow-hidden border border-gray-800"
        style={{ height: '75vh', minHeight: '560px' }}
      >
        <Scene isPlaying={true} mode="simulation" simulationStep={currentStep} />

        {/* 控制按钮 - 浮于 3D 场景底部, 半透明背景 */}
        <div className="absolute bottom-3 left-3 right-3 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 px-3 py-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <Space size="small">
              {paused ? (
                <Tag color="warning">已暂停</Tag>
              ) : (
                <Tag icon={<SyncOutlined spin />} color="success">运行中</Tag>
              )}
              <Button
                type={paused ? 'primary' : 'default'}
                icon={paused ? <PlayCircleOutlined /> : <PauseCircleOutlined />}
                onClick={handleTogglePause}
                loading={busy}
                size="small"
              >
                {paused ? '继续' : '暂停'}
              </Button>
              <Popconfirm
                title="重置仿真"
                description="将清空累计统计与活跃批次，AGV/设备恢复初始状态。"
                okText="确认重置"
                cancelText="取消"
                onConfirm={handleReset}
              >
                <Button danger icon={<ReloadOutlined />} loading={busy} size="small">重置</Button>
              </Popconfirm>
              <Button icon={<StepBackwardOutlined />} onClick={handlePrev} disabled={currentStep === 0} size="small">上一步</Button>
              <Button icon={<StepForwardOutlined />} onClick={handleNext} disabled={currentStep === steps.length - 1} size="small">下一步</Button>
            </Space>
          </div>
        </div>
      </div>

      {/* 7 步工艺导览 - 独占整行, 全宽显示, 不再与按钮挤一行 */}
      <Card styles={{ body: { padding: '10px 16px' } }} className="glass-card">
        <Steps
          current={currentStep}
          size="small"
          items={steps.map((s) => ({ title: s.title }))}
          onChange={setCurrentStep}
        />
      </Card>

      {/* 实时仿真面板 (后端 SSoT) */}
      <SimulationPanel />
    </div>
  )
}
