import { Card, Progress, Tag, Space, Statistic, Row, Col, Badge, Empty } from 'antd'
import {
  SyncOutlined,
  ThunderboltOutlined,
  CarOutlined,
  ExperimentOutlined,
  FieldTimeOutlined,
  DashboardOutlined,
} from '@ant-design/icons'
import { useStore, EquipmentState, AGVState as Agv, RawMaterialBin } from '../store'

/** 设备物料卡 */
function EquipmentCard({ equipment }: { equipment?: EquipmentState }) {
  if (!equipment) return null
  const inputPercent = Math.min(100, (equipment.inputLevel / Math.max(1, equipment.inputCapacity)) * 100)
  const outputPercent = Math.min(100, (equipment.outputLevel / Math.max(1, equipment.outputCapacity)) * 100)
  const auxPercent = equipment.auxLevel != null && equipment.auxCapacity != null
    ? Math.min(100, (equipment.auxLevel / Math.max(1, equipment.auxCapacity)) * 100) : 0

  return (
    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
      <div className="flex justify-between items-center mb-2">
        <span className="text-white font-medium">{equipment.stage || equipment.name}</span>
        <Tag color={equipment.status === 'running' ? 'green' : 'orange'} className="text-xs">
          {equipment.status === 'running' ? '运行中' : equipment.status}
        </Tag>
      </div>
      <div className="space-y-2">
        <div>
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>{equipment.inputName}</span>
            <span>{equipment.inputLevel.toFixed(0)} / {equipment.inputCapacity.toFixed(0)} kg</span>
          </div>
          <Progress percent={inputPercent} size="small" strokeColor="#faad14" trailColor="#333" showInfo={false} />
        </div>
        <div>
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>{equipment.outputName}</span>
            <span>{equipment.outputLevel.toFixed(0)} / {equipment.outputCapacity.toFixed(0)} kg</span>
          </div>
          <Progress percent={outputPercent} size="small" strokeColor="#52c41a" trailColor="#333" showInfo={false} />
        </div>
        {equipment.auxName && (
          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>{equipment.auxName}</span>
              <span>{equipment.auxLevel?.toFixed(0)} / {equipment.auxCapacity?.toFixed(0)}</span>
            </div>
            <Progress percent={auxPercent} size="small" strokeColor="#1890ff" trailColor="#333" showInfo={false} />
          </div>
        )}
        <div className="text-xs text-gray-500 pt-1 border-t border-gray-700 flex justify-between">
          <span>速率 {equipment.processRate.toFixed(1)} kg/s</span>
          <span>{equipment.power.toFixed(1)} kW · {equipment.temperature.toFixed(1)}°C</span>
        </div>
      </div>
    </div>
  )
}

/** AGV 状态卡 */
function AGVCard({ agv }: { agv: Agv }) {
  const statusColors: Record<string, string> = {
    loading: 'processing',
    moving: 'success',
    unloading: 'warning',
    returning: 'default',
  }
  const statusTexts: Record<string, string> = {
    loading: '装货中',
    moving: '运输中',
    unloading: '卸货中',
    returning: '返程',
  }
  return (
    <div className="bg-gray-800/50 rounded p-2 border border-gray-700">
      <div className="flex justify-between items-center">
        <Space>
          <CarOutlined className="text-yellow-400" />
          <span className="text-white text-sm">{agv.code}</span>
        </Space>
        <Badge
          status={(statusColors[agv.stage] || 'default') as any}
          text={<span className="text-gray-300 text-xs">{statusTexts[agv.stage] || agv.stage}</span>}
        />
      </div>
      <div className="mt-1 text-xs text-gray-400">
        载重 <span className="text-white">{agv.weight.toFixed(0)}kg</span>
        {' · '}温 <span className="text-white">{agv.temperature.toFixed(1)}°C</span>
        {' · '}周期 <span className="text-cyan-300">{agv.cycleCount}</span>
      </div>
      <div className="text-[10px] text-gray-500 mt-0.5">{agv.task}</div>
    </div>
  )
}

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

