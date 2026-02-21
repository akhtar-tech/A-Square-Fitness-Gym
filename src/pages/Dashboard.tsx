import { useEffect, useState, useMemo } from 'react'
import {
  Row,
  Col,
  Card,
  Statistic,
  Typography,
  Table,
  Tag,
  Spin,
  Alert,
} from 'antd'
import {
  TeamOutlined,
  DollarOutlined,
  RiseOutlined,
  WarningOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'
import { dashboardApi, DashboardStats, TrendPoint } from '@/api/dashboard.api'
import { clientsApi } from '@/api/clients.api'
import { dayjs } from '@/utils/date'
import { logError } from '@/utils/errorHandler'

const { Title } = Typography

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [trend, setTrend] = useState<TrendPoint[]>([])
  const [expiring, setExpiring] = useState<
    { id: string; name: string; phone: string; endDate: string; membershipType: string }[]
  >([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const [statsRes, trendRes, expiringRes] = await Promise.all([
          dashboardApi.stats(),
          dashboardApi.trend(6),
          clientsApi.expiringSoon(),
        ])
        setStats(statsRes.data)
        setTrend(trendRes.data)
        setExpiring(expiringRes.data)
      } catch (err) {
        logError('Dashboard load', err)
        setError('Failed to load dashboard data.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const kpiCards = useMemo(
    () => [
      {
        title: 'Active Members',
        value: stats?.clients.active ?? 0,
        icon: <TeamOutlined style={{ color: '#1677ff' }} />,
        color: '#e6f4ff',
      },
      {
        title: 'Revenue This Month',
        value: stats?.revenue.thisMonth ?? 0,
        prefix: '₹',
        icon: <DollarOutlined style={{ color: '#52c41a' }} />,
        color: '#f6ffed',
      },
      {
        title: 'Profit This Month',
        value: stats?.profit.thisMonth ?? 0,
        prefix: '₹',
        icon: <RiseOutlined style={{ color: '#722ed1' }} />,
        color: '#f9f0ff',
      },
      {
        title: 'Expires Today',
        value: stats?.clients.expiresToday ?? 0,
        icon: <ClockCircleOutlined style={{ color: '#ff4d4f' }} />,
        color: '#fff1f0',
      },
      {
        title: 'Expiring in 7 Days',
        value: stats?.clients.expiringSoon ?? 0,
        icon: <WarningOutlined style={{ color: '#fa8c16' }} />,
        color: '#fff7e6',
      },
    ],
    [stats],
  )

  const trendColumns = useMemo(
    () => [
      {
        title: 'Month',
        dataIndex: 'month',
        key: 'month',
        render: (v: string) => dayjs(v).format('MMM YYYY'),
      },
      {
        title: 'Revenue',
        dataIndex: 'revenue',
        key: 'revenue',
        render: (v: number) => `₹${v.toLocaleString()}`,
      },
      {
        title: 'Expenses',
        dataIndex: 'expenses',
        key: 'expenses',
        render: (v: number) => `₹${v.toLocaleString()}`,
      },
      {
        title: 'Profit',
        key: 'profit',
        render: (_: unknown, row: TrendPoint) => {
          const profit = row.revenue - row.expenses
          return (
            <Tag color={profit >= 0 ? 'green' : 'red'}>
              ₹{profit.toLocaleString()}
            </Tag>
          )
        },
      },
      {
        title: 'New Clients',
        dataIndex: 'newClients',
        key: 'newClients',
      },
    ],
    [],
  )

  const expiringColumns = useMemo(
    () => [
      { title: 'Name', dataIndex: 'name', key: 'name' },
      { title: 'Phone', dataIndex: 'phone', key: 'phone' },
      {
        title: 'Expires',
        dataIndex: 'endDate',
        key: 'endDate',
        render: (v: string) => (
          <Tag color="orange">{dayjs(v).format('DD MMM YYYY')}</Tag>
        ),
      },
      {
        title: 'Plan',
        dataIndex: 'membershipType',
        key: 'membershipType',
        render: (v: string) => <Tag>{v}</Tag>,
      },
    ],
    [],
  )

  if (loading) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 80 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (error) {
    return <Alert type="error" message={error} />
  }

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>
        Dashboard
      </Title>

      {/* KPI Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {kpiCards.map((card) => (
          <Col xs={24} sm={12} lg={6} key={card.title}>
            <Card style={{ background: card.color, border: 'none' }}>
              <Statistic
                title={card.title}
                value={card.value}
                prefix={card.prefix}
                valueStyle={{ fontWeight: 700, fontSize: 28 }}
                suffix={card.icon}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        {/* Monthly Trend */}
        <Col xs={24} lg={14}>
          <Card title="6-Month Trend" bordered={false}>
            <Table
              dataSource={trend}
              columns={trendColumns}
              rowKey="month"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>

        {/* Expiring Soon */}
        <Col xs={24} lg={10}>
          <Card
            title={
              <span>
                <WarningOutlined style={{ color: '#fa8c16', marginRight: 8 }} />
                Expiring Soon
              </span>
            }
            bordered={false}
          >
            {expiring.length === 0 ? (
              <p style={{ color: '#999', textAlign: 'center', padding: '20px 0' }}>
                No memberships expiring in the next 7 days
              </p>
            ) : (
              <Table
                dataSource={expiring}
                columns={expiringColumns}
                rowKey="id"
                pagination={false}
                size="small"
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}
