import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

interface DeviceModelProps {
  position: [number, number, number]
  deviceNo: string
  name: string
  type: string
  status: string
  onClick?: () => void
  materialInfo?: {
    inputName: string
    outputName: string
    inputLevel: number
    outputLevel: number
  }
}

export default function DeviceModel({ position, deviceNo: _deviceNo, name, type, status, onClick, materialInfo }: DeviceModelProps) {
  const mesh = useRef<THREE.Mesh>(null!)
  const [_hovered, setHover] = useState(false)
  const [showPanel, setShowPanel] = useState(true)

  // 根据状态决定颜色
  const getColor = () => {
    if (status === 'fault') return '#ff4d4f'
    if (status === 'warning') return '#faad14'
    if (status === 'stopped') return '#8c8c8c'
    return '#52c41a' // 运行中
  }

  // 旋转动画 (如果是电机或泵)
  useFrame((_state, delta) => {
    if (status === 'running' && (type === 'motor' || type === 'pump')) {
      mesh.current.rotation.y += delta * 2
    }
  })

  const handleClick = (e: any) => {
    e.stopPropagation()
    setShowPanel(!showPanel)
    if (onClick) onClick()
  }

  // 根据类型选择几何体
  const getGeometry = () => {
    switch (type) {
      case 'pump':
        return (
          <group>
            <mesh position={[0, 0.5, 0]}>
              <cylinderGeometry args={[0.8, 0.8, 1.5, 32]} />
              <meshStandardMaterial color="#888" metalness={0.8} roughness={0.2} />
            </mesh>
            <mesh position={[0.8, 0.5, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.3, 0.3, 1, 32]} />
              <meshStandardMaterial color="#666" />
            </mesh>
          </group>
        )
      case 'motor':
        return (
          <group>
            <mesh position={[0, 0.5, 0]}>
              <boxGeometry args={[1.5, 1.5, 1.5]} />
              <meshStandardMaterial color="#333" />
            </mesh>
            <mesh position={[0, 0.5, 0.8]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.2, 0.2, 0.5, 16]} />
              <meshStandardMaterial color="#999" />
            </mesh>
          </group>
        )
      case 'robot':
        return (
          <group>
             <mesh position={[0, 0.2, 0]}>
               <cylinderGeometry args={[0.8, 1, 0.4, 32]} />
               <meshStandardMaterial color="#faad14" />
             </mesh>
             <mesh position={[0, 1.5, 0]}>
               <boxGeometry args={[0.5, 2, 0.5]} />
               <meshStandardMaterial color="#faad14" />
             </mesh>
             <mesh position={[0, 2.5, 0.5]} rotation={[Math.PI/4, 0, 0]}>
               <boxGeometry args={[0.4, 1.5, 0.4]} />
               <meshStandardMaterial color="#faad14" />
             </mesh>
          </group>
        )
      case 'conveyor':
        return (
          <group>
            <mesh position={[0, 0.2, 0]}>
              <boxGeometry args={[4, 0.4, 1.5]} />
              <meshStandardMaterial color="#555" />
            </mesh>
            {/* 滚筒 */}
            {[-1.5, -0.5, 0.5, 1.5].map(x => (
              <mesh key={x} position={[x, 0.4, 0]} rotation={[0, 0, Math.PI/2]}>
                <cylinderGeometry args={[0.1, 0.1, 1.4, 16]} />
                <meshStandardMaterial color="#333" />
              </mesh>
            ))}
          </group>
        )
      default:
        return <boxGeometry args={[1.5, 1.5, 1.5]} />
    }
  }

  return (
    <group position={position}>
      <group 
        ref={mesh as any} 
        onClick={handleClick}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
      >
        {getGeometry()}
      </group>

      {/* 状态指示灯 */}
      <mesh position={[0, 2.5, 0]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshBasicMaterial color={getColor()} />
      </mesh>

      {/* 设备名称和物料信息 */}
      <Html position={[0, 3.5, 0]} center distanceFactor={12} style={{ pointerEvents: 'none' }}>
        <div className="flex flex-col items-center gap-1">
          <div style={{ 
            color: 'white', 
            fontSize: '10px', 
            background: 'rgba(0,0,0,0.6)', 
            padding: '2px 4px', 
            borderRadius: '2px',
            whiteSpace: 'nowrap',
            cursor: 'pointer',
            pointerEvents: 'auto'
          }} onClick={handleClick}>
            {name}
          </div>
          
          {materialInfo && showPanel && (
            <div className="bg-black/70 text-white p-1.5 rounded text-[9px] border border-white/10 min-w-[100px]">
              {type === 'pump' ? (
                // 泵的特殊显示逻辑
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="scale-90 origin-left text-blue-300">{materialInfo.inputName}:</span>
                    <span className="scale-90 origin-right text-blue-300 font-bold">{materialInfo.inputLevel} L/s</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="scale-90 origin-left text-gray-300">{materialInfo.outputName}:</span>
                    <span className="scale-90 origin-right text-gray-300">{Math.round(materialInfo.outputLevel)} L</span>
                  </div>
                </div>
              ) : (
                // 其他设备的常规显示逻辑
                <>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-gray-400">{materialInfo.inputName}</span>
                    <span className="text-yellow-400">→</span>
                    <span className="text-green-400">{materialInfo.outputName}</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="scale-90 origin-left text-gray-300">待处理:</span>
                      <div className="w-12 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-yellow-500 transition-all duration-500" 
                          style={{ width: `${Math.min(100, (materialInfo.inputLevel / 2000) * 100)}%` }}
                        />
                      </div>
                      <span className="scale-90 origin-right w-8 text-right">{Math.round(materialInfo.inputLevel)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="scale-90 origin-left text-gray-300">已转化:</span>
                      <div className="w-12 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-green-500 transition-all duration-500" 
                          style={{ width: `${Math.min(100, (materialInfo.outputLevel / 2000) * 100)}%` }}
                        />
                      </div>
                      <span className="scale-90 origin-right w-8 text-right">{Math.round(materialInfo.outputLevel)}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </Html>
    </group>
  )
}
