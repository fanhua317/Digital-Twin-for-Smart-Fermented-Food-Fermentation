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
    <Layout style={{ minHeight: '100vh' }}>
      <Sider 
        trigger={null} 
        collapsible 
        collapsed={collapsed}
        style={{
          background: '#1f1f1f',
          borderRight: '1px solid #303030',
        }}
      >
        <div 
          style={{ 
            height: 64, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            borderBottom: '1px solid #303030',
          }}
        >
          <Text strong style={{ fontSize: collapsed ? 16 : 18, color: '#1890ff' }}>
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
      
      <Layout>
        <Header 
          style={{ 
            padding: '0 24px', 
            background: '#1f1f1f',
            borderBottom: '1px solid #303030',
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
          style={{ 
            margin: 16, 
            padding: 16, 
            background: '#141414',
            borderRadius: 8,
            overflow: 'auto',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
