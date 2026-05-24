import { memo, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Stars, Text as ThreeText, Html } from '@react-three/drei'
import * as THREE from 'three'
import PitModel from './PitModel'
import DeviceModel from './DeviceModel'
import AGVModel from './AGVModel'
import DistillationTower from './DistillationTower'
import CameraController from './CameraController'
import { useWebSocket } from '../../hooks/useWebSocket'
import { useStore, EquipmentState, AGVState as AgvState } from '../../store'
import { pitsApi } from '../../services/api'

interface SceneProps {
  isPlaying: boolean
  mode?: 'monitor' | 'simulation'
  simulationStep?: number
}

const SIMULATION_STEPS = [
  { pos: [40, 40, 40], lookAt: [0, 0, 0] },
  { pos: [-15, 20, -30], lookAt: [-25, 0, -25] },
  { pos: [-35, 15, -15], lookAt: [-25, 0, -15] },
  { pos: [-35, 15, 0], lookAt: [-25, 0, 0] },
  { pos: [0, 20, 0], lookAt: [0, 5, 0] },
  { pos: [35, 15, 0], lookAt: [25, 0, 0] },
  { pos: [25, 25, -25], lookAt: [25, 0, -25] },
]

// 输送泵 → 蒸馏塔 的输水管道
function WaterPipe() {
  const path = useMemo(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(-25, 0.5, 15),
    new THREE.Vector3(-25, 0.2, 16),
    new THREE.Vector3(0, 0.2, 16),
    new THREE.Vector3(0, 0.2, 2),
    new THREE.Vector3(0, 3, 2),
    new THREE.Vector3(0, 4, 1.5),
  ], false, 'catmullrom', 0.05), [])

  const textureRef = useRef<THREE.Texture>(null!)
  useFrame((_state, delta) => {
    if (textureRef.current) textureRef.current.offset.x -= delta * 0.5
  })

  return (
    <group>
      <mesh>
        <tubeGeometry args={[path, 64, 0.2, 8, false]} />
        <meshStandardMaterial color="#4fc3f7" metalness={0.6} roughness={0.2} opacity={0.9} transparent />
      </mesh>
      {[-20, -15, -10, -5, 0].map(x => (
        <mesh key={x} position={[x, 0.1, 16]}>
          <boxGeometry args={[0.5, 0.2, 0.5]} />
          <meshStandardMaterial color="#333" />
        </mesh>
      ))}
    </group>
  )
}

/** 工艺流向箭头 (设备之间的物料流动方向指示) */
function ProcessFlowArrow({ from, to, color = '#42e07b', label }: {
  from: [number, number, number]
  to: [number, number, number]
  color?: string
  label?: string
}) {
  const start = useMemo(() => new THREE.Vector3(...from), [from])
  const end = useMemo(() => new THREE.Vector3(...to), [to])
  const mid = useMemo(() => new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5).setY(1.2), [start, end])
  const length = useMemo(() => start.distanceTo(end), [start, end])
  const direction = useMemo(() => new THREE.Vector3().subVectors(end, start).normalize(), [start, end])
  const angle = useMemo(() => Math.atan2(direction.x, direction.z), [direction])

  return (
    <group>
      {/* 流向虚线管 */}
      <mesh position={[(start.x + end.x) / 2, 0.5, (start.z + end.z) / 2]} rotation={[0, angle, 0]}>
        <boxGeometry args={[0.4, 0.08, length]} />
        <meshStandardMaterial color={color} transparent opacity={0.35} />
      </mesh>
      {/* 箭头 (在终点附近指向 to) */}
      <mesh position={[end.x - direction.x * 1.5, 0.6, end.z - direction.z * 1.5]} rotation={[Math.PI / 2, 0, -angle]}>
        <coneGeometry args={[0.45, 1.2, 4]} />
        <meshStandardMaterial color={color} transparent opacity={0.85} />
      </mesh>
      {/* 标签 */}
      {label && (
        <Html position={[mid.x, mid.y, mid.z]} center distanceFactor={18} style={{ pointerEvents: 'none' }}>
          <div className="bg-black/70 text-white px-2 py-0.5 rounded text-[10px] border border-white/15 whitespace-nowrap">
            {label}
          </div>
        </Html>
      )}
    </group>
  )
}

