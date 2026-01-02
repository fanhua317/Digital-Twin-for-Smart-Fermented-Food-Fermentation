import React from 'react'
import { Html } from '@react-three/drei'

interface DistillationTowerProps {
  position: [number, number, number]
  status: string
  materialInfo?: {
    inputName: string
    outputName: string
    inputLevel: number
    outputLevel: number
    auxName?: string
    auxLevel?: number
  }
}

export default function DistillationTower({ position, status, materialInfo }: DistillationTowerProps) {
  const [showPanel, setShowPanel] = React.useState(true)

  const handleClick = (e: any) => {
    e.stopPropagation()
    setShowPanel(!showPanel)
  }

  return (
    <group position={position} onClick={handleClick}>
      {/* 塔身 */}
      <mesh position={[0, 3, 0]}>
        <cylinderGeometry args={[1.5, 2, 6, 32]} />
        <meshStandardMaterial color="#d9d9d9" metalness={0.8} roughness={0.2} />
      </mesh>
      
      {/* 塔顶 */}
      <mesh position={[0, 6.5, 0]}>
        <sphereGeometry args={[1.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#d9d9d9" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* 管道 */}
      <mesh position={[1.5, 5, 0]} rotation={[0, 0, -Math.PI / 4]}>
        <cylinderGeometry args={[0.3, 0.3, 3]} />
        <meshStandardMaterial color="#8c8c8c" />
      </mesh>

      {/* 状态指示 */}
      <pointLight 
        position={[0, 4, 0]} 
        color={status === 'running' ? '#52c41a' : '#8c8c8c'} 
        intensity={2} 
        distance={5} 
      />

      <Html position={[0, 7, 0]} center distanceFactor={12} style={{ pointerEvents: 'none' }}>
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
            蒸馏塔
          </div>
          
          {materialInfo && showPanel && (
            <div className="bg-black/70 text-white p-1.5 rounded text-[9px] border border-white/10 min-w-[100px]">
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
                
                {/* 辅助物料 (底锅水) */}
                {materialInfo.auxName && materialInfo.auxLevel !== undefined && (
                  <div className="flex justify-between items-center">
                    <span className="scale-90 origin-left text-blue-300">{materialInfo.auxName}:</span>
                    <div className="w-12 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 transition-all duration-500" 
                        style={{ width: `${Math.min(100, (materialInfo.auxLevel / 2000) * 100)}%` }}
                      />
                    </div>
                    <span className="scale-90 origin-right w-8 text-right">{Math.round(materialInfo.auxLevel)}</span>
                  </div>
                )}

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
            </div>
          )}
        </div>
      </Html>
    </group>
  )
}
