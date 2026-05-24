import { useRef, useEffect, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

interface CameraControllerProps {
  targetPosition?: [number, number, number]
  targetLookAt?: [number, number, number]
}

export default function CameraController({ 
  targetPosition, 
  targetLookAt 
}: CameraControllerProps) {
  const { controls } = useThree()
  const [isAnimating, setIsAnimating] = useState(false)
  const animationTime = useRef(0)
  const prevTargetPos = useRef<string>('')

  // 当目标位置改变时，触发动画
  useEffect(() => {
    if (targetPosition && targetLookAt) {
      const newPosKey = targetPosition.join(',') + targetLookAt.join(',')
      if (newPosKey !== prevTargetPos.current) {
        prevTargetPos.current = newPosKey
        setIsAnimating(true)
        animationTime.current = 0
      }
    }
  }, [targetPosition, targetLookAt])

  useFrame((state, delta) => {
    if (!isAnimating || !targetPosition || !targetLookAt) return

    animationTime.current += delta
    
    // 动画持续 1.5 秒后停止，释放控制权
    if (animationTime.current > 1.5) {
      setIsAnimating(false)
      return
    }

    // 平滑移动相机位置
    const targetPosVec = new THREE.Vector3(...targetPosition)
    state.camera.position.lerp(targetPosVec, delta * 3) // 加快一点速度

    // 平滑移动观察点 (OrbitControls target)
    const targetLookAtVec = new THREE.Vector3(...targetLookAt)
    // @ts-ignore
    const controlsTarget = controls?.target as THREE.Vector3
    
    if (controlsTarget) {
      controlsTarget.lerp(targetLookAtVec, delta * 3)
      // @ts-ignore
      controls?.update()
    }
  })

  return null
}
