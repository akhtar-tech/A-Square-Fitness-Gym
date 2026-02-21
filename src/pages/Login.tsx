import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, Button, Card, Typography, Alert } from 'antd'
import { useAuth } from '@/context/AuthContext'

const { Title, Text } = Typography

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const onFinish = async (values: { email: string; password: string }) => {
    setError('')
    setLoading(true)
    try {
      await login(values.email, values.password)
      navigate('/dashboard')
    } catch (e: unknown) {
      const data = (e as { response?: { data?: unknown } })?.response?.data as
        | { message?: unknown }
        | undefined
      const raw = data?.message ?? 'Login failed. Check your credentials.'
      let msg: string
      if (Array.isArray(raw)) {
        msg = raw.join(', ')
      } else if (typeof raw === 'object' && raw !== null) {
        msg = 'Login failed. Check your credentials.'
      } else {
        msg = String(raw)
      }
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <Card
        style={{
          width: 400,
          borderRadius: 16,
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
        styles={{ body: { padding: 40 } }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🏋️</div>
          <Title level={3} style={{ margin: 0 }}>
            Gym Manager
          </Title>
          <Text type="secondary">Sign in to your account</Text>
        </div>

        {error && (
          <Alert
            message={error}
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Form layout="vertical" onFinish={onFinish} size="large">
          <Form.Item
            label="Email"
            name="email"
            rules={[
              { required: true, message: 'Email is required' },
              { type: 'email', message: 'Enter a valid email' },
            ]}
          >
            <Input placeholder="owner@gym.com" autoComplete="email" />
          </Form.Item>

          <Form.Item
            label="Password"
            name="password"
            rules={[{ required: true, message: 'Password is required' }]}
          >
            <Input.Password placeholder="••••••••" autoComplete="current-password" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              style={{ height: 44 }}
            >
              Sign In
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
