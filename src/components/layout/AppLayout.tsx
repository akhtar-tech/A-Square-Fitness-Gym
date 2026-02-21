import { useState } from 'react'
import { Layout, Menu, Button, Typography, Avatar, Dropdown } from 'antd'
import {
  DashboardOutlined,
  TeamOutlined,
  DollarOutlined,
  ShoppingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  UserOutlined,
  WhatsAppOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

const { Header, Sider, Content } = Layout
const { Text } = Typography

const menuItems = [
  {
    key: '/dashboard',
    icon: <DashboardOutlined />,
    label: 'Dashboard',
  },
  {
    key: '/clients',
    icon: <TeamOutlined />,
    label: 'Clients',
  },
  {
    key: '/payments',
    icon: <DollarOutlined />,
    label: 'Payments',
  },
  {
    key: '/expenses',
    icon: <ShoppingOutlined />,
    label: 'Expenses',
  },
  /* {
    key: '/import',
    icon: <WhatsAppOutlined style={{ color: '#25D366' }} />,
    label: 'WA Import',
  }, */
]

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const userMenuItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
      danger: true,
      onClick: () => {
        logout()
        navigate('/login')
      },
    },
  ]

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        style={{
          background: '#001529',
          boxShadow: '2px 0 8px rgba(0,0,0,0.15)',
        }}
      >
        {/* Logo */}
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <span style={{ fontSize: 24 }}>🏋️</span>
          {!collapsed && (
            <Text
              style={{
                color: '#fff',
                fontWeight: 700,
                fontSize: 16,
                marginLeft: 10,
              }}
            >
              GymManager
            </Text>
          )}
        </div>

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0, marginTop: 8 }}
        />
      </Sider>

      <Layout>
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
          }}
        >
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{ fontSize: 18, width: 40, height: 40 }}
          />

          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
            >
              <Avatar icon={<UserOutlined />} style={{ background: '#1677ff' }} />
              {user && (
                <Text strong style={{ fontSize: 14 }}>
                  {user.name}
                </Text>
              )}
            </div>
          </Dropdown>
        </Header>

        <Content
          style={{
            margin: '24px',
            minHeight: 280,
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
