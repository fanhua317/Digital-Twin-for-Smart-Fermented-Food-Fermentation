import { Routes, Route, Navigate } from 'react-router-dom'
import MainLayout from './layouts/MainLayout'
import Dashboard from './pages/Dashboard'
import PitMonitor from './pages/PitMonitor'
import DeviceMonitor from './pages/DeviceMonitor'
import AlarmCenter from './pages/AlarmCenter'
import ProductionManage from './pages/ProductionManage'
import DigitalTwin from './pages/DigitalTwin'

function App() {
  return (
    <Routes>
      <Route path="/" element={<MainLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="pits" element={<PitMonitor />} />
        <Route path="devices" element={<DeviceMonitor />} />
        <Route path="alarms" element={<AlarmCenter />} />
        <Route path="production" element={<ProductionManage />} />
        <Route path="digital-twin" element={<DigitalTwin />} />
      </Route>
    </Routes>
  )
}

export default App