export default function SimulationPanel() {
  const simulation = useStore((s) => s.simulation)
  const wsConnected = useStore((s) => s.wsConnected)

  if (!simulation) {
    return (
      <Card size="small" className="simulation-card">
        <Empty
          description={wsConnected ? '正在加载仿真快照...' : '后端未连接，等待 WebSocket'}
        />
      </Card>
    )
  }

  const eq = simulation.equipments
  const agvs = Object.values(simulation.agvs)
  const stats = simulation.stats

  // 实时计算 AGV 车队状态汇总
  const agvMoving = agvs.filter(a => a.stage === 'moving').length
  const agvLoading = agvs.filter(a => a.stage === 'loading').length
  const agvUnloading = agvs.filter(a => a.stage === 'unloading').length
  const totalCargoKg = agvs.reduce((sum, a) => sum + (a.weight || 0), 0)

  return (
    <div className="space-y-4">
      <Card
        title={
          <Space>
            <DashboardOutlined />
            <span>工艺主仿真器实时数据</span>
            <Tag icon={<SyncOutlined spin />} color="success">仿真运行中</Tag>
            <Tag color="purple">仿真已运行 {stats.simulatedDays.toFixed(2)} 天</Tag>
            <Tag color="blue">AGV 车队 {agvs.length} 台</Tag>
          </Space>
        }
        size="small"
        className="simulation-card"
      >
        <Row gutter={16}>
          <Col span={3}>
            <Statistic
              title="运行时间"
              value={formatTime(simulation.uptimeSeconds)}
              prefix={<FieldTimeOutlined />}
              valueStyle={{ color: '#1890ff', fontSize: 16 }}
            />
          </Col>
          <Col span={3}>
            <Statistic
              title="总运输量"
              value={Math.round(stats.totalTransported)}
              suffix="kg"
              prefix={<CarOutlined />}
              valueStyle={{ color: '#52c41a', fontSize: 16 }}
            />
          </Col>
          <Col span={3}>
            <Statistic
              title="总处理量"
              value={Math.round(stats.totalProcessed)}
              suffix="kg"
              prefix={<ExperimentOutlined />}
              valueStyle={{ color: '#faad14', fontSize: 16 }}
            />
          </Col>
          <Col span={3}>
            <Statistic
              title="累计基酒"
              value={Math.round(stats.totalLiquor)}
              suffix="kg"
              valueStyle={{ color: '#eb2f96', fontSize: 16 }}
            />
          </Col>
          <Col span={3}>
            <Statistic
              title="出酒率"
              value={stats.yieldRate.toFixed(1)}
              suffix="%"
              prefix={<ThunderboltOutlined />}
              valueStyle={{ color: '#13c2c2', fontSize: 16 }}
            />
          </Col>
          <Col span={3}>
            <Statistic
              title="完成周期"
              value={stats.completedCycles}
              suffix="次"
              valueStyle={{ color: '#a855f7', fontSize: 16 }}
            />
          </Col>
          <Col span={3}>
            <Statistic
              title="车队载货"
              value={Math.round(totalCargoKg)}
              suffix="kg"
              valueStyle={{ color: '#fa8c16', fontSize: 16 }}
            />
          </Col>
          <Col span={3}>
            <Statistic
              title="AGV 状态"
              value={`${agvMoving}↗ / ${agvLoading}↓ / ${agvUnloading}↑`}
              valueStyle={{ color: '#bae637', fontSize: 14 }}
            />
          </Col>
        </Row>
      </Card>

      <Card title="设备物料实时状态 (后端 SSoT)" size="small" className="simulation-card">
        <Row gutter={[12, 12]}>
          <Col span={8}><EquipmentCard equipment={eq['MIXER']} /></Col>
          <Col span={8}><EquipmentCard equipment={eq['STEAMER_BOT']} /></Col>
          <Col span={8}><EquipmentCard equipment={eq['DISTILLER']} /></Col>
          <Col span={8}><EquipmentCard equipment={eq['COOLER']} /></Col>
          <Col span={8}><EquipmentCard equipment={eq['PUMP']} /></Col>
        </Row>
      </Card>

      <Card
        title={
          <Space>
            <CarOutlined />
            <span>AGV 车队实时状态 ({agvs.length} 台)</span>
            <Tag color="green">{agvMoving} 运输</Tag>
            <Tag color="blue">{agvLoading} 装货</Tag>
            <Tag color="orange">{agvUnloading} 卸货</Tag>
          </Space>
        }
        size="small"
        className="simulation-card"
      >
        <Row gutter={[8, 8]}>
          {agvs.map((a) => (
            <Col span={6} key={a.code}>
              <AGVCard agv={a} />
            </Col>
          ))}
        </Row>
      </Card>

      <Card title="当前生产批次" size="small" className="simulation-card">
        <Row gutter={[12, 12]}>
          {simulation.activeBatches.map((b) => (
            <Col span={12} key={b.id}>
              <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-white font-medium">{b.batchNo}</span>
                  <Tag color="processing">{b.stage}</Tag>
                </div>
                <div className="text-xs text-gray-400 mb-1">
                  {b.productType} · 目标 {Math.round(b.targetVolume)} kg
                </div>
                <Progress
                  percent={Math.round(b.progress * 10) / 10}
                  strokeColor="#52c41a"
                  trailColor="#333"
                  format={() => `${Math.round(b.actualVolume)} / ${Math.round(b.targetVolume)} kg`}
                />
              </div>
            </Col>
          ))}
        </Row>
      </Card>

      {/* 分级摘酒储罐 - 头酒/中段/尾酒 */}
      {simulation.liquorStorage && (
        <Card title="自动分级摘酒储罐 (头酒/中段/尾酒)" size="small" className="simulation-card">
          <Row gutter={[12, 12]}>
            <Col span={8}>
              <LiquorTank
                name="头酒罐"
                level={simulation.liquorStorage.headLiquor}
                capacity={simulation.liquorStorage.capacity}
                color="#ff7a45"
                hint="高酸度·头流"
                ratio="5%"
              />
            </Col>
            <Col span={8}>
              <LiquorTank
                name="中段优级"
                level={simulation.liquorStorage.midLiquor}
                capacity={simulation.liquorStorage.capacity * 3}
                color="#52c41a"
                hint={`${simulation.liquorStorage.midAlcoholDegree.toFixed(1)}%vol`}
                ratio="85%"
              />
            </Col>
            <Col span={8}>
              <LiquorTank
                name="尾酒罐"
                level={simulation.liquorStorage.tailLiquor}
                capacity={simulation.liquorStorage.capacity}
                color="#13c2c2"
                hint="低度·待回入"
                ratio="10%"
              />
            </Col>
          </Row>
        </Card>
      )}

      {/* 原料发放中心 + 摊凉三段 */}
      <Row gutter={[12, 12]}>
        <Col span={14}>
          <Card title="原料发放中心 (粉粮/稻壳/曲粉)" size="small" className="simulation-card">
            <Row gutter={[12, 12]}>
              {simulation.rawMaterials && Object.values(simulation.rawMaterials).map((bin) => (
                <Col span={8} key={bin.code}>
                  <RawBinCard bin={bin} />
                </Col>
              ))}
              {simulation.diuzaoBin && (
                <Col span={24}>
                  <RawBinCard bin={simulation.diuzaoBin} color="#722ed1" />
                </Col>
              )}
            </Row>
          </Card>
        </Col>
        <Col span={10}>
          <Card title="摊凉机三段冷却" size="small" className="simulation-card">
            {simulation.coolerStages && (
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                <CoolerStageBar
                  label="第一段"
                  value={simulation.coolerStages.stage1Temp}
                  range="40-45°C"
                  color="#ff7a45"
                />
                <CoolerStageBar
                  label="第二段"
                  value={simulation.coolerStages.stage2Temp}
                  range="22-28°C"
                  color="#faad14"
                />
                <CoolerStageBar
                  label="第三段"
                  value={simulation.coolerStages.stage3Temp}
                  range="12-14°C"
                  color="#1890ff"
                />
                <div style={{
                  marginTop: 8,
                  paddingTop: 8,
                  borderTop: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 12,
                }}>
                  <span className="text-gray-400">出口糟温</span>
                  <span className="text-cyan-300">
                    {simulation.coolerStages.outletTemp.toFixed(1)}°C
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span className="text-gray-400">鼓风机功率</span>
                  <span className="text-orange-300">
                    {simulation.coolerStages.fanPower.toFixed(0)}%
                  </span>
                </div>
              </Space>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}

function LiquorTank({ name, level, capacity, color, hint, ratio }: {
  name: string; level: number; capacity: number; color: string; hint: string; ratio: string
}) {
  const pct = Math.min(100, capacity > 0 ? (level / capacity) * 100 : 0)
  return (
    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
      <div className="flex justify-between items-center mb-2">
        <span className="text-white font-medium">{name}</span>
        <Tag color={color === '#52c41a' ? 'green' : color === '#ff7a45' ? 'orange' : 'cyan'}>{ratio}</Tag>
      </div>
      <div className="text-xs text-gray-400 mb-1">{hint}</div>
      <Progress percent={pct} strokeColor={color} trailColor="#333" showInfo={false} />
      <div className="text-xs text-gray-300 mt-1 text-right">{level.toFixed(0)} / {capacity.toFixed(0)} kg</div>
    </div>
  )
}

function RawBinCard({ bin, color }: { bin: RawMaterialBin; color?: string }) {
  const pct = Math.min(100, bin.capacity > 0 ? (bin.level / bin.capacity) * 100 : 0)
  const c = color || '#faad14'
  return (
    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
      <div className="flex justify-between items-center mb-1">
        <span className="text-white text-sm">{bin.name}</span>
        <span className="text-xs text-gray-400">累计 {bin.totalFed.toFixed(0)} kg</span>
      </div>
      <Progress percent={pct} strokeColor={c} trailColor="#333" showInfo={false} />
      <div className="flex justify-between text-xs mt-1">
        <span className="text-gray-300">{bin.level.toFixed(0)} / {bin.capacity.toFixed(0)} kg</span>
        <span className="text-cyan-300">{bin.feedRate.toFixed(2)} kg/s</span>
      </div>
    </div>
  )
}

function CoolerStageBar({ label, value, range, color }: {
  label: string; value: number; range: string; color: string
}) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-300">{label}</span>
        <span style={{ color }}>{value.toFixed(1)}°C · 目标 {range}</span>
      </div>
      <Progress
        percent={Math.min(100, value / 50 * 100)}
        strokeColor={color}
        trailColor="#333"
        showInfo={false}
        size="small"
      />
    </div>
  )
}
