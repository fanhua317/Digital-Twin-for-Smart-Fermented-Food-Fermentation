import { useEffect, useRef } from 'react'
import { useStore } from '../store'

// 全局仿真运行器 - 负责在后台运行仿真逻辑
export default function GlobalSimulationRunner() {
  const { 
    isSimulationRunning, 
    deviceMaterials, 
    setDeviceMaterials,
    updateSimulationStats
  } = useStore()
  
  // 使用 ref 存储最新的 deviceMaterials，避免闭包问题
  const deviceMaterialsRef = useRef(deviceMaterials)
  
  // 当 store 中的 deviceMaterials 更新时，同步到 ref
  useEffect(() => {
    deviceMaterialsRef.current = deviceMaterials
  }, [deviceMaterials])

  // 仿真主循环
  useEffect(() => {
    if (!isSimulationRunning) return

    const timer = setInterval(() => {
      const currentMaterials = { ...deviceMaterialsRef.current }
      let hasChanges = false
      let totalProcessed = 0
      
      // 1. 设备加工逻辑
      Object.keys(currentMaterials).forEach(key => {
        const device = { ...currentMaterials[key] }
        let deviceChanged = false
        
        // D003 (输送泵) 逻辑: 持续抽水，并注入到蒸馏塔
        if (device.id === 'D003') {
           const pumpAmount = device.processRate
           
           // 累计输送量增加
           device.outputLevel += pumpAmount
           deviceChanged = true
           
           // 泵送至蒸馏塔 (模拟加水工艺)
           if (currentMaterials['DistillationTower']) {
               const tower = { ...currentMaterials['DistillationTower'] }
               const currentAux = tower.auxLevel || 0
               tower.auxLevel = Math.min(2000, currentAux + pumpAmount)
               currentMaterials['DistillationTower'] = tower
               hasChanges = true
           }
           
           if (deviceChanged) {
             currentMaterials[key] = device
             hasChanges = true
           }
           return
        }

        // 蒸馏塔逻辑: 需要同时消耗 "上甑粮" 和 "底锅水"
        if (device.id === 'DistillationTower') {
           const hasWater = (device.auxLevel || 0) > 10
           const hasGrain = device.inputLevel > 0
           
           if (hasWater && hasGrain && device.outputLevel < 2000) {
              const amount = Math.min(device.inputLevel, device.processRate)
              // 消耗粮食
              device.inputLevel -= amount
              // 消耗水 (比例假设 1:0.5)
              if (device.auxLevel !== undefined) device.auxLevel -= (amount * 0.5)
              // 产出酒糟
              device.outputLevel += amount
              totalProcessed += amount
              deviceChanged = true
           }
        }
        // 其他设备常规转化
        else if (device.inputLevel > 0 && device.outputLevel < 2000) {
          const amount = Math.min(device.inputLevel, device.processRate)
          device.inputLevel -= amount
          device.outputLevel += amount
          totalProcessed += amount
          deviceChanged = true
        }
        
        if (deviceChanged) {
          currentMaterials[key] = device
          hasChanges = true
        }
      })

      // 2. 后台物流模拟 (仅当 3D 场景未激活时运行)
      // 当用户离开 3D 页面时，使用简化的直接传输逻辑代替 AGV，保证物料流转不断
      if (!useStore.getState().is3DSceneActive) {
         const transferRoutes = [
           { from: 'D001', to: 'D002' },
           { from: 'D002', to: 'DistillationTower' },
           { from: 'DistillationTower', to: 'D004' }
         ]

         transferRoutes.forEach(route => {
            if (currentMaterials[route.from] && currentMaterials[route.to]) {
               const source = { ...currentMaterials[route.from] }
               const target = { ...currentMaterials[route.to] }
               
               // 模拟 AGV 搬运速率 (每秒 50 单位)
               const transferRate = 50
               const amount = Math.min(source.outputLevel, transferRate, 2000 - target.inputLevel)
               
               if (amount > 0) {
                  source.outputLevel -= amount
                  target.inputLevel += amount
                  
                  currentMaterials[route.from] = source
                  currentMaterials[route.to] = target
                  hasChanges = true
                  
                  updateSimulationStats({ 
                    totalTransported: useStore.getState().simulationStats.totalTransported + amount 
                  })
               }
            }
         })
      }
      
      // 只有在发生变化时才更新 store，减少渲染次数
      if (hasChanges) {
        setDeviceMaterials(currentMaterials)
      }
      
      // 更新仿真统计
      if (totalProcessed > 0) {
        updateSimulationStats({ 
          totalProcessed: useStore.getState().simulationStats.totalProcessed + totalProcessed 
        })
      }
      
      // 更新运行时间
      updateSimulationStats({ 
        uptime: useStore.getState().simulationStats.uptime + 1 
      })
      
    }, 1000)

    return () => clearInterval(timer)
  }, [isSimulationRunning, setDeviceMaterials, updateSimulationStats])

  return null // 这个组件不渲染任何 UI
}
