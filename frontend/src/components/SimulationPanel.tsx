import { Card, Progress, Tag, Space, Statistic, Row, Col, Table, Badge } from 'antd'
import { 
  SyncOutlined, 
  ThunderboltOutlined, 
  CarOutlined, 
  ExperimentOutlined,
  FieldTimeOutlined,
  DashboardOutlined
} from '@ant-design/icons'
import { useStore } from '../store'

// 设备物料可视化组件
function DeviceMaterialCard({ deviceId, name }: { deviceId: string, name: string }) {
  const { deviceMaterials } = useStore()
  const material = deviceMaterials[deviceId]
  
  if (!material) return null
  
  const inputPercent = Math.min(100, (material.inputLevel / 2000) * 100)
  const outputPercent = Math.min(100, (material.outputLevel / 2000) * 100)
  
  return (
    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
      <div className="flex justify-between items-center mb-2">
        <span className="text-white font-medium">{name}</span>
        <Tag color="green" className="text-xs">运行中</Tag>
      </div>
      
      <div className="space-y-2">
        <div>
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>{material.inputName}</span>
            <span>{Math.round(material.inputLevel)} / 2000</span>
          </div>
          <Progress 
            percent={inputPercent} 
            size="small" 
            strokeColor="#faad14"
            trailColor="#333"
            showInfo={false}
          />
        </div>
        
        <div>
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>{material.outputName}</span>
            <span>{Math.round(material.outputLevel)} / 2000</span>
          </div>
          <Progress 
            percent={outputPercent} 
            size="small" 
            strokeColor="#52c41a"
            trailColor="#333"
            showInfo={false}
          />
        </div>
        
        {material.auxName && material.auxLevel !== undefined && (
          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>{material.auxName}</span>
              <span>{Math.round(material.auxLevel)} / 2000</span>
            </div>
            <Progress 
              percent={Math.min(100, (material.auxLevel / 2000) * 100)} 
              size="small" 
              strokeColor="#1890ff"
              trailColor="#333"
              showInfo={false}
            />
          </div>
        )}
        
        <div className="text-xs text-gray-500 pt-1 border-t border-gray-700">
          转化速率: {material.processRate} 单位/秒
        </div>
      </div>
    </div>
  )
}

// AGV 状态卡片
function AGVStatusCard({ agvId }: { agvId: string }) {
  const { agvStates } = useStore()
  const agv = agvStates[agvId]
  
  if (!agv) return null
  
  const statusColors: Record<string, string> = {
    loading: 'processing',
    moving: 'success',
    unloading: 'warning',
    returning: 'default'
  }
  
  const statusTexts: Record<string, string> = {
    loading: '装货中',
    moving: '运输中',
    unloading: '卸货中',
    returning: '返程'
  }
  
  return (
    <div className="bg-gray-800/50 rounded p-2 border border-gray-700">
      <div className="flex justify-between items-center">
        <Space>
          <CarOutlined className="text-yellow-400" />
          <span className="text-white text-sm">{agvId}</span>
        </Space>
        <Badge status={statusColors[agv.status] as any} text={
          <span className="text-gray-300 text-xs">{statusTexts[agv.status]}</span>
        } />
      </div>
      <div className="mt-1 text-xs text-gray-400">
        载重: <span className="text-white">{agv.weight}kg</span>
        {' | '}
        温度: <span className="text-white">{agv.temperature}°C</span>
      </div>
    </div>
  )
}

// 物料交易日志表格
function TransactionLog() {
  const { materialTransactions } = useStore()
  
  const columns = [
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 80,
      render: (ts: number) => new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    },
    {
      title: 'AGV',
      dataIndex: 'agvId',
      key: 'agvId',
      width: 70,
    },
    {
      title: '操作',
      dataIndex: 'type',
      key: 'type',
      width: 60,
      render: (type: string) => (
        <Tag color={type === 'load' ? 'blue' : 'green'} className="text-xs">
          {type === 'load' ? '装货' : '卸货'}
        </Tag>
      )
    },
    {
      title: '设备',
      dataIndex: 'deviceId',
      key: 'deviceId',
      width: 100,
    },
    {
      title: '数量',
      dataIndex: 'amount',
      key: 'amount',
      width: 70,
      render: (amount: number) => <span className="text-yellow-400">{amount}kg</span>
    },
    {
      title: '设备变化',
      key: 'deviceChange',
      width: 100,
      render: (_: any, record: any) => (
        <span className="text-xs">
          {record.deviceBefore} → {record.deviceAfter}
        </span>
      )
    },
  ]
  
  return (
    <Table
      dataSource={[...materialTransactions].reverse().slice(0, 10)}
      columns={columns}
      size="small"
      pagination={false}
      rowKey="timestamp"
      className="simulation-log-table"
    />
  )
}

// 主仿真面板组件
export default function SimulationPanel() {
  const { 
    isSimulationRunning, 
    simulationStats
  } = useStore()
  
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  
  return (
    <div className="space-y-4">
      {/* 仿真状态概览 */}
      <Card 
        title={
          <Space>
            <DashboardOutlined />
            <span>3D 数字孪生实时数据</span>
            {isSimulationRunning ? (
              <Tag icon={<SyncOutlined spin />} color="success">仿真运行中</Tag>
            ) : (
              <Tag color="default">仿真暂停</Tag>
            )}
          </Space>
        }
        size="small"
        className="simulation-card"
      >
        <Row gutter={16}>
          <Col span={6}>
            <Statistic
              title="运行时间"
              value={formatTime(simulationStats.uptime)}
              prefix={<FieldTimeOutlined />}
              valueStyle={{ color: '#1890ff', fontSize: 18 }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="总运输量"
              value={simulationStats.totalTransported}
              suffix="kg"
              prefix={<CarOutlined />}
              valueStyle={{ color: '#52c41a', fontSize: 18 }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="总处理量"
              value={simulationStats.totalProcessed}
              suffix="kg"
              prefix={<ExperimentOutlined />}
              valueStyle={{ color: '#faad14', fontSize: 18 }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="完成周期"
              value={simulationStats.cycleCount}
              suffix="次"
              prefix={<ThunderboltOutlined />}
              valueStyle={{ color: '#eb2f96', fontSize: 18 }}
            />
          </Col>
        </Row>
      </Card>
      
      {/* 设备物料状态 */}
      <Card title="设备物料实时状态" size="small" className="simulation-card">
        <Row gutter={[12, 12]}>
          <Col span={8}>
            <DeviceMaterialCard deviceId="D001" name="搅拌机" />
          </Col>
          <Col span={8}>
            <DeviceMaterialCard deviceId="D002" name="上甑机器人" />
          </Col>
          <Col span={8}>
            <DeviceMaterialCard deviceId="DistillationTower" name="蒸馏塔" />
          </Col>
          <Col span={8}>
            <DeviceMaterialCard deviceId="D004" name="摊凉机" />
          </Col>
          <Col span={8}>
            <DeviceMaterialCard deviceId="D003" name="输送泵" />
          </Col>
          <Col span={8}>
            {/* AGV 状态汇总 */}
            <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
              <div className="text-white font-medium mb-2">AGV 车队状态</div>
              <div className="space-y-1">
                {['AGV-01', 'AGV-02', 'AGV-03', 'AGV-04', 'AGV-05'].map(id => (
                  <AGVStatusCard key={id} agvId={id} />
                ))}
              </div>
            </div>
          </Col>
        </Row>
      </Card>
      
      {/* 物料交易日志 */}
      <Card title="物料交易日志 (最近10条)" size="small" className="simulation-card">
        <TransactionLog />
      </Card>
    </div>
  )
}
