import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, Badge, Avatar, Dropdown, Space, Typography } from 'antd'
import {
  DashboardOutlined,
  ExperimentOutlined,
  SettingOutlined,
  AlertOutlined,
  BarChartOutlined,
  AppstoreOutlined,
  BellOutlined,
  UserOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons'
import { useStore } from '@/store'
import GlobalSimulationRunner from '@/components/GlobalSimulationRunner'

const { Header, Sider, Content } = Layout
const { Text } = Typography

const menuItems = [
  {
    key: '/dashboard',
    icon: <DashboardOutlined />,
    label: '综合监控',
  },
  {
    key: '/pits',
    icon: <ExperimentOutlined />,
    label: '窖池监控',
  },
  {
    key: '/devices',
    icon: <SettingOutlined />,
    label: '设备管理',
  },
  {
    key: '/alarms',
    icon: <AlertOutlined />,
    label: '告警中心',
  },
  {
    key: '/production',
    icon: <BarChartOutlined />,
    label: '生产管理',
  },
  {
    key: '/digital-twin',
    icon: <AppstoreOutlined />,
    label: '数字孪生',
  },
]

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { activeAlarms } = useStore()

  const userMenuItems = [
    { key: 'profile', label: '个人中心' },
    { key: 'settings', label: '系统设置' },
    { type: 'divider' as const },
    { key: 'logout', label: '退出登录' },
  ]

  return (
    <Layout style={{ minHeight: '100vh', background: 'transparent' }}>
      <Sider 
        trigger={null} 
        collapsible 
        collapsed={collapsed}
        className="glass-shell"
        style={{
          background: 'var(--bg-panel)',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div 
          style={{ 
            height: 64, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          <Text strong style={{ fontSize: collapsed ? 16 : 18, color: 'var(--accent-blue)' }}>
            {collapsed ? '🍺' : '🍺 酿酒数字孪生'}
          </Text>
        </div>
        
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ background: 'transparent', borderRight: 0 }}
        />
      </Sider>
      
      <Layout style={{ background: 'transparent' }}>
        <Header 
          className="glass-shell"
          style={{ 
            padding: '0 24px', 
            background: 'var(--bg-panel)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {collapsed ? (
              <MenuUnfoldOutlined 
                onClick={() => setCollapsed(false)}
                style={{ fontSize: 18, cursor: 'pointer' }}
              />
            ) : (
              <MenuFoldOutlined 
                onClick={() => setCollapsed(true)}
                style={{ fontSize: 18, cursor: 'pointer' }}
              />
            )}
          </div>
          
          <Space size="large">
            <Badge count={activeAlarms} overflowCount={99}>
              <BellOutlined 
                style={{ fontSize: 18, cursor: 'pointer' }}
                onClick={() => navigate('/alarms')}
              />
            </Badge>
            
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Space style={{ cursor: 'pointer' }}>
                <Avatar icon={<UserOutlined />} />
                <Text>管理员</Text>
              </Space>
            </Dropdown>
          </Space>
        </Header>
        
        <Content 
          className="glass-shell"
          style={{ 
            margin: 16, 
            padding: 16, 
            background: 'var(--bg-panel)',
            borderRadius: 16,
            overflow: 'auto',
          }}
        >
          <GlobalSimulationRunner />
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
