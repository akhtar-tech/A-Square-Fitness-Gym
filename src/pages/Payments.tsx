import { useEffect, useState, useMemo } from 'react'
import {
  Table,
  Button,
  Modal,
  Form,
  Select,
  InputNumber,
  DatePicker,
  Tag,
  Typography,
  Popconfirm,
  message,
  Card,
  Space,
  Input,
  Alert,
  Tabs,
  Badge,
  Tooltip,
  Avatar,
  Image,
  Row,
  Col,
} from 'antd'
import {
  PlusOutlined,
  DeleteOutlined,
  CheckOutlined,
  CloseOutlined,
  ClockCircleOutlined,
  SearchOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { paymentsApi, Payment, CreatePaymentPayload } from '@/api/payments.api'
import { clientsApi, Client, clientPhotoUrl } from '@/api/clients.api'
import { importApi, ImportedClient } from '@/api/import.api'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { Option } = Select

export default function PaymentsPage() {
  const [activeTab, setActiveTab] = useState<'history' | 'pending'>('history')

  // ── Payment history state ────────────────────────────────────────────────
  const [payments, setPayments] = useState<Payment[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [addForm] = Form.useForm()
  const extendMembership = Form.useWatch('extendMembership', addForm)
  const selectedClientId = Form.useWatch('clientId', addForm)
  const selectedClient = clients.find(c => c.id === selectedClientId) ?? null

  // ── History search + date filter state ───────────────────────────────────
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null])

  // ── Pending search + date filter state ───────────────────────────────────
  const [pendingSearch, setPendingSearch] = useState('')
  const [pendingDateFilter, setPendingDateFilter] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null])

  // ── Pending imports state ────────────────────────────────────────────────
  const [pending, setPending] = useState<ImportedClient[]>([])
  const [pendingLoading, setPendingLoading] = useState(false)
  const [resolveModal, setResolveModal] = useState<{ open: boolean; record: ImportedClient | null }>({
    open: false,
    record: null,
  })
  const [resolving, setResolving] = useState(false)
  const [resolveForm] = Form.useForm()
  const resolveClientId = Form.useWatch('clientId', resolveForm)
  const resolveClient = clients.find(c => c.id === resolveClientId) ?? null

  // ── Fetch helpers ────────────────────────────────────────────────────────
  const fetchPayments = async () => {
    setHistoryLoading(true)
    try {
      const res = await paymentsApi.list()
      setPayments(res.data)
    } finally {
      setHistoryLoading(false)
    }
  }

  const fetchPending = async () => {
    setPendingLoading(true)
    try {
      const res = await importApi.pending()
      setPending(res.data)
    } finally {
      setPendingLoading(false)
    }
  }

  useEffect(() => {
    fetchPayments()
    clientsApi.list().then(r => setClients(r.data))
    fetchPending()
  }, [])

  // Auto-fill plan when client changes in add-payment modal
  useEffect(() => {
    if (selectedClient) {
      addForm.setFieldsValue({ extendMembership: selectedClient.membershipType })
    }
  }, [selectedClientId])

  // ── Add Payment ──────────────────────────────────────────────────────────
  const openAddModal = () => {
    addForm.resetFields()
    addForm.setFieldsValue({ method: 'CASH', paidAt: dayjs() })
    setAddModalOpen(true)
  }

  const onSave = async () => {
    const values = await addForm.validateFields()
    const payload: CreatePaymentPayload = {
      clientId: values.clientId,
      amount: values.amount,
      method: values.method || 'CASH',
      note: values.note || undefined,
      paidAt: values.paidAt?.toISOString(),
      extendMembership: values.extendMembership,
      newEndDate:
        values.extendMembership === 'custom' && values.newEndDate
          ? values.newEndDate.toISOString()
          : undefined,
    }
    try {
      await paymentsApi.create(payload)
      message.success('Payment recorded')
      setAddModalOpen(false)
      addForm.resetFields()
      fetchPayments()
    } catch {
      message.error('Failed to record payment')
    }
  }

  const onDelete = async (id: string) => {
    try {
      await paymentsApi.delete(id)
      message.success('Payment deleted')
      fetchPayments()
    } catch {
      message.error('Failed to delete')
    }
  }

  // ── Resolve pending import ────────────────────────────────────────────────
  const openResolve = (record: ImportedClient) => {
    resolveForm.resetFields()
    resolveForm.setFieldsValue({
      amount: record.membershipAmount ? Number(record.membershipAmount) : undefined,
      method: modeToMethod(record.paymentMode),
      extendMembership: 'monthly',
      paidAt: record.joinDate ? dayjs(record.joinDate) : dayjs(),
      note: record.reviewNote ?? `Monthly fee import — entry ${record.entryNumber ?? 'unknown'}`,
    })
    setResolveModal({ open: true, record })
  }

  const onResolve = async () => {
    const values = await resolveForm.validateFields()
    if (!resolveModal.record) return
    setResolving(true)
    try {
      // 1. Create the payment linked to the chosen client
      const payload: CreatePaymentPayload = {
        clientId: values.clientId,
        amount: values.amount,
        method: values.method || 'CASH',
        note: values.note || undefined,
        paidAt: values.paidAt?.toISOString(),
        extendMembership: values.extendMembership,
        newEndDate:
          values.extendMembership === 'custom' && values.newEndDate
            ? values.newEndDate.toISOString()
            : undefined,
      }
      await paymentsApi.create(payload)

      // 2. Mark import record as resolved (reject with a resolution note)
      const clientName = clients.find(c => c.id === values.clientId)?.name ?? values.clientId
      await importApi.reject(
        resolveModal.record.id,
        `Resolved — linked to existing client: ${clientName}`,
      )

      message.success('Payment recorded & import entry resolved')
      setResolveModal({ open: false, record: null })
      fetchPayments()
      fetchPending()
    } catch {
      message.error('Failed to resolve')
    } finally {
      setResolving(false)
    }
  }

  const onRejectImport = async (id: string) => {
    try {
      await importApi.reject(id, 'Rejected from Payments page')
      message.success('Entry rejected')
      fetchPending()
    } catch {
      message.error('Failed to reject')
    }
  }

  // ── Filtered payments (client-side) ─────────────────────────────────────
  const filteredPayments = useMemo(() => {
    let data = payments
    if (search) {
      const q = search.toLowerCase()
      data = data.filter((p) => {
        const c = p.client
        return (
          (c?.name ?? '').toLowerCase().includes(q) ||
          (c?.phone ?? '').toLowerCase().includes(q) ||
          (c?.entryNumber ?? '').toLowerCase().includes(q)
        )
      })
    }
    const [from, to] = dateFilter
    if (from || to) {
      data = data.filter((p) => {
        const d = dayjs(p.paidAt)
        if (from && to) return !d.isBefore(from, 'day') && !d.isAfter(to, 'day')
        if (from) return d.isSame(from, 'day')
        return true
      })
    }
    return data
  }, [payments, search, dateFilter])

  // ── Filtered pending (client-side) ──────────────────────────────────────
  const filteredPending = useMemo(() => {
    let data = pending
    if (pendingSearch) {
      const q = pendingSearch.toLowerCase()
      data = data.filter(
        (p) =>
          (p.entryNumber ?? '').toLowerCase().includes(q) ||
          (p.clientName ?? '').toLowerCase().includes(q) ||
          (p.paymentMode ?? '').toLowerCase().includes(q),
      )
    }
    const [from, to] = pendingDateFilter
    if (from || to) {
      data = data.filter((p) => {
        if (!p.joinDate) return false
        const d = dayjs(p.joinDate)
        if (from && to) return !d.isBefore(from, 'day') && !d.isAfter(to, 'day')
        if (from) return d.isSame(from, 'day')
        return true
      })
    }
    return data
  }, [pending, pendingSearch, pendingDateFilter])

  // ── Columns: payment history ─────────────────────────────────────────────
  const historyColumns = [
    {
      title: '',
      key: 'photo',
      width: 52,
      render: (_: unknown, r: Payment) => {
        const url = clientPhotoUrl(r.client?.photoFilename)
        return url ? (
          <Image
            src={url}
            width={38}
            height={38}
            style={{ objectFit: 'cover', borderRadius: 6, cursor: 'zoom-in' }}
            preview={{ mask: <span style={{ fontSize: 11 }}>View</span> }}
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
      key: 'entry',
      width: 90,
      defaultSortOrder: 'descend' as const,
      sorter: (a: Payment, b: Payment) => {
        const n = (p: Payment) =>
          p.client?.entryNumber
            ? Number(p.client.entryNumber.replace(/\D/g, ''))
            : -1
        return n(a) - n(b)
      },
      render: (_: unknown, r: Payment) =>
        r.client?.entryNumber ? (
          <Tag color="blue">{r.client.entryNumber}</Tag>
        ) : (
          <span style={{ color: '#bbb' }}>—</span>
        ),
    },
    {
      title: 'Client',
      key: 'client',
      sorter: (a: Payment, b: Payment) =>
        (a.client?.name ?? '').localeCompare(b.client?.name ?? ''),
      render: (_: unknown, r: Payment) => (
        <span>
          <strong>{r.client?.name ?? '—'}</strong>
          {r.client?.phone && (
            <div style={{ fontSize: 11, color: '#999' }}>{r.client.phone}</div>
          )}
        </span>
      ),
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      sorter: (a: Payment, b: Payment) => Number(a.amount) - Number(b.amount),
      render: (v: number) => (
        <strong style={{ color: '#52c41a' }}>₹{Number(v).toLocaleString()}</strong>
      ),
    },
    {
      title: 'Method',
      dataIndex: 'method',
      key: 'method',
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: 'Note',
      dataIndex: 'note',
      key: 'note',
      ellipsis: true,
      render: (v: string) => v || '—',
    },
    {
      title: 'Paid At',
      dataIndex: 'paidAt',
      key: 'paidAt',
      sorter: (a: Payment, b: Payment) =>
        dayjs(a.paidAt).unix() - dayjs(b.paidAt).unix(),
      render: (v: string) => dayjs(v).format('DD MMM YYYY'),
    },
    {
      title: '',
      key: 'actions',
      width: 60,
      render: (_: unknown, record: Payment) => (
        <Popconfirm title="Delete this payment?" onConfirm={() => onDelete(record.id)}>
          <Button icon={<DeleteOutlined />} size="small" danger />
        </Popconfirm>
      ),
    },
  ]

  // ── Columns: pending imports ─────────────────────────────────────────────
  const pendingColumns = [
    {
      title: 'Entry #',
      dataIndex: 'entryNumber',
      key: 'entryNumber',
      width: 90,
      defaultSortOrder: 'descend' as const,
      sorter: (a: ImportedClient, b: ImportedClient) => {
        const n = (r: ImportedClient) =>
          r.entryNumber ? Number(r.entryNumber.replace(/\D/g, '')) : -1
        return n(a) - n(b)
      },
      render: (v: string | null) =>
        v ? <Tag color="blue">{v}</Tag> : <Tag color="red">—</Tag>,
    },
    {
      title: 'Name',
      dataIndex: 'clientName',
      key: 'clientName',
      sorter: (a: ImportedClient, b: ImportedClient) =>
        (a.clientName ?? '').localeCompare(b.clientName ?? ''),
      render: (v: string | null) =>
        v ? <Text strong>{v}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Amount',
      dataIndex: 'membershipAmount',
      key: 'membershipAmount',
      width: 100,
      sorter: (a: ImportedClient, b: ImportedClient) =>
        Number(a.membershipAmount ?? 0) - Number(b.membershipAmount ?? 0),
      render: (v: number | null) =>
        v != null ? (
          <strong style={{ color: '#52c41a' }}>₹{Number(v).toLocaleString()}</strong>
        ) : '—',
    },
    {
      title: 'Mode',
      dataIndex: 'paymentMode',
      key: 'paymentMode',
      width: 80,
      sorter: (a: ImportedClient, b: ImportedClient) =>
        (a.paymentMode ?? '').localeCompare(b.paymentMode ?? ''),
      render: (v: string | null) =>
        v ? <Tag>{v}</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Date',
      dataIndex: 'joinDate',
      key: 'joinDate',
      width: 100,
      sorter: (a: ImportedClient, b: ImportedClient) =>
        dayjs(a.joinDate ?? 0).unix() - dayjs(b.joinDate ?? 0).unix(),
      render: (v: string | null) => (v ? dayjs(v).format('DD MMM YY') : '—'),
    },
    {
      title: 'Note',
      dataIndex: 'reviewNote',
      key: 'reviewNote',
      ellipsis: true,
      render: (v: string | null) =>
        v ? <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text> : '—',
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_: unknown, r: ImportedClient) => (
        <Space size="small">
          <Tooltip title="Link to existing client & record payment">
            <Button
              icon={<CheckOutlined />}
              size="small"
              type="primary"
              onClick={() => openResolve(r)}
            >
              Resolve
            </Button>
          </Tooltip>
          <Popconfirm title="Reject this entry?" onConfirm={() => onRejectImport(r.id)} okText="Yes">
            <Tooltip title="Dismiss without recording payment">
              <Button icon={<CloseOutlined />} size="small" danger />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ]

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
          Payments
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openAddModal}>
          Add Payment
        </Button>
      </div>

      <Card bordered={false}>
        <Tabs
          activeKey={activeTab}
          onChange={k => setActiveTab(k as 'history' | 'pending')}
          items={[
            { key: 'history', label: 'History' },
            {
              key: 'pending',
              label: (
                <Space size={6}>
                  <ClockCircleOutlined />
                  Pending Imports
                  {pending.length > 0 && (
                    <Badge count={pending.length} size="small" />
                  )}
                </Space>
              ),
            },
          ]}
        />

        {activeTab === 'history' && (
          <>
            <Row gutter={[12, 12]} style={{ margin: '12px 0' }} align="middle">
              <Col>
                <Input
                  placeholder="Search by name, phone or entry number..."
                  prefix={<SearchOutlined />}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ width: 280 }}
                  allowClear
                />
              </Col>
              <Col>
                <DatePicker.RangePicker
                  placeholder={['Payment from', 'Payment to']}
                  value={dateFilter}
                  onChange={(vals) =>
                    setDateFilter(vals ? [vals[0], vals[1]] : [null, null])
                  }
                  allowEmpty={[true, true]}
                  format="DD MMM YYYY"
                />
              </Col>
              <Col>
                <DatePicker
                  placeholder="Single payment date"
                  value={dateFilter[0] && !dateFilter[1] ? dateFilter[0] : null}
                  onChange={(val) => setDateFilter(val ? [val, null] : [null, null])}
                  format="DD MMM YYYY"
                  allowClear
                />
              </Col>
              {(dateFilter[0] || dateFilter[1]) && (
                <Col>
                  <Button size="small" onClick={() => setDateFilter([null, null])}>
                    Clear
                  </Button>
                </Col>
              )}
            </Row>
            <Table
              dataSource={filteredPayments}
              columns={historyColumns}
              rowKey="id"
              loading={historyLoading}
              pagination={{ pageSize: 15 }}
              scroll={{ x: 800 }}
            />
          </>
        )}

        {activeTab === 'pending' && (
          <>
            <Alert
              type="info"
              showIcon
              style={{ margin: '12px 0' }}
              message="Monthly fee records where the entry number couldn't be matched to a client. Resolve to link and record payment, or reject to dismiss."
            />
            <Row gutter={[12, 12]} style={{ marginBottom: 12 }} align="middle">
              <Col>
                <Input
                  placeholder="Search by entry #, name or mode..."
                  prefix={<SearchOutlined />}
                  value={pendingSearch}
                  onChange={(e) => setPendingSearch(e.target.value)}
                  style={{ width: 260 }}
                  allowClear
                />
              </Col>
              <Col>
                <DatePicker.RangePicker
                  placeholder={['Date from', 'Date to']}
                  value={pendingDateFilter}
                  onChange={(vals) =>
                    setPendingDateFilter(vals ? [vals[0], vals[1]] : [null, null])
                  }
                  allowEmpty={[true, true]}
                  format="DD MMM YYYY"
                />
              </Col>
              <Col>
                <DatePicker
                  placeholder="Single date"
                  value={pendingDateFilter[0] && !pendingDateFilter[1] ? pendingDateFilter[0] : null}
                  onChange={(val) => setPendingDateFilter(val ? [val, null] : [null, null])}
                  format="DD MMM YYYY"
                  allowClear
                />
              </Col>
              {(pendingDateFilter[0] || pendingDateFilter[1]) && (
                <Col>
                  <Button size="small" onClick={() => setPendingDateFilter([null, null])}>
                    Clear
                  </Button>
                </Col>
              )}
            </Row>
            <Table
              dataSource={filteredPending}
              columns={pendingColumns}
              rowKey="id"
              loading={pendingLoading}
              pagination={{ pageSize: 20 }}
              locale={{ emptyText: 'No pending payment imports' }}
              scroll={{ x: 800 }}
            />
          </>
        )}
      </Card>

      {/* ── Add Payment Modal ───────────────────────────────────────────── */}
      <Modal
        title="Record Payment"
        open={addModalOpen}
        onOk={onSave}
        onCancel={() => setAddModalOpen(false)}
        okText="Record"
        width={520}
        destroyOnClose
      >
        <Form form={addForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="clientId" label="Client" rules={[{ required: true }]}>
            <Select showSearch placeholder="Select client" optionFilterProp="children">
              {clients.map(c => (
                <Option key={c.id} value={c.id}>
                  {c.name} — {c.phone}
                </Option>
              ))}
            </Select>
          </Form.Item>

          {selectedClient && (
            <Alert
              style={{ marginBottom: 16 }}
              type="info"
              showIcon
              message={
                <span>
                  Current plan: <strong>{selectedClient.membershipType}</strong>
                  {' · '}Expires:{' '}
                  <strong
                    style={{
                      color: dayjs(selectedClient.endDate).isBefore(dayjs())
                        ? '#ff4d4f'
                        : '#52c41a',
                    }}
                  >
                    {dayjs(selectedClient.endDate).format('DD MMM YYYY')}
                  </strong>
                </span>
              }
            />
          )}

          <Form.Item name="amount" label="Amount (₹)" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="method" label="Payment Method">
            <Select>
              <Option value="CASH">Cash</Option>
              <Option value="CARD">Card</Option>
              <Option value="UPI">UPI</Option>
              <Option value="BANK_TRANSFER">Bank Transfer</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="extendMembership"
            label="Plan"
            rules={[{ required: true, message: 'Select a plan' }]}
            extra={
              <Text type="secondary" style={{ fontSize: 12 }}>
                Auto-filled from client's current plan. Choose "Fee only" for partial payments.
              </Text>
            }
          >
            <Select>
              <Option value="monthly">Monthly (+1 month)</Option>
              <Option value="quarterly">Quarterly (+3 months)</Option>
              <Option value="yearly">Yearly (+12 months)</Option>
              <Option value="custom">Custom end date</Option>
              <Option value="none">Fee only (no plan change)</Option>
            </Select>
          </Form.Item>

          {extendMembership === 'custom' && (
            <Form.Item
              name="newEndDate"
              label="New End Date"
              rules={[{ required: true, message: 'Enter the new end date' }]}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          )}

          <Form.Item name="paidAt" label="Date">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="note" label="Note (optional)">
            <Input placeholder="e.g. March renewal" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Resolve Pending Import Modal ─────────────────────────────────── */}
      <Modal
        title={
          <Space>
            <CheckOutlined style={{ color: '#52c41a' }} />
            Resolve — Record Payment
          </Space>
        }
        open={resolveModal.open}
        onOk={onResolve}
        onCancel={() => setResolveModal({ open: false, record: null })}
        okText="Record Payment & Resolve"
        okButtonProps={{ loading: resolving, type: 'primary' }}
        width={520}
        destroyOnClose
      >
        {resolveModal.record && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message={
              <Space direction="vertical" size={2}>
                <span>
                  Entry <Tag color="blue">{resolveModal.record.entryNumber ?? '—'}</Tag>
                  {resolveModal.record.clientName && (
                    <strong style={{ marginLeft: 4 }}>{resolveModal.record.clientName}</strong>
                  )}
                </span>
                {resolveModal.record.reviewNote && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {resolveModal.record.reviewNote}
                  </Text>
                )}
              </Space>
            }
          />
        )}

        <Form form={resolveForm} layout="vertical">
          <Form.Item
            name="clientId"
            label="Link to Client"
            rules={[{ required: true, message: 'Select a client' }]}
            extra={
              <Text type="secondary" style={{ fontSize: 12 }}>
                Search by name, phone or entry number
              </Text>
            }
          >
            <Select
              showSearch
              placeholder="Search client..."
              optionFilterProp="children"
              filterOption={(input, option) =>
                String(option?.children ?? '')
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
            >
              {clients.map(c => (
                <Option key={c.id} value={c.id}>
                  {c.entryNumber ? `[${c.entryNumber}] ` : ''}{c.name} — {c.phone}
                </Option>
              ))}
            </Select>
          </Form.Item>

          {resolveClient && (
            <Alert
              style={{ marginBottom: 16 }}
              type="info"
              showIcon
              message={
                <span>
                  Current plan: <strong>{resolveClient.membershipType}</strong>
                  {' · '}Expires:{' '}
                  <strong
                    style={{
                      color: dayjs(resolveClient.endDate).isBefore(dayjs())
                        ? '#ff4d4f'
                        : '#52c41a',
                    }}
                  >
                    {dayjs(resolveClient.endDate).format('DD MMM YYYY')}
                  </strong>
                </span>
              }
            />
          )}

          <Form.Item name="amount" label="Amount (₹)" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="method" label="Payment Method">
            <Select>
              <Option value="CASH">Cash</Option>
              <Option value="CARD">Card</Option>
              <Option value="UPI">UPI</Option>
              <Option value="BANK_TRANSFER">Bank Transfer</Option>
            </Select>
          </Form.Item>

          <Form.Item name="extendMembership" label="Plan" rules={[{ required: true }]}>
            <Select>
              <Option value="monthly">Monthly (+1 month)</Option>
              <Option value="quarterly">Quarterly (+3 months)</Option>
              <Option value="yearly">Yearly (+12 months)</Option>
              <Option value="custom">Custom end date</Option>
              <Option value="none">Fee only (no plan change)</Option>
            </Select>
          </Form.Item>

          <Form.Item name="paidAt" label="Date">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="note" label="Note (optional)">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

// ── helpers ──────────────────────────────────────────────────────────────────

function modeToMethod(mode: string | null): 'CASH' | 'UPI' | 'CARD' | 'BANK_TRANSFER' {
  if (!mode) return 'CASH'
  const m = mode.toLowerCase()
  if (m === 'online' || m === 'upi' || m === 'gpay' || m === 'phonepe' || m === 'paytm')
    return 'UPI'
  if (m === 'card') return 'CARD'
  if (m === 'bank' || m === 'neft' || m === 'imps') return 'BANK_TRANSFER'
  return 'CASH'
}