/** 头/中/尾酒三联储罐 (背靠蒸馏塔，呈三联立罐) */
function LiquorTanks({ headLevel, midLevel, tailLevel, capacity, midAlcohol }: {
  headLevel: number
  midLevel: number
  tailLevel: number
  capacity: number
  midAlcohol: number
}) {
  const tanks = [
    { name: '头酒', x: 6, level: headLevel, max: capacity, color: '#ff7a45', ratio: '5%' },
    { name: '中段', x: 9, level: midLevel, max: capacity * 3, color: '#52c41a', ratio: `${midAlcohol.toFixed(0)}%vol` },
    { name: '尾酒', x: 12, level: tailLevel, max: capacity, color: '#13c2c2', ratio: '10%' },
  ]
  return (
    <group>
      {tanks.map((t, i) => {
        const fillPercent = Math.min(1, t.max > 0 ? t.level / t.max : 0)
        const fillHeight = 2.6 * fillPercent
        return (
          <group key={i} position={[t.x, 0, 4]}>
            {/* 罐体外壳 (透明圆筒) */}
            <mesh position={[0, 1.5, 0]}>
              <cylinderGeometry args={[0.8, 0.8, 3, 24, 1, true]} />
              <meshStandardMaterial color="#cccccc" metalness={0.7} roughness={0.3} transparent opacity={0.35} side={THREE.DoubleSide} />
            </mesh>
            {/* 罐顶 */}
            <mesh position={[0, 3.1, 0]}>
              <cylinderGeometry args={[0.85, 0.8, 0.15, 24]} />
              <meshStandardMaterial color="#888" metalness={0.8} roughness={0.3} />
            </mesh>
            {/* 罐底支架 */}
            <mesh position={[0, 0.1, 0]}>
              <cylinderGeometry args={[0.9, 0.9, 0.2, 24]} />
              <meshStandardMaterial color="#444" />
            </mesh>
            {/* 酒液 (按比例填充) */}
            {fillHeight > 0.01 && (
              <mesh position={[0, 0.2 + fillHeight / 2, 0]}>
                <cylinderGeometry args={[0.76, 0.76, fillHeight, 24]} />
                <meshStandardMaterial color={t.color} transparent opacity={0.85} emissive={t.color} emissiveIntensity={0.15} />
              </mesh>
            )}
            {/* 标签 */}
            <Html position={[0, 3.7, 0]} center distanceFactor={14} style={{ pointerEvents: 'none' }}>
              <div className="px-1.5 py-0.5 rounded bg-black/70 text-white text-[10px] border border-white/15 whitespace-nowrap">
                {t.name} <span style={{ color: t.color }}>{t.level.toFixed(0)}kg</span>
                <div className="text-[8px] text-gray-300">{t.ratio}</div>
              </div>
            </Html>
          </group>
        )
      })}
    </group>
  )
}

/** 工艺流程图例 (3D 场景 HUD) */
function ProcessLegend() {
  return (
    <Html position={[-32, 14, 0]} center distanceFactor={26} style={{ pointerEvents: 'none' }}>
      <div className="bg-black/75 backdrop-blur-sm text-white px-3 py-2 rounded-lg border border-white/15 min-w-[180px]">
        <div className="text-xs font-bold mb-1.5 text-yellow-300">🏭 浓香型白酒工艺流程</div>
        <div className="text-[10px] space-y-0.5">
          <div><span className="text-cyan-300">1.</span> 起糟 (AGV-01) - 出窖糟醅</div>
          <div><span className="text-cyan-300">2.</span> 配料拌粮 (搅拌机)</div>
          <div><span className="text-cyan-300">3.</span> 上甑 (机器人, AGV-03)</div>
          <div><span className="text-cyan-300">4.</span> 蒸馏接酒 (头/中/尾分级)</div>
          <div><span className="text-cyan-300">5.</span> 摊凉加曲 (5% 曲粉)</div>
          <div><span className="text-cyan-300">6.</span> 入池发酵 60 天</div>
        </div>
      </div>
    </Html>
  )
}

interface PitView {
  id: number
  pitNo: string
  zone: string
  row: number
  col: number
  status: string
  stage: string
  fermentationDay: number
  phValue: number
  temperature: number
}

/** 把后端 EquipmentState 映射为 3D 设备显示属性 */
function toMaterialInfo(eq?: EquipmentState) {
  if (!eq) return undefined
  return {
    inputName: eq.inputName,
    outputName: eq.outputName,
    inputLevel: eq.inputLevel,
    outputLevel: eq.outputLevel,
    auxName: eq.auxName,
    auxLevel: eq.auxLevel ?? 0,
  }
}

