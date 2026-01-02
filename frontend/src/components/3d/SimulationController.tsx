import { useState } from 'react'
import { Card, Steps, Button, Typography, Space, Divider } from 'antd'
import { PlayCircleOutlined, PauseCircleOutlined, StepForwardOutlined, StepBackwardOutlined } from '@ant-design/icons'
import Scene from './Scene'
import { useStore } from '../../store'

const { Title, Paragraph } = Typography

const steps = [
  {
    title: '全景概览',
    description: '酿酒车间整体数字孪生视图',
  },
  {
    title: '起窖转运',
    description: 'AGV 自动导引车将发酵好的酒醅从窖池运送至配料区，全程自动化调度。',
  },
  {
    title: '配料拌粮',
    description: '智能配料系统根据工艺配方，精准控制粮曲比例，通过搅拌机均匀混合。',
  },
  {
    title: '上甑给料',
    description: '工业机器人模拟人工上甑动作，实现"轻、松、薄、准、匀、平"的铺料要求。',
  },
  {
    title: '馏酒冲酸',
    description: '智能温控蒸馏系统，实时监测流酒温度与酒度，自动进行量质摘酒。',
  },
  {
    title: '摊凉加曲',
    description: '高效链板式摊凉机，快速降低糟醅温度，并自动添加大曲粉。',
  },
  {
    title: '入池发酵',
    description: '物料回填至窖池，通过物联网传感器实时监控发酵过程中的温度、酸度变化。',
  },
]

export default function SimulationController() {
  const [currentStep, setCurrentStep] = useState(0)
  const { isSimulationRunning, setSimulationRunning } = useStore()

  // 自动播放逻辑 - 已移除自动跳转，仅控制仿真状态
  // useEffect(() => {
  //   let timer: any
  //   if (isPlaying) {
  //     timer = setInterval(() => {
  //       setCurrentStep((prev) => {
  //         if (prev >= steps.length - 1) {
  //           setIsPlaying(false)
  //           return prev
  //         }
  //         return prev + 1
  //       })
  //     }, 5000) // 每5秒切换一步
  //   }
  //   return () => clearInterval(timer)
  // }, [isPlaying])

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  return (
    <div className="flex flex-col gap-4" style={{ height: '100%' }}>
      {/* 3D 场景区域 - 调整高度以显示底部步骤条 */}
      <div className="relative bg-gray-900 rounded-lg overflow-hidden border border-gray-800" style={{ height: '55vh', minHeight: '400px' }}>
        <Scene isPlaying={isSimulationRunning} mode="simulation" simulationStep={currentStep} />
        
        {/* 浮动说明面板 */}
        <div className="absolute top-4 left-4 max-w-sm bg-black/60 backdrop-blur-md p-4 rounded-lg text-white border border-white/10">
          <Title level={4} style={{ color: 'white', margin: 0 }}>
            {steps[currentStep].title}
          </Title>
          <Divider style={{ borderColor: 'rgba(255,255,255,0.2)', margin: '12px 0' }} />
          <Paragraph style={{ color: 'rgba(255,255,255,0.8)', marginBottom: 0 }}>
            {steps[currentStep].description}
          </Paragraph>
        </div>
      </div>

      {/* 控制栏 */}
      <Card bodyStyle={{ padding: '12px 24px' }} className="glass-card">
        <div className="flex items-center justify-between">
          <Space size="large">
            <Button 
              type="primary" 
              shape="circle" 
              icon={isSimulationRunning ? <PauseCircleOutlined /> : <PlayCircleOutlined />} 
              size="large"
              onClick={() => setSimulationRunning(!isSimulationRunning)}
            />
            <Space>
              <Button icon={<StepBackwardOutlined />} onClick={handlePrev} disabled={currentStep === 0}>上一步</Button>
              <Button icon={<StepForwardOutlined />} onClick={handleNext} disabled={currentStep === steps.length - 1}>下一步</Button>
            </Space>
          </Space>

          <div className="flex-1 ml-12">
            <Steps 
              current={currentStep} 
              size="small"
              items={steps.map(s => ({ title: s.title }))}
              onChange={setCurrentStep}
            />
          </div>
        </div>
      </Card>
    </div>
  )
}
