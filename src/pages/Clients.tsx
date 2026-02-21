import { useEffect, useState } from 'react'
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  DatePicker,
  Tag,
  Space,
  Typography,
  Popconfirm,
  message,
  Switch,
  Card,
  Avatar,
  Upload,
  Tooltip,
  Tabs,
  Badge,
  Row,
  Col,
  Image,
  Spin,
  Divider,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
  CameraOutlined,
  EnvironmentOutlined,
  CloseOutlined,
  SaveOutlined,
} from '@ant-design/icons'
import { clientsApi, Client, CreateClientPayload, clientPhotoUrl } from '@/api/clients.api'
import { paymentsApi } from '@/api/payments.api'
import { dayjs } from '@/utils/date'
import { useFilters } from '@/contexts/FilterContext'

const { Title, Text } = Typography
const { Option } = Select

/** Derive the effective expiry date for a client. */
function getExpiry(client: Client): dayjs.Dayjs {
  const last = client.payments?.[0]
  return last?.endDate ? dayjs(last.endDate) : dayjs(client.endDate)
}

// Payments included in the full client (getOne returns up to 10)
type ClientPayment = NonNullable<Client['payments']>[number]

export default function ClientsPage() {
  const { filters } = useFilters()
  const [allClients, setAllClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [activeTab, setActiveTab] = useState<'all' | 'expired' | 'expiring' | 'today'>('all')
  const [form] = Form.useForm()
  const membershipType = Form.useWatch('membershipType', form)

  // Photo state for the modal
  const [photoFilename, setPhotoFilename] = useState<string | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoUploading, setPhotoUploading] = useState(false)

  // ── Edit modal extras ────────────────────────────────────────────────────────
  const [editModalTab, setEditModalTab] = useState<'personal' | 'payment'>('personal')
  const [fullEditingClient, setFullEditingClient] = useState<Client | null>(null)
  const [fetchingClient, setFetchingClient] = useState(false)
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null)
  const [paymentForm] = Form.useForm()
  const [savingPayment, setSavingPayment] = useState(false)

  // ── Payment modal ────────────────────────────────────────────────────────────
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [paymentModalClient, setPaymentModalClient] = useState<Client | null>(null)
  const [paymentModalTab, setPaymentModalTab] = useState<'new' | 'history'>('new')
  const [newPaymentForm] = Form.useForm()
  const [editPaymentForm] = Form.useForm()
  const [clientPayments, setClientPayments] = useState<NonNullable<Client['payments']>>([])
  const [loadingPayments, setLoadingPayments] = useState(false)
  const [editingPaymentInHistory, setEditingPaymentInHistory] = useState<string | null>(null)
  const [savingNewPayment, setSavingNewPayment] = useState(false)

  // ── Pagination state ────────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalRecords, setTotalRecords] = useState(0)
  const [currentTabTotalRecords, setCurrentTabTotalRecords] = useState(0)
  const [expiringTodayTotalRecords, setexpiringTodayTotalRecords] = useState(0)
  const [expiredTotalRecords, setexpiredTotalRecords] = useState(0)
  const [expiringSoonTotalRecords, setexpiringSoonTotalRecords] = useState(0)

  const fetchClients = async () => {
    setLoading(true)
    try {
      const skip = (currentPage - 1) * pageSize
      let condition = 'all'
      if(activeTab === 'expired') {
        condition = 'expired'
      } else if(activeTab === 'expiring') {
        condition = 'expiring_soon'
      } else if(activeTab === 'today') {
        condition = 'expiring_today'
      }
      const res = await clientsApi.list({
        skip,
        take: pageSize,
        search: filters.search || undefined,
        from: condition
      })
      setAllClients(res.data.data)
      setTotalRecords(res.data.total)
      setCurrentTabTotalRecords(res.data.currentTabTotal)
      setexpiringTodayTotalRecords(res.data.expiringTodayTotal)
      setexpiredTotalRecords(res.data.expiredTotal)
      setexpiringSoonTotalRecords(res.data.expiringSoonTotal)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchClients()
  }, [activeTab, pageSize, currentPage, filters.search]) // Refetch when tab, page, page size, or search changes

  // Apply optional date filter on the data returned from backend
  const applyDateFilter = (data: Client[]) => {
    const dateRange = filters.dateRange
    if (!dateRange) return data
    const [from, to] = dateRange
    if (!from && !to) return data
    return data.filter((c) => {
      const exp = getExpiry(c)
      if (from && to) return !exp.isBefore(from, 'day') && !exp.isAfter(to, 'day')
      if (from) return exp.isSame(from, 'day')
      return true
    })
  }

  // Backend already filters by tab and search, so just apply date filter
  const currentData = applyDateFilter(allClients)

  // ── Modal helpers ───────────────────────────────────────────────────────────

  const openAdd = () => {
    setEditingClient(null)
    setFullEditingClient(null)
    form.resetFields()
    form.setFieldsValue({ membershipType: 'monthly', startDate: dayjs() })
    setPhotoFilename(null)
    setPhotoPreview(null)
    setEditModalTab('personal')
    setEditingPaymentId(null)
    setModalOpen(true)
  }

  const openEdit = async (client: Client) => {
    setEditingClient(client)
    setFullEditingClient(null)
    setEditModalTab('personal')
    setEditingPaymentId(null)
    setPhotoFilename(client.photoFilename ?? null)
    setPhotoPreview(clientPhotoUrl(client.photoFilename))
    setModalOpen(true)

    // Fetch the full client record (includes up to 10 payments)
    setFetchingClient(true)
    try {
      const res = await clientsApi.getOne(client.id)
      setFullEditingClient(res.data)
      form.setFieldsValue({
        name: res.data.name,
        phone: res.data.phone,
        email: res.data.email,
        isActive: res.data.isActive,
        notes: res.data.notes ?? undefined,
      })
    } finally {
      setFetchingClient(false)
    }
  }

  const handlePhotoUpload = async (file: File): Promise<false> => {
    setPhotoUploading(true)
    try {
      const res = await clientsApi.uploadPhoto(file)
      setPhotoFilename(res.data.filename)
      setPhotoPreview(URL.createObjectURL(file))
      message.success('Photo uploaded')
    } catch {
      message.error('Photo upload failed')
    } finally {
      setPhotoUploading(false)
    }
    return false
  }

  // Save personal info (edit mode) or create new client (add mode)
  const onSave = async () => {
    const values = await form.validateFields()

    if (editingClient) {
      // ── Edit: only personal-info fields ──
      try {
        await clientsApi.update(editingClient.id, {
          name: values.name,
          phone: values.phone,
          email: values.email || undefined,
          notes: values.notes || undefined,
          photoFilename: photoFilename ?? undefined,
          isActive: values.isActive,
        })
        message.success('Client updated')
        setModalOpen(false)
        fetchClients()
      } catch {
        message.error('Failed to save client')
      }
    } else {
      // ── Add: create new client ──
      const payload: CreateClientPayload = {
        name: values.name,
        phone: values.phone,
        email: values.email || undefined,
        membershipType: values.membershipType,
        initialAmount: values.initialAmount ?? 0,
        initialPaymentMethod: values.initialPaymentMethod || undefined,
        startDate: values.startDate.toISOString(),
        endDate:
          values.membershipType === 'custom' && values.endDate
            ? values.endDate.toISOString()
            : undefined,
        notes: values.notes || undefined,
        photoFilename: photoFilename ?? undefined,
      }
      try {
        await clientsApi.create(payload)
        message.success('Client added')
        setModalOpen(false)
        fetchClients()
      } catch {
        message.error('Failed to save client')
      }
    }
  }

  // Save the payment that's currently being edited in the Payment tab
  const onSavePayment = async () => {
    if (!editingPaymentId) return
    const values = await paymentForm.validateFields()
    setSavingPayment(true)
    try {
      await paymentsApi.update(editingPaymentId, {
        amount: values.amount,
        method: values.method || undefined,
        note: values.note || undefined,
        paidAt: values.paidAt ? (values.paidAt as dayjs.Dayjs).toISOString() : undefined,
      })
      message.success('Payment updated')
      setEditingPaymentId(null)
      // Refresh full client so the payment list reflects the change
      if (editingClient) {
        const res = await clientsApi.getOne(editingClient.id)
        setFullEditingClient(res.data)
      }
      fetchClients()
    } catch {
      message.error('Failed to update payment')
    } finally {
      setSavingPayment(false)
    }
  }

  const onDelete = async (id: string) => {
    try {
      await clientsApi.delete(id)
      message.success('Client removed')
      fetchClients()
    } catch {
      message.error('Failed to delete')
    }
  }

  // ── Payment modal handlers ──────────────────────────────────────────────────

  const openPaymentModal = async (client: Client) => {
    setPaymentModalClient(client)
    setPaymentModalTab('new')
    setEditingPaymentInHistory(null)
    newPaymentForm.resetFields()
    newPaymentForm.setFieldsValue({
      paidAt: dayjs(),
      method: 'CASH',
      extendMembership: 'monthly',
    })
    setPaymentModalOpen(true)

    // Fetch payment history
    setLoadingPayments(true)
    try {
      const res = await paymentsApi.list({ clientId: client.id })
      setClientPayments(res.data.data)
    } catch {
      message.error('Failed to load payment history')
    } finally {
      setLoadingPayments(false)
    }
  }

  const closePaymentModal = () => {
    setPaymentModalOpen(false)
    setPaymentModalClient(null)
    setClientPayments([])
    setEditingPaymentInHistory(null)
  }

  const onCreatePayment = async () => {
    if (!paymentModalClient) return
    const values = await newPaymentForm.validateFields()
    setSavingNewPayment(true)
    try {
      await paymentsApi.create({
        clientId: paymentModalClient.id,
        amount: values.amount,
        method: values.method || 'CASH',
        paidAt: values.paidAt ? values.paidAt.toISOString() : undefined,
        extendMembership: values.extendMembership || 'none',
        newEndDate:
          values.extendMembership === 'custom' && values.newEndDate
            ? values.newEndDate.toISOString()
            : undefined,
        note: values.note || undefined,
      })
      message.success('Payment added successfully')
      newPaymentForm.resetFields()
      newPaymentForm.setFieldsValue({
        paidAt: dayjs(),
        method: 'CASH',
        extendMembership: 'monthly',
      })

      // Refresh payment history
      const res = await paymentsApi.list({ clientId: paymentModalClient.id })
      setClientPayments(res.data.data)

      // Refresh clients list
      fetchClients()

      // Switch to history tab to see the new payment
      setPaymentModalTab('history')
    } catch {
      message.error('Failed to add payment')
    } finally {
      setSavingNewPayment(false)
    }
  }

  const onUpdatePayment = async (paymentId: string) => {
    const values = await editPaymentForm.validateFields()
    try {
      await paymentsApi.update(paymentId, {
        amount: values.amount,
        method: values.method || undefined,
        note: values.note || undefined,
        paidAt: values.paidAt ? values.paidAt.toISOString() : undefined,
      })
      message.success('Payment updated successfully')
      setEditingPaymentInHistory(null)

      // Refresh payment history
      if (paymentModalClient) {
        const res = await paymentsApi.list({ clientId: paymentModalClient.id })
        setClientPayments(res.data.data)
      }

      // Refresh clients list
      fetchClients()
    } catch {
      message.error('Failed to update payment')
    }
  }

  const onDeletePayment = async (paymentId: string) => {
    try {
      await paymentsApi.delete(paymentId)
      message.success('Payment deleted successfully')

      // Refresh payment history
      if (paymentModalClient) {
        const res = await paymentsApi.list({ clientId: paymentModalClient.id })
        setClientPayments(res.data.data)
      }

      // Refresh clients list
      fetchClients()
    } catch {
      message.error('Failed to delete payment')
    }
  }

  // ── Table columns ───────────────────────────────────────────────────────────

  const columns = [
    {
      title: '',
      key: 'photo',
      width: 52,
      render: (_: unknown, r: Client) => {
        const url = clientPhotoUrl(r.photoFilename)
        return url ? (
          <Image
            src={url}
            width={38}
            height={38}
            style={{ objectFit: 'cover', borderRadius: 6, cursor: 'zoom-in' }}
            preview={{
              mask: <span style={{ fontSize: 11 }}>View</span>,
            }}
          />
        ) : (
          <Avatar
            icon={<UserOutlined />}
            size={38}
            shape="square"
            style={{ background: '#d9d9d9' }}
          />
        )
      },
    },
    {
      title: 'Entry #',
      key: 'entryNumber',
      width: 100,
      defaultSortOrder: 'descend' as const,
      sorter: (a: Client, b: Client) => {
        const n = (c: Client) =>
          c.entryNumber ? Number(c.entryNumber.replace(/\D/g, '')) : -1
        return n(a) - n(b)
      },
      render: (_: unknown, r: Client) =>
        r.entryNumber ? (
          <Tag color="blue">{r.entryNumber}</Tag>
        ) : (
          <span style={{ color: '#bbb' }}>—</span>
        ),
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a: Client, b: Client) => a.name.localeCompare(b.name),
      render: (v: string) => <strong>{v}</strong>,
    },
    { title: 'Phone', dataIndex: 'phone', key: 'phone' },
    {
      title: 'Address',
      dataIndex: 'notes',
      key: 'notes',
      ellipsis: true,
      render: (v: string | null) =>
        v ? (
          <Tooltip title={v}>
            <span style={{ color: '#555' }}>
              <EnvironmentOutlined style={{ marginRight: 4, color: '#999' }} />
              {v}
            </span>
          </Tooltip>
        ) : (
          <span style={{ color: '#bbb' }}>—</span>
        ),
    },
    {
      title: 'Last Paid',
      key: 'lastPaid',
      sorter: (a: Client, b: Client) => {
        const da = a.payments?.[0]?.paidAt ?? ''
        const db = b.payments?.[0]?.paidAt ?? ''
        return da < db ? -1 : da > db ? 1 : 0
      },
      render: (_: unknown, r: Client) => {
        const last = r.payments?.[0]
        if (!last) return <span style={{ color: '#bbb' }}>—</span>
        return (
          <span>
            <strong>₹{Number(last.amount).toLocaleString()}</strong>
            {' · '}
            <Tag color="blue" style={{ fontSize: 11 }}>
              {r.membershipType}
            </Tag>
            <br />
            <span style={{ fontSize: 11, color: '#999' }}>
              {dayjs(last.paidAt).format('DD MMM YY')} · {last.method}
            </span>
          </span>
        )
      },
    },
    {
      title: 'Expires',
      key: 'expires',
      sorter: (a: Client, b: Client) => {
        return getExpiry(a).unix() - getExpiry(b).unix()
      },
      render: (_: unknown, r: Client) => {
        const expiry = getExpiry(r)
        const expired = expiry.isBefore(dayjs())
        const expiringSoon = !expired && !expiry.isAfter(dayjs().add(7, 'day'))
        const color = expired ? 'red' : expiringSoon ? 'orange' : 'green'
        return <Tag color={color}>{expiry.format('DD MMM YYYY')}</Tag>
      },
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (v: boolean) => (
        <Tag color={v ? 'green' : 'default'}>{v ? 'Active' : 'Inactive'}</Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, record: Client) => (
        <Space>
          <Tooltip title="Make Payment">
            <Button
              icon={<span style={{ fontSize: 14 }}>₹</span>}
              size="small"
              type="primary"
              onClick={() => openPaymentModal(record)}
            />
          </Tooltip>
          <Tooltip title="Edit Client">
            <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(record)} />
          </Tooltip>
          <Popconfirm
            title="Delete this client?"
            onConfirm={() => onDelete(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button icon={<DeleteOutlined />} size="small" danger />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  // ── Tab labels with badge counts ────────────────────────────────────────────

  const tabItems = [
    {
      key: 'all',
      label: (
        <span>
          All&nbsp;
          <Badge count={totalRecords} showZero style={{ backgroundColor: '#1677ff' }} />
        </span>
      ),
    },
    {
      key: 'today',
      label: (
        <span>
          Expires Today&nbsp;
          <Badge
            count={expiringTodayTotalRecords}
            showZero
            style={{ backgroundColor: expiringTodayTotalRecords > 0 ? '#ff4d4f' : '#d9d9d9' }}
          />
        </span>
      ),
    },
    {
      key: 'expiring',
      label: (
        <span>
          Expiring Soon&nbsp;
          <Badge
            count={expiringSoonTotalRecords}
            showZero
            style={{ backgroundColor: expiringSoonTotalRecords > 0 ? '#fa8c16' : '#d9d9d9' }}
          />
        </span>
      ),
    },
    {
      key: 'expired',
      label: (
        <span>
          Expired&nbsp;
          <Badge
            count={expiredTotalRecords}
            showZero
            style={{ backgroundColor: expiredTotalRecords > 0 ? '#595959' : '#d9d9d9' }}
          />
        </span>
      ),
    },
  ]

  // ── Payment list row (used in the edit modal's Payment tab) ─────────────────

  const PaymentRow = ({ payment, isLatest }: { payment: ClientPayment; isLatest: boolean }) => {
    const isEditing = editingPaymentId === payment.id

    if (isEditing) {
      return (
        <div
          style={{
            border: '1px solid #1677ff',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 8,
            background: '#e6f4ff',
          }}
        >
          <Form form={paymentForm} layout="vertical" size="small">
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item
                  name="amount"
                  label="Amount (₹)"
                  rules={[{ required: true, message: 'Required' }]}
                >
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="method" label="Method">
                  <Select>
                    <Option value="CASH">Cash</Option>
                    <Option value="UPI">UPI</Option>
                    <Option value="CARD">Card</Option>
                    <Option value="BANK_TRANSFER">Bank Transfer</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="paidAt" label="Payment Date">
                  <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="note" label="Note">
                  <Input placeholder="Optional note" />
                </Form.Item>
              </Col>
            </Row>
          </Form>
          <Space>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              size="small"
              loading={savingPayment}
              onClick={onSavePayment}
            >
              Save
            </Button>
            <Button
              icon={<CloseOutlined />}
              size="small"
              onClick={() => setEditingPaymentId(null)}
            >
              Cancel
            </Button>
          </Space>
        </div>
      )
    }

    return (
      <div
        style={{
          border: `1px solid ${isLatest ? '#b7eb8f' : '#f0f0f0'}`,
          borderRadius: 8,
          padding: '10px 14px',
          marginBottom: 8,
          background: isLatest ? '#f6ffed' : '#fafafa',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <div>
          <Space size={6}>
            <Text strong>₹{Number(payment.amount).toLocaleString()}</Text>
            <Tag style={{ fontSize: 11 }}>{payment.method}</Tag>
            {payment.membershipType && (
              <Tag color="blue" style={{ fontSize: 11 }}>
                {payment.membershipType}
              </Tag>
            )}
            {isLatest && (
              <Tag color="green" style={{ fontSize: 10 }}>
                Latest
              </Tag>
            )}
          </Space>
          <div style={{ marginTop: 4 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {dayjs(payment.paidAt).format('DD MMM YYYY')}
              {payment.note && ` · ${payment.note}`}
            </Text>
            {payment.endDate && (
              <Text style={{ fontSize: 12, color: '#52c41a', marginLeft: 8 }}>
                Expires: {dayjs(payment.endDate).format('DD MMM YYYY')}
              </Text>
            )}
          </div>
        </div>

        {isLatest && (
          <Button
            icon={<EditOutlined />}
            size="small"
            onClick={() => {
              setEditingPaymentId(payment.id)
              paymentForm.setFieldsValue({
                amount: Number(payment.amount),
                method: payment.method,
                note: payment.note ?? '',
                paidAt: dayjs(payment.paidAt),
              })
            }}
          >
            Edit
          </Button>
        )}
      </div>
    )
  }

  // ── Photo upload widget (shared between add and edit) ────────────────────────

  const PhotoWidget = () => (
    <div style={{ textAlign: 'center', marginBottom: 16 }}>
      <Upload
        accept="image/*"
        showUploadList={false}
        beforeUpload={handlePhotoUpload}
        disabled={photoUploading}
      >
        <Tooltip title="Click to upload / change photo">
          {photoPreview ? (
            <div style={{ position: 'relative', display: 'inline-block', cursor: 'pointer' }}>
              <img
                src={photoPreview}
                alt="Client"
                style={{
                  width: 90,
                  height: 90,
                  objectFit: 'cover',
                  borderRadius: 8,
                  border: '1px solid #e8e8e8',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  background: 'rgba(0,0,0,0.5)',
                  borderRadius: '0 0 8px 0',
                  padding: '2px 4px',
                }}
              >
                <CameraOutlined style={{ color: '#fff', fontSize: 14 }} />
              </div>
            </div>
          ) : (
            <Avatar
              icon={<CameraOutlined />}
              size={90}
              shape="square"
              style={{ background: '#f0f0f0', color: '#999', cursor: 'pointer', fontSize: 24 }}
            />
          )}
        </Tooltip>
      </Upload>
      <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
        {photoUploading ? 'Uploading...' : 'Click photo to upload (optional)'}
      </div>
    </div>
  )

  // ── Modal content ────────────────────────────────────────────────────────────

  // For the ADD modal, use the original single-form layout
  const addModalContent = (
    <>
      <PhotoWidget />
      <Form form={form} layout="vertical">
        {/* Row 1: Name + Phone */}
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="name" label="Full Name" rules={[{ required: true }]}>
              <Input placeholder="Akhtar Siddiqui" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="phone" label="Phone" rules={[{ required: true }]}>
              <Input placeholder="9205107975" />
            </Form.Item>
          </Col>
        </Row>

        {/* Row 2: Membership Plan + Fee Paid */}
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item
              name="membershipType"
              label="Membership Plan"
              rules={[{ required: true }]}
            >
              <Select>
                <Option value="monthly">Monthly</Option>
                <Option value="quarterly">Quarterly (3 months)</Option>
                <Option value="yearly">Yearly (12 months)</Option>
                <Option value="custom">Custom</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="initialAmount"
              label="Fee Paid (₹)"
              rules={[{ required: true, message: 'Enter fee amount' }]}
            >
              <InputNumber min={0} style={{ width: '100%' }} placeholder="e.g. 1200" />
            </Form.Item>
          </Col>
        </Row>

        {/* Row 3: Payment Method + Start Date */}
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="initialPaymentMethod" label="Payment Method">
              <Select defaultValue="CASH">
                <Option value="CASH">Cash</Option>
                <Option value="UPI">UPI</Option>
                <Option value="CARD">Card</Option>
                <Option value="BANK_TRANSFER">Bank Transfer</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="startDate" label="Start Date (= Payment Date)" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        {membershipType === 'custom' && (
          <Form.Item
            name="endDate"
            label="End Date"
            rules={[{ required: true, message: 'End date required for custom plan' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        )}

        <Form.Item name="notes" label="Address / Notes (optional)">
          <Input.TextArea rows={2} placeholder="e.g. Y-block Mangol Puri" />
        </Form.Item>
      </Form>
    </>
  )

  // For the EDIT modal, use a two-tab layout
  const personalInfoTab = fetchingClient ? (
    <div style={{ textAlign: 'center', padding: 32 }}>
      <Spin tip="Loading client data..." />
    </div>
  ) : (
    <>
      <PhotoWidget />
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="Full Name" rules={[{ required: true }]}>
          <Input placeholder="John Doe" />
        </Form.Item>

        <Form.Item name="phone" label="Phone" rules={[{ required: true }]}>
          <Input placeholder="9876543210" />
        </Form.Item>

        <Form.Item name="notes" label="Address / Notes (optional)">
          <Input.TextArea rows={2} placeholder="e.g. Y-block Mangol Puri" />
        </Form.Item>

        <Form.Item name="isActive" label="Active" valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
    </>
  )

  const payments = fullEditingClient?.payments ?? []

  const paymentInfoTab = fetchingClient ? (
    <div style={{ textAlign: 'center', padding: 32 }}>
      <Spin tip="Loading payments..." />
    </div>
  ) : (
    <div>
      {payments.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#999', padding: 24 }}>
          No payment records found.
        </div>
      ) : (
        <>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 10 }}>
            Showing last {payments.length} payment{payments.length > 1 ? 's' : ''}. Only the
            latest payment can be edited.
          </Text>
          {payments.map((p, i) => (
            <PaymentRow key={p.id} payment={p} isLatest={i === 0} />
          ))}
        </>
      )}
    </div>
  )

  const editModalTabItems = [
    {
      key: 'personal',
      label: 'Personal Info',
      children: personalInfoTab,
    },
    {
      key: 'payment',
      label: 'Payment Info',
      children: paymentInfoTab,
    },
  ]

  // Footer varies based on add vs edit and which tab is active
  const modalFooter = editingClient
    ? editModalTab === 'personal'
      ? [
          <Button key="cancel" onClick={() => setModalOpen(false)}>
            Cancel
          </Button>,
          <Button key="save" type="primary" icon={<SaveOutlined />} onClick={onSave}>
            Save Personal Info
          </Button>,
        ]
      : [
          <Button key="close" onClick={() => setModalOpen(false)}>
            Close
          </Button>,
        ]
    : [
        <Button key="cancel" onClick={() => setModalOpen(false)}>
          Cancel
        </Button>,
        <Button key="save" type="primary" icon={<SaveOutlined />} onClick={onSave}>
          Add Client
        </Button>,
      ]

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <Title level={4} style={{ margin: 0 }}>
          Clients
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
          Add Client
        </Button>
      </div>

      <Card bordered={false}>
        <Tabs
          activeKey={activeTab}
          onChange={(k) => {
            setActiveTab(k as 'all' | 'expired' | 'expiring' | 'today')
            setCurrentPage(1) // Reset to first page when changing tabs
          }}
          items={tabItems}
          style={{ marginBottom: 0 }}
        />

        <Table
          dataSource={currentData}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: currentTabTotalRecords,
            showSizeChanger: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} clients`,
            pageSizeOptions: ['10', '25', '50', '100'],
            onChange: (page, newPageSize) => {
              if (newPageSize !== pageSize) {
                setPageSize(newPageSize)
                setCurrentPage(1)
              } else {
                setCurrentPage(page)
              }
            },
          }}
          scroll={{ x: 1000 }}
        />
      </Card>

      {/* ── Add / Edit Modal ──────────────────────────────────────────────── */}
      <Modal
        title={editingClient ? `Edit Client — ${editingClient.name}` : 'Add Client'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={modalFooter}
        width={580}
        destroyOnClose
      >
        {editingClient ? (
          <>
            <Divider style={{ margin: '0 0 4px' }} />
            <Tabs
              activeKey={editModalTab}
              onChange={(k) => {
                setEditModalTab(k as 'personal' | 'payment')
                setEditingPaymentId(null)
              }}
              items={editModalTabItems}
            />
          </>
        ) : (
          addModalContent
        )}
      </Modal>

      {/* ── Payment Modal ──────────────────────────────────────────────── */}
      <Modal
        title={
          paymentModalClient
            ? `Payments - ${paymentModalClient.name} (${paymentModalClient.entryNumber || 'N/A'})`
            : 'Payments'
        }
        open={paymentModalOpen}
        onCancel={closePaymentModal}
        footer={null}
        width={700}
        destroyOnClose
      >
        <Divider style={{ margin: '0 0 16px' }} />
        <Tabs
          activeKey={paymentModalTab}
          onChange={(k) => {
            setPaymentModalTab(k as 'new' | 'history')
            setEditingPaymentInHistory(null)
          }}
          items={[
            {
              key: 'new',
              label: 'New Payment',
              children: (
                <Form form={newPaymentForm} layout="vertical" onFinish={onCreatePayment}>
                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item
                        name="amount"
                        label="Amount (₹)"
                        rules={[{ required: true, message: 'Amount is required' }]}
                      >
                        <InputNumber
                          min={0}
                          style={{ width: '100%' }}
                          placeholder="e.g. 1200"
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="method" label="Payment Method">
                        <Select>
                          <Option value="CASH">Cash</Option>
                          <Option value="UPI">UPI</Option>
                          <Option value="CARD">Card</Option>
                          <Option value="BANK_TRANSFER">Bank Transfer</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item name="paidAt" label="Payment Date">
                        <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="extendMembership" label="Extend Membership">
                        <Select>
                          <Option value="none">No Extension</Option>
                          <Option value="monthly">Monthly (1 month)</Option>
                          <Option value="quarterly">Quarterly (3 months)</Option>
                          <Option value="yearly">Yearly (12 months)</Option>
                          <Option value="custom">Custom</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>

                  {Form.useWatch('extendMembership', newPaymentForm) === 'custom' && (
                    <Form.Item
                      name="newEndDate"
                      label="New End Date"
                      rules={[
                        { required: true, message: 'End date required for custom extension' },
                      ]}
                    >
                      <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
                    </Form.Item>
                  )}

                  <Form.Item name="note" label="Note (optional)">
                    <Input.TextArea rows={2} placeholder="e.g. Received via UPI" />
                  </Form.Item>

                  <Form.Item>
                    <Space>
                      <Button type="primary" htmlType="submit" loading={savingNewPayment}>
                        Save Payment
                      </Button>
                      <Button onClick={closePaymentModal}>Cancel</Button>
                    </Space>
                  </Form.Item>
                </Form>
              ),
            },
            {
              key: 'history',
              label: `Payment History (${clientPayments?.length || 0})`,
              children: loadingPayments ? (
                <div style={{ textAlign: 'center', padding: 32 }}>
                  <Spin tip="Loading payment history..." />
                </div>
              ) : !clientPayments || clientPayments.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#999', padding: 24 }}>
                  No payment records found.
                </div>
              ) : (
                <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                  {clientPayments.map((payment) => {
                    const isEditing = editingPaymentInHistory === payment.id
                    return isEditing ? (
                      <div
                        key={payment.id}
                        style={{
                          border: '1px solid #1677ff',
                          borderRadius: 8,
                          padding: 12,
                          marginBottom: 8,
                          background: '#e6f4ff',
                        }}
                      >
                        <Form
                          form={editPaymentForm}
                          layout="vertical"
                          size="small"
                          onFinish={() => onUpdatePayment(payment.id)}
                        >
                          <Row gutter={12}>
                            <Col span={12}>
                              <Form.Item
                                name="amount"
                                label="Amount (₹)"
                                rules={[{ required: true }]}
                              >
                                <InputNumber min={0} style={{ width: '100%' }} />
                              </Form.Item>
                            </Col>
                            <Col span={12}>
                              <Form.Item name="method" label="Method">
                                <Select>
                                  <Option value="CASH">Cash</Option>
                                  <Option value="UPI">UPI</Option>
                                  <Option value="CARD">Card</Option>
                                  <Option value="BANK_TRANSFER">Bank Transfer</Option>
                                </Select>
                              </Form.Item>
                            </Col>
                          </Row>
                          <Row gutter={12}>
                            <Col span={12}>
                              <Form.Item name="paidAt" label="Payment Date">
                                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
                              </Form.Item>
                            </Col>
                            <Col span={12}>
                              <Form.Item name="note" label="Note">
                                <Input placeholder="Optional note" />
                              </Form.Item>
                            </Col>
                          </Row>
                          <Space>
                            <Button type="primary" size="small" htmlType="submit">
                              Save
                            </Button>
                            <Button size="small" onClick={() => setEditingPaymentInHistory(null)}>
                              Cancel
                            </Button>
                          </Space>
                        </Form>
                      </div>
                    ) : (
                      <div
                        key={payment.id}
                        style={{
                          border: '1px solid #f0f0f0',
                          borderRadius: 8,
                          padding: 12,
                          marginBottom: 8,
                          background: '#fafafa',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                        }}
                      >
                        <div>
                          <Space size={6}>
                            <Text strong>₹{Number(payment.amount).toLocaleString()}</Text>
                            <Tag style={{ fontSize: 11 }}>{payment.method}</Tag>
                            {payment.membershipType && (
                              <Tag color="blue" style={{ fontSize: 11 }}>
                                {payment.membershipType}
                              </Tag>
                            )}
                          </Space>
                          <div style={{ marginTop: 4 }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {dayjs(payment.paidAt).format('DD MMM YYYY')}
                              {payment.note && ` · ${payment.note}`}
                            </Text>
                            {payment.endDate && (
                              <Text style={{ fontSize: 12, color: '#52c41a', marginLeft: 8 }}>
                                Expires: {dayjs(payment.endDate).format('DD MMM YYYY')}
                              </Text>
                            )}
                          </div>
                        </div>
                        <Space>
                          <Button
                            icon={<EditOutlined />}
                            size="small"
                            onClick={() => {
                              setEditingPaymentInHistory(payment.id)
                              editPaymentForm.setFieldsValue({
                                amount: Number(payment.amount),
                                method: payment.method,
                                note: payment.note ?? '',
                                paidAt: dayjs(payment.paidAt),
                              })
                            }}
                          >
                            Edit
                          </Button>
                          <Popconfirm
                            title="Delete this payment?"
                            onConfirm={() => onDeletePayment(payment.id)}
                            okText="Yes"
                            cancelText="No"
                          >
                            <Button icon={<DeleteOutlined />} size="small" danger>
                              Delete
                            </Button>
                          </Popconfirm>
                        </Space>
                      </div>
                    )
                  })}
                </div>
              ),
            },
          ]}
        />
      </Modal>
    </div>
  )
}