export default function Scene({ isPlaying, mode = 'monitor', simulationStep = 0 }: SceneProps) {
  // 用细粒度 selector 减少不必要的整树重渲染
  const equipments = useStore((s) => s.simulation?.equipments) || {}
  const agvs = useStore((s) => s.simulation?.agvs) || {}
  // 3D 内仍需 liquorStorage 驱动东侧三联储罐模型, 其余 KPI 已由 SceneHUDStrip 独立订阅
  const liquorStorage = useStore((s) => s.simulation?.liquorStorage)
  const [pits, setPits] = useState<PitView[]>([])

  // 订阅共享 WebSocket (单例，多组件复用同一连接)
  useWebSocket('digital-twin-pit', (msg) => {
    if (msg.type === 'pit_data' && Array.isArray(msg.data)) {
      const tempMap = new Map<number, number>()
      const statusMap = new Map<number, string>()
      const phMap = new Map<number, number>()
      msg.data.forEach((d: any) => {
        if (d.pitId != null && d.temperature != null) tempMap.set(d.pitId, d.temperature)
        if (d.pitId != null && d.status) statusMap.set(d.pitId, d.status)
        if (d.pitId != null && d.phValue != null) phMap.set(d.pitId, d.phValue)
      })
      // 仅在确实有变化时更新对应窖池
      setPits((prev) => {
        let changed = false
        const next = prev.map((p) => {
          const nt = tempMap.get(p.id)
          const ns = statusMap.get(p.id)
          const nph = phMap.get(p.id)
          const tempChanged = nt != null && Math.abs(nt - p.temperature) >= 0.5
          const statusChanged = ns && ns !== p.status
          const phChanged = nph != null && Math.abs(nph - p.phValue) >= 0.1
          if (tempChanged || statusChanged || phChanged) {
            changed = true
            return {
              ...p,
              temperature: nt ?? p.temperature,
              status: ns ?? p.status,
              phValue: nph ?? p.phValue,
            }
          }
          return p
        })
        return changed ? next : prev
      })
    }
  })

  // 从后端加载真实窖池列表（带后端真实编号 A-001 ... D-100）
  useEffect(() => {
    let cancelled = false
    pitsApi.list().then((data: any) => {
      if (cancelled || !Array.isArray(data)) return
      const view: PitView[] = data.map((p: any) => ({
        id: p.id,
        pitNo: p.pitNo,
        zone: p.zone,
        row: p.row,
        col: p.col,
        status: p.status,
        stage: p.stage,
        fermentationDay: p.fermentationDay ?? 0,
        phValue: p.entryAcidity != null ? 4.0 - Math.min(0.9, (p.fermentationDay ?? 0) * 0.015) : 4.0,
        temperature: p.entryTemperature ?? 25,
      }))
      setPits(view)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  // 3D 中按 zone+row+col 摆位 - 4 区紧贴生产线两侧形成"H"形厂房
  // 生产线: 配料区(-25,-15) → 上甑区(-25,0) → 馏酒区(0,0) → 摊凉区(25,0) → 输送泵(-25,15)
  // A区(西北): 紧邻配料区/上甑区西侧
  // B区(东北): 紧邻摊凉区/馏酒区东侧
  // C区(西南): 紧邻输送泵
  // D区(东南): 紧邻摊凉机南侧
  const pitPositions = useMemo(() => {
    const arr: { pit: PitView, position: [number, number, number] }[] = []
    pits.forEach(p => {
      // 4 区基坐标: 把窖池压缩到 4×5 紧凑布局, 与生产线相邻 (zone 占 20×20 单位)
      let baseX = 0, baseZ = 0
      switch (p.zone) {
        case 'A': baseX = -42; baseZ = -28; break // 西北 (邻配料/上甑)
        case 'B': baseX = 32;  baseZ = -28; break // 东北 (邻摊凉)
        case 'C': baseX = -42; baseZ = 8;   break // 西南 (邻输送泵)
        case 'D': baseX = 32;  baseZ = 8;   break // 东南 (邻摊凉机南)
      }
      // 4 行 × 5 列 紧凑布局 (3 单位间距, 池子更密集)
      const x = baseX + (p.col - 1) * 3
      const z = baseZ + (p.row - 1) * 3
      arr.push({ pit: p, position: [x, 1, z] })
    })
    return arr
  }, [pits])

  // 5 台核心设备的 3D 位置（与后端一致）
  const equipmentLayout = [
    { code: 'MIXER', name: '搅拌机', type: 'motor', pos: [-25, 0, -15] as [number, number, number] },
    { code: 'STEAMER_BOT', name: '上甑机器人', type: 'robot', pos: [-25, 0, 0] as [number, number, number] },
    { code: 'COOLER', name: '摊凉机', type: 'conveyor', pos: [25, 0, 0] as [number, number, number] },
    { code: 'PUMP', name: '输送泵', type: 'pump', pos: [-25, 0, 15] as [number, number, number] },
  ]

  return (
    <div className="w-full h-full bg-gray-900 rounded-lg overflow-hidden">
      {/* 性能优化：限制设备像素比 + 关闭阴影 (大幅减少每帧 GPU 负担) */}
      <Canvas
        camera={{ position: [40, 40, 40], fov: 45 }}
        dpr={[1, 1.5]}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
      >
        <Suspense fallback={null}>
          <color attach="background" args={['#050505']} />

          <ambientLight intensity={0.55} />
          <directionalLight position={[-20, 30, 20]} intensity={1.1} />

          {/* 星空降到 1500 颗 + 关闭闪烁，避免不必要的逐帧重新计算 */}
          <Stars radius={150} depth={50} count={1500} factor={4} saturation={0} fade={false} speed={0} />

          {/* 用固定平面 + 网格纹理代替 infiniteGrid (后者每帧都做透明 quad 渲染) */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
            <planeGeometry args={[160, 160, 32, 32]} />
            <meshStandardMaterial color="#0a1814" wireframe={false} />
          </mesh>
          <gridHelper args={[160, 32, '#42e07b', '#1a2e22']} position={[0, 0.01, 0]} />

          <OrbitControls
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            maxPolarAngle={Math.PI / 2.1}
            makeDefault
          />

          {mode === 'simulation' && (
            <CameraController
              targetPosition={SIMULATION_STEPS[simulationStep]?.pos as [number, number, number]}
              targetLookAt={SIMULATION_STEPS[simulationStep]?.lookAt as [number, number, number]}
            />
          )}

          {/* 道路 */}
          <group position={[0, 0.05, 0]}>
            <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[80, 4]} />
              <meshStandardMaterial color="#333" />
            </mesh>
            <mesh position={[-30, 0, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
              <planeGeometry args={[80, 4]} />
              <meshStandardMaterial color="#333" />
            </mesh>
          </group>

          {/* 窖池群：使用后端真实窖池 (A-001 ~ D-100) */}
          <group>
            {pitPositions.map(({ pit, position }) => (
              <PitModel
                key={pit.id}
                position={position}
                pitNo={pit.pitNo}
                status={pit.status}
                stage={pit.stage}
                fermentationDay={pit.fermentationDay}
                phValue={pit.phValue}
                temperature={pit.temperature}
              />
            ))}
          </group>

          {/* 4 台地面设备 */}
          {equipmentLayout.map((d) => (
            <DeviceModel
              key={d.code}
              position={d.pos}
              deviceNo={equipments[d.code]?.name || d.code}
              name={d.name}
              type={d.type}
              status={equipments[d.code]?.status || (isPlaying ? 'running' : 'stopped')}
              materialInfo={toMaterialInfo(equipments[d.code])}
            />
          ))}

          {/* 8 台 AGV - 位置/状态完全由后端驱动 */}
          {Object.values(agvs).map((agv: AgvState) => (
            <AGVModel
              key={agv.code}
              agvId={agv.code}
              position={agv.position as [number, number, number]}
              status={isPlaying ? agv.stage : 'stopped'}
              cargoType={(agv.cargoType as any) || 'empty'}
              weight={agv.weight}
              weightCapacity={agv.weightCapacity}
              temperature={agv.temperature}
              ph={agv.ph}
              task={agv.task}
              sourcePitNo={agv.sourcePitNo}
            />
          ))}

          {/* 蒸馏塔 */}
          <DistillationTower
            position={[0, 0, 0]}
            status={equipments['DISTILLER']?.status || 'running'}
            materialInfo={toMaterialInfo(equipments['DISTILLER'])}
          />

          {/* 头/中/尾酒三联储罐 (背靠蒸馏塔东侧) */}
          {liquorStorage && (
            <LiquorTanks
              headLevel={liquorStorage.headLiquor}
              midLevel={liquorStorage.midLiquor}
              tailLevel={liquorStorage.tailLiquor}
              capacity={liquorStorage.capacity}
              midAlcohol={liquorStorage.midAlcoholDegree}
            />
          )}

          {/* 输送管道 (输送泵 → 蒸馏塔) */}
          <WaterPipe />

          {/* 工艺主流向箭头：A/C 起糟 → 配料 → 上甑 → 馏酒 → 摊凉 → B/D 入池 */}
          <ProcessFlowArrow from={[-36, 0, -22]} to={[-25, 0, -15]} color="#fa8c16" label="① A 区起糟" />
          <ProcessFlowArrow from={[-36, 0, 16]} to={[-25, 0, -15]} color="#ff7a45" label="② C 区起糟" />
          <ProcessFlowArrow from={[-25, 0, -15]} to={[-25, 0, 0]} color="#faad14" label="③ 拌粮→上甑" />
          <ProcessFlowArrow from={[-25, 0, 0]} to={[0, 0, 0]} color="#5bc0ff" label="④ 上甑→蒸馏" />
          <ProcessFlowArrow from={[0, 0, 0]} to={[25, 0, 0]} color="#52c41a" label="⑤ 蒸馏→摊凉" />
          <ProcessFlowArrow from={[25, 0, 0]} to={[38, 0, -22]} color="#13c2c2" label="⑥ 摊凉→B 区" />
          <ProcessFlowArrow from={[25, 0, 0]} to={[38, 0, 18]} color="#36cfc9" label="⑦ 摊凉→D 区" />
          {/* 工艺流程图例 (左上角 HUD) */}
          <ProcessLegend />

          {/* 区域标识 */}
          <ThreeText position={[-25, 8, -15]} fontSize={3} color="#ffffff" outlineWidth={0.1} outlineColor="#000">配料区</ThreeText>
          <ThreeText position={[-25, 8, 0]} fontSize={3} color="#ffffff" outlineWidth={0.1} outlineColor="#000">上甑区</ThreeText>
          <ThreeText position={[0, 12, 0]} fontSize={3} color="#ffffff" outlineWidth={0.1} outlineColor="#000">馏酒区</ThreeText>
          <ThreeText position={[25, 8, 0]} fontSize={3} color="#ffffff" outlineWidth={0.1} outlineColor="#000">摊凉区</ThreeText>
          {/* 区域标识 - 跟随新的紧凑布局 */}
          <ThreeText position={[-36, 7, -32]} fontSize={2.5} color="#5bc0ff" outlineWidth={0.08} outlineColor="#000">A 区</ThreeText>
          <ThreeText position={[38, 7, -32]} fontSize={2.5} color="#5bc0ff" outlineWidth={0.08} outlineColor="#000">B 区</ThreeText>
          <ThreeText position={[-36, 7, 22]} fontSize={2.5} color="#5bc0ff" outlineWidth={0.08} outlineColor="#000">C 区</ThreeText>
          <ThreeText position={[38, 7, 22]} fontSize={2.5} color="#5bc0ff" outlineWidth={0.08} outlineColor="#000">D 区</ThreeText>

        </Suspense>
      </Canvas>

      {/* HUDs 已移到 3D 场景之外 (SimulationController 顶部横向条),
          避免遮挡视野并保持 3D 渲染线程性能 */}
    </div>
  )
}

/**
 * 3D 场景顶部 4 卡 KPI 横向条 - 用 store 内部订阅, 与 3D 场景解耦
 * 由 SimulationController 在 3D 上方独立行渲染, 不再遮挡 3D 视野
 */
export const SceneHUDStrip = memo(function SceneHUDStrip() {
  const yieldRate = useStore((s) => s.simulation?.stats?.yieldRate) ?? 0
  const totalLiquor = useStore((s) => s.simulation?.stats?.totalLiquor) ?? 0
  const totalTransported = useStore((s) => s.simulation?.stats?.totalTransported) ?? 0
  const activeBatchesCount = useStore((s) => s.simulation?.activeBatches?.length) ?? 0
  const coolerStages = useStore((s) => s.simulation?.coolerStages)
  const rawMaterials = useStore((s) => s.simulation?.rawMaterials)
  const liquorStorage = useStore((s) => s.simulation?.liquorStorage)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
      {/* 全厂实时统计 */}
      <div className="bg-black/60 text-white px-3 py-2 rounded-lg border border-blue-500/40">
        <div className="text-blue-300 font-bold mb-1">📊 全厂实时统计</div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
          <span className="text-gray-400">出酒率</span><span className="text-green-300 text-right">{yieldRate.toFixed(1)}%</span>
          <span className="text-gray-400">累计基酒</span><span className="text-pink-300 text-right">{Math.round(totalLiquor)} kg</span>
          <span className="text-gray-400">累计运输</span><span className="text-yellow-300 text-right">{Math.round(totalTransported)} kg</span>
          <span className="text-gray-400">活跃批次</span><span className="text-cyan-300 text-right">{activeBatchesCount} 个</span>
        </div>
      </div>

      {/* 摊凉机三段冷却 */}
      <div className="bg-black/60 text-white px-3 py-2 rounded-lg border border-orange-500/40">
        <div className="text-orange-300 font-bold mb-1">🌡️ 摊凉机三段冷却</div>
        {coolerStages ? (
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
            <span className="text-gray-400">第一段</span><span className="text-red-300 text-right">{coolerStages.stage1Temp.toFixed(1)}°C</span>
            <span className="text-gray-400">第二段</span><span className="text-yellow-300 text-right">{coolerStages.stage2Temp.toFixed(1)}°C</span>
            <span className="text-gray-400">第三段</span><span className="text-blue-300 text-right">{coolerStages.stage3Temp.toFixed(1)}°C</span>
            <span className="text-gray-400">出口/风机</span><span className="text-cyan-300 text-right">{coolerStages.outletTemp.toFixed(1)}° · {coolerStages.fanPower.toFixed(0)}%</span>
          </div>
        ) : (
          <div className="text-gray-400">未启动</div>
        )}
      </div>

      {/* 原料发放中心 */}
      {rawMaterials ? (
        <div className="bg-black/60 text-white px-3 py-2 rounded-lg border border-yellow-500/40">
          <div className="text-yellow-300 font-bold mb-1">🌾 原料发放中心</div>
          <div className="space-y-0.5">
            {Object.entries(rawMaterials).map(([code, bin]: [string, any]) => {
              const pct = Math.min(100, (bin.level / Math.max(1, bin.capacity)) * 100)
              return (
                <div key={code} className="flex items-center gap-2">
                  <span className="w-12 text-gray-400 truncate">{bin.name?.slice(0, 3) ?? code}</span>
                  <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-yellow-400" style={{ width: pct + '%' }} />
                  </div>
                  <span className="text-right text-cyan-300 w-16 truncate">{Math.round(bin.level)}kg</span>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="bg-black/60 text-white px-3 py-2 rounded-lg border border-yellow-500/40">
          <div className="text-yellow-300 font-bold">🌾 原料发放中心</div>
          <div className="text-gray-400 mt-1">加载中</div>
        </div>
      )}

      {/* 自动分级摘酒储罐 */}
      {liquorStorage ? (
        <div className="bg-black/60 text-white px-3 py-2 rounded-lg border border-pink-500/40">
          <div className="text-pink-300 font-bold mb-1">🍶 自动分级摘酒储罐</div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="w-14 text-orange-300">头 5%</span>
              <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-orange-400" style={{ width: Math.min(100, (liquorStorage.headLiquor / Math.max(1, liquorStorage.capacity)) * 100) + '%' }} />
              </div>
              <span className="text-right text-orange-200 w-14 truncate">{Math.round(liquorStorage.headLiquor)}kg</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-14 text-green-300">中 85%</span>
              <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-green-400" style={{ width: Math.min(100, (liquorStorage.midLiquor / Math.max(1, liquorStorage.capacity * 3)) * 100) + '%' }} />
              </div>
              <span className="text-right text-green-200 w-14 truncate">{Math.round(liquorStorage.midLiquor)}kg</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-14 text-cyan-300">尾 10%</span>
              <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-cyan-400" style={{ width: Math.min(100, (liquorStorage.tailLiquor / Math.max(1, liquorStorage.capacity)) * 100) + '%' }} />
              </div>
              <span className="text-right text-cyan-200 w-14 truncate">{Math.round(liquorStorage.tailLiquor)}kg</span>
            </div>
            <div className="text-right text-yellow-300 text-[10px] pt-0.5">中段酒度 {liquorStorage.midAlcoholDegree?.toFixed(1) ?? '--'} %vol</div>
          </div>
        </div>
      ) : (
        <div className="bg-black/60 text-white px-3 py-2 rounded-lg border border-pink-500/40">
          <div className="text-pink-300 font-bold">🍶 自动分级摘酒储罐</div>
          <div className="text-gray-400 mt-1">加载中</div>
        </div>
      )}
    </div>
  )
})
