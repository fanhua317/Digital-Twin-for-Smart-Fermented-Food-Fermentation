import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text as ThreeText, Html } from '@react-three/drei'
import * as THREE from 'three'

interface PitModelProps {
  position: [number, number, number]
  pitNo: string
  status: string
  temperature: number
  onClick?: () => void
}

export default function PitModel({ position, pitNo, status, temperature, onClick }: PitModelProps) {
  const mesh = useRef<THREE.Mesh>(null!)
  const [hovered, setHover] = useState(false)

  // 根据状态决定颜色
  const getColor = () => {
    if (status === 'alarm') return '#ff4d4f'
    if (status === 'warning') return '#faad14'
    if (hovered) return '#69c0ff'
    return '#1890ff' // 正常颜色
  }

  // 简单的动画：如果是报警状态，让它闪烁
  useFrame((state) => {
    if (status === 'alarm' && mesh.current) {
      const material = mesh.current.material as THREE.MeshStandardMaterial
      if (material && 'opacity' in material) {
        material.opacity = 0.5 + Math.sin(state.clock.elapsedTime * 5) * 0.5
      }
    }
  })

  return (
    <group position={position}>
      <mesh
        ref={mesh}
        onClick={(e) => {
          e.stopPropagation()
          onClick?.()
        }}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
        position={[0, -0.5, 0]} // 下沉式窖池
      >
        {/* 窖池主体 - 挖空的盒子效果 */}
        <boxGeometry args={[4, 1.5, 4]} />
        <meshStandardMaterial 
          color={getColor()} 
          transparent 
          opacity={0.9} 
          roughness={0.8}
          metalness={0.2}
        />
      </mesh>
      {/* 窖池边缘 */}
      <mesh position={[0, 0.3, 0]}>
         <boxGeometry args={[4.2, 0.2, 4.2]} />
         <meshStandardMaterial color="#555" />
      </mesh>
      
      {/* 窖池编号 */}
      <ThreeText
        position={[0, 1.5, 0]}
        fontSize={1}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        {pitNo}
      </ThreeText>

      {/* 详细信息浮窗 (仅hover时显示) */}
      {hovered && (
        <Html position={[0, 3, 0]} center>
          <div className="bg-black/80 text-white p-2 rounded text-xs whitespace-nowrap pointer-events-none">
            <div>编号: {pitNo}</div>
            <div>温度: {temperature.toFixed(1)}°C</div>
            <div>状态: {status}</div>
          </div>
        </Html>
      )}
    </group>
  )
}
