import { useEffect, useMemo, useState } from 'react'
import {
  Typography,
  Card,
  Upload,
  Button,
  Table,
  Tag,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Tabs,
  Popconfirm,
  message,
  Alert,
  Badge,
  Avatar,
  Tooltip,
  Divider,
  Row,
  Col,
  Image,
  Steps,
} from 'antd'
import {
  InboxOutlined,
  CheckOutlined,
  CloseOutlined,
  EditOutlined,
  WhatsAppOutlined,
  UserOutlined,
  FolderOpenOutlined,
  SyncOutlined,
  FileSearchOutlined,
} from '@ant-design/icons'
import {
  importApi,
  ImportedClient,
  GroupedImport,
  ImportStatus,
  ImportResult,
  EnrichResult,
  photoUrl,
} from '@/api/import.api'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { Dragger } = Upload
const { Option } = Select

const DEFAULT_FEES_PATH =
  '/home/akhtar-siddi/my-gym/data/new/WhatsApp Chat - Monthly fees'
const DEFAULT_ENTRY_PATH =
  '/home/akhtar-siddi/my-gym/data/new/WhatsApp Chat - New gym entry'

// ─── Extend ImportedClient with pre-computed row span for the table ───────────
interface FlatRecord extends ImportedClient {
  _entrySpan: number // >0 = show cell with this span; 0 = hide (merged into above)
}

export default function ImportPage() {
  const [groups, setGroups] = useState<GroupedImport[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<ImportStatus>('PENDING')

  // Step 1 — fees import
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [feesPath, setFeesPath] = useState(DEFAULT_FEES_PATH)
  const [importing, setImporting] = useState(false)

  // Step 2 — enrich from entry file
  const [entryPath, setEntryPath] = useState(DEFAULT_ENTRY_PATH)
  const [enrichResult, setEnrichResult] = useState<EnrichResult | null>(null)
  const [enriching, setEnriching] = useState(false)

  // Modal
  const [modal, setModal] = useState<{
    open: boolean
    mode: 'edit' | 'approve'
    record: ImportedClient | null
  }>({ open: false, mode: 'edit', record: null })
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  // ── Flatten grouped API response → flat rows with pre-computed row spans ─────
  const flatRecords = useMemo<FlatRecord[]>(() => {
    return groups.flatMap((g) =>
      g.records.map((r, i) => ({ ...r, _entrySpan: i === 0 ? g.count : 0 })),
    )
  }, [groups])

  const pendingCount = activeTab === 'PENDING' ? flatRecords.length : undefined

  // ── Load records ──────────────────────────────────────────────────────────────
  const load = async (tab: ImportStatus) => {
    setLoading(true)
    try {
      const res = await importApi.list(tab)
      setGroups(res.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(activeTab)
  }, [activeTab])

  // ── Step 1: import fees from server folder ───────────────────────────────────
  const handleImportPath = async () => {
    if (!feesPath.trim()) return message.error('Enter a folder path')
    setImporting(true)
    setImportResult(null)
    try {
      const res = await importApi.importFromPath(feesPath.trim())
      setImportResult(res.data)
      message.success(
        `Done! ${res.data.autoApproved} auto-approved, ${res.data.needsReview} need review`,
      )
      load('PENDING')
      setActiveTab('PENDING')
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err?.response?.data?.message ?? 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  // ── Step 1: upload .txt file ─────────────────────────────────────────────────
  const handleUpload = async (file: File) => {
    setImporting(true)
    setImportResult(null)
    try {
      const res = await importApi.upload(file)
      setImportResult(res.data)
      message.success(
        `Done! ${res.data.autoApproved} auto-approved, ${res.data.needsReview} need review`,
      )
      load('PENDING')
      setActiveTab('PENDING')
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err?.response?.data?.message ?? 'Upload failed')
    } finally {
      setImporting(false)
    }
    return false // prevent antd's own upload
  }

  // ── Step 2: enrich from entry file ───────────────────────────────────────────
  const handleEnrich = async () => {
    if (!entryPath.trim()) return message.error('Enter the entry folder path')
    setEnriching(true)
    setEnrichResult(null)
    try {
      const res = await importApi.enrichFromEntry(entryPath.trim())
      setEnrichResult(res.data)
      const { autoApproved, notFound } = res.data
      if (notFound > 0) {
        message.warning(
          `${autoApproved} approved · ${notFound} could not be matched — fill in manually`,
        )
      } else {
        message.success(`All matched! ${autoApproved} auto-approved.`)
      }
      load('PENDING')
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err?.response?.data?.message ?? 'Enrich failed')
    } finally {
      setEnriching(false)
    }
  }

  // ── Modals ───────────────────────────────────────────────────────────────────
  const openEdit = (r: ImportedClient) => {
    form.setFieldsValue({
      clientName: r.clientName,
      clientPhone: r.clientPhone,
      addressRaw: r.addressRaw,
      membershipDurationMonths: r.membershipDurationMonths,
      membershipAmount: r.membershipAmount ? Number(r.membershipAmount) : null,
      paymentMode: r.paymentMode,
      reviewNote: r.reviewNote,
    })
    setModal({ open: true, mode: 'edit', record: r })
  }

  const openApprove = (r: ImportedClient) => {
    form.setFieldsValue({
      clientName: r.clientName,
      clientPhone: r.clientPhone,
      reviewNote: r.reviewNote,
    })
    setModal({ open: true, mode: 'approve', record: r })
  }

  const onOk = async () => {
    const values = await form.validateFields()
    if (!modal.record) return
    setSaving(true)
    try {
      if (modal.mode === 'edit') {
        await importApi.review(modal.record.id, values)
        message.success('Entry updated')
      } else {
        await importApi.approve(modal.record.id, values)
        message.success('Client created!')
      }
      setModal((m) => ({ ...m, open: false }))
      load(activeTab)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err?.response?.data?.message ?? 'Failed')
    } finally {
      setSaving(false)
    }
  }

  const quickApprove = async (r: ImportedClient) => {
    try {
      await importApi.approve(r.id, {})
      message.success('Client created!')
      load(activeTab)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      message.error(err?.response?.data?.message ?? 'Approval failed')
    }
  }

  const onReject = async (id: string) => {
    try {
      await importApi.reject(id)
      message.success('Rejected')
      load(activeTab)
    } catch {
      message.error('Failed')
    }
  }

  // ── Table columns ─────────────────────────────────────────────────────────────
  const columns = [
    {
      title: 'Photo',
      key: 'photo',
      width: 56,
      onCell: (r: FlatRecord) => ({ rowSpan: r._entrySpan }),
      render: (_: unknown, r: FlatRecord) => {
        const url = photoUrl(r.photoFilename)
        return url ? (
          <Image
            src={url}
            width={38}
            height={38}
            style={{ objectFit: 'cover', borderRadius: 6, cursor: 'zoom-in' }}
            preview={{ mask: <span style={{ fontSize: 10 }}>View</span> }}
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
      width: 90,
      onCell: (r: FlatRecord) => ({ rowSpan: r._entrySpan }),
      render: (_: unknown, r: FlatRecord) =>
        r.entryNumber ? (
          <Tag color="blue" style={{ fontWeight: 600 }}>
            {r.entryNumber}
          </Tag>
        ) : (
          <Tag color="default">—</Tag>
        ),
    },
    {
      title: 'Name',
      dataIndex: 'clientName',
      render: (v: string | null) =>
        v ? <Text strong>{v}</Text> : <Tag color="orange">Missing</Tag>,
    },
    {
      title: 'Phone',
      dataIndex: 'clientPhone',
      render: (v: string | null) => v ?? <Tag color="orange">Missing</Tag>,
    },
    {
      title: 'Address',
      dataIndex: 'addressRaw',
      ellipsis: true,
      render: (v: string | null) =>
        v ? (
          <Tooltip title={v}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {v}
            </Text>
          </Tooltip>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: 'Fees',
      key: 'fees',
      width: 130,
      render: (_: unknown, r: FlatRecord) => (
        <span>
          ₹{Number(r.membershipAmount ?? 0).toLocaleString()}
          <Tag style={{ marginLeft: 4 }}>{r.paymentMode ?? '?'}</Tag>
        </span>
      ),
    },
    {
      title: 'Join Date',
      dataIndex: 'joinDate',
      width: 95,
      render: (v: string | null) => (v ? dayjs(v).format('DD MMM YY') : '—'),
    },
    {
      title: 'Review Note',
      dataIndex: 'reviewNote',
      ellipsis: true,
      render: (v: string | null) =>
        v ? (
          <Tooltip title={v}>
            <Text
              type="warning"
              style={{ fontSize: 12, cursor: 'help' }}
            >
              {v}
            </Text>
          </Tooltip>
        ) : null,
    },
    ...(activeTab === 'PENDING'
      ? [
          {
            title: 'Actions',
            key: 'actions',
            width: 115,
            render: (_: unknown, r: FlatRecord) => {
              const canDirect = !!r.clientName && !!r.clientPhone
              return (
                <Space size="small">
                  <Tooltip title="Edit">
                    <Button
                      icon={<EditOutlined />}
                      size="small"
                      onClick={() => openEdit(r)}
                    />
                  </Tooltip>
                  <Tooltip
                    title={
                      canDirect ? 'Approve' : 'Fill in name & phone first'
                    }
                  >
                    <Button
                      icon={<CheckOutlined />}
                      size="small"
                      type="primary"
                      onClick={() =>
                        canDirect ? quickApprove(r) : openApprove(r)
                      }
                    />
                  </Tooltip>
                  <Popconfirm
                    title="Reject this entry?"
                    onConfirm={() => onReject(r.id)}
                    okText="Yes"
                  >
                    <Button icon={<CloseOutlined />} size="small" danger />
                  </Popconfirm>
                </Space>
              )
            },
          },
        ]
      : [
          {
            title: 'Status',
            dataIndex: 'status',
            width: 100,
            render: (v: ImportStatus) => (
              <Tag color={v === 'APPROVED' ? 'green' : 'red'}>{v}</Tag>
            ),
          },
        ]),
  ]

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div>
      <Title level={4} style={{ marginBottom: 8 }}>
        <WhatsAppOutlined style={{ color: '#25D366', marginRight: 8 }} />
        WhatsApp Import
      </Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
        Two-step workflow: import fees payments, then resolve missing member
        details from the entry chat.
      </Text>

      {/* ── Progress indicator ── */}
      <Steps
        size="small"
        current={enrichResult ? 1 : importResult ? 0 : -1}
        style={{ marginBottom: 24 }}
        items={[
          {
            title: 'Import Fees Chat',
            description: 'Parse monthly fees messages',
            icon: <WhatsAppOutlined />,
          },
          {
            title: 'Resolve from Entry Chat',
            description: 'Copy name, phone & address',
            icon: <FileSearchOutlined />,
          },
          {
            title: 'Review Remaining',
            description: 'Manually fill in missing data',
            icon: <EditOutlined />,
          },
        ]}
      />

      {/* ── Step 1: Import fees ── */}
      <Card
        bordered={false}
        style={{ marginBottom: 16 }}
        styles={{ header: { background: '#f0f5ff' } }}
        title={
          <Space>
            <Badge
              count="1"
              style={{ background: '#1677ff' }}
            />
            <span style={{ fontWeight: 600 }}>
              Import Monthly Fees Chat
            </span>
          </Space>
        }
      >
        <Row gutter={24}>
          {/* Server folder path */}
          <Col span={14}>
            <Text strong>From server folder</Text>
            <Text
              type="secondary"
              style={{ display: 'block', marginBottom: 8, fontSize: 12 }}
            >
              Chat file + photos already on this server
            </Text>
            <Space.Compact style={{ width: '100%' }}>
              <Input
                prefix={<FolderOpenOutlined />}
                value={feesPath}
                onChange={(e) => setFeesPath(e.target.value)}
                placeholder="/path/to/WhatsApp Chat - Monthly fees"
              />
              <Button
                type="primary"
                icon={<WhatsAppOutlined />}
                loading={importing}
                onClick={handleImportPath}
              >
                Import
              </Button>
            </Space.Compact>
          </Col>

          <Col span={1} style={{ display: 'flex', alignItems: 'center' }}>
            <Divider type="vertical" style={{ height: '100%' }} />
          </Col>

          {/* File upload */}
          <Col span={9}>
            <Text strong>Upload .txt file</Text>
            <Text
              type="secondary"
              style={{ display: 'block', marginBottom: 8, fontSize: 12 }}
            >
              No photos — text-only import
            </Text>
            <Dragger
              accept=".txt"
              showUploadList={false}
              beforeUpload={handleUpload}
              disabled={importing}
              style={{ padding: '4px 0' }}
            >
              <InboxOutlined style={{ fontSize: 20, color: '#1677ff' }} />
              <p style={{ margin: '4px 0 0', fontSize: 12 }}>
                Click or drag .txt
              </p>
            </Dragger>
          </Col>
        </Row>

        {importResult && (
          <Alert
            style={{ marginTop: 16 }}
            type={importResult.needsReview > 0 ? 'warning' : 'success'}
            showIcon
            message={
              <>
                <strong>{importResult.imported}</strong> imported
                &nbsp;·&nbsp;
                <strong style={{ color: '#52c41a' }}>
                  {importResult.autoApproved}
                </strong>{' '}
                auto-approved &nbsp;·&nbsp;
                <strong style={{ color: '#faad14' }}>
                  {importResult.needsReview}
                </strong>{' '}
                need review &nbsp;·&nbsp;
                <strong>{importResult.skipped}</strong> skipped (duplicates)
              </>
            }
          />
        )}
      </Card>

      {/* ── Step 2: Enrich from entry file ── */}
      <Card
        bordered={false}
        style={{ marginBottom: 20 }}
        styles={{ header: { background: '#f6ffed' } }}
        title={
          <Space>
            <Badge count="2" style={{ background: '#52c41a' }} />
            <span style={{ fontWeight: 600 }}>
              Resolve Missing Details from Entry Chat
            </span>
          </Space>
        }
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
          For each PENDING fees record, find the matching entry number in the
          new-member chat, then copy name, phone and address. Records that
          become complete are auto-approved and added to the client list.
        </Text>
        <Space.Compact style={{ width: '100%', maxWidth: 700 }}>
          <Input
            prefix={<FolderOpenOutlined />}
            value={entryPath}
            onChange={(e) => setEntryPath(e.target.value)}
            placeholder="/path/to/WhatsApp Chat - New gym entry"
          />
          <Button
            icon={<SyncOutlined spin={enriching} />}
            loading={enriching}
            onClick={handleEnrich}
            style={{ background: '#52c41a', borderColor: '#52c41a', color: '#fff' }}
          >
            Resolve &amp; Enrich
          </Button>
        </Space.Compact>

        {enrichResult && (
          <Alert
            style={{ marginTop: 16 }}
            type={enrichResult.notFound > 0 ? 'warning' : 'success'}
            showIcon
            message={
              <Space split={<Divider type="vertical" />} wrap>
                <span>
                  <strong>{enrichResult.processed}</strong> processed
                </span>
                <span style={{ color: '#52c41a' }}>
                  <strong>{enrichResult.autoApproved}</strong> auto-approved
                </span>
                <span style={{ color: '#1677ff' }}>
                  <strong>{enrichResult.enriched}</strong> enriched
                </span>
                <span style={{ color: '#faad14' }}>
                  <strong>{enrichResult.notFound}</strong> not found in entry
                  file
                </span>
                <span>
                  <strong>{enrichResult.alreadyInDb}</strong> already in DB
                </span>
              </Space>
            }
          />
        )}
      </Card>

      {/* ── Records table (grouped by entry number via row span) ── */}
      <Card bordered={false}>
        <Tabs
          activeKey={activeTab}
          onChange={(k) => setActiveTab(k as ImportStatus)}
          items={[
            {
              key: 'PENDING',
              label: (
                <span>
                  Needs Review{' '}
                  {pendingCount ? (
                    <Badge
                      count={pendingCount}
                      style={{ marginLeft: 4 }}
                    />
                  ) : null}
                </span>
              ),
            },
            { key: 'APPROVED', label: 'Approved' },
            { key: 'REJECTED', label: 'Rejected' },
          ]}
        />

        <Table<FlatRecord>
          dataSource={flatRecords}
          columns={columns}
          rowKey="id"
          loading={loading}
          scroll={{ x: 980 }}
          pagination={{ pageSize: 50, showSizeChanger: true }}
          rowClassName={(r) =>
            r.needsManualReview && activeTab === 'PENDING'
              ? 'ant-table-row-selected'
              : ''
          }
          locale={{
            emptyText:
              activeTab === 'PENDING'
                ? 'No pending entries'
                : `No ${activeTab.toLowerCase()} entries`,
          }}
        />
      </Card>

      {/* ── Edit / Approve Modal ── */}
      <Modal
        title={
          modal.mode === 'edit' ? 'Edit Entry' : 'Approve — Create Client'
        }
        open={modal.open}
        onCancel={() => setModal((m) => ({ ...m, open: false }))}
        onOk={onOk}
        okText={
          modal.mode === 'edit' ? 'Save Changes' : 'Approve & Create Client'
        }
        okButtonProps={{ loading: saving, type: 'primary' }}
        width={520}
        destroyOnClose
      >
        {/* Photo preview */}
        {modal.record?.photoFilename && (
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <Image
              src={photoUrl(modal.record.photoFilename)!}
              alt="Member photo"
              width={100}
              height={100}
              style={{
                objectFit: 'cover',
                borderRadius: 8,
                border: '1px solid #e8e8e8',
              }}
              preview={{ mask: <span style={{ fontSize: 11 }}>Full view</span> }}
            />
          </div>
        )}

        {/* Review note warning */}
        {modal.record?.reviewNote && (
          <Alert
            type="warning"
            showIcon
            message={modal.record.reviewNote}
            style={{ marginBottom: 16 }}
          />
        )}

        <Form form={form} layout="vertical">
          <Form.Item
            name="clientName"
            label="Name"
            rules={modal.mode === 'approve' ? [{ required: true }] : []}
          >
            <Input placeholder="Full name" />
          </Form.Item>

          <Form.Item
            name="clientPhone"
            label="Phone"
            rules={modal.mode === 'approve' ? [{ required: true }] : []}
          >
            <Input placeholder="10-digit mobile" maxLength={10} />
          </Form.Item>

          {modal.mode === 'edit' && (
            <>
              <Form.Item name="addressRaw" label="Address">
                <Input />
              </Form.Item>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item
                    name="membershipDurationMonths"
                    label="Duration (months)"
                  >
                    <InputNumber min={1} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="membershipAmount" label="Amount (₹)">
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="paymentMode" label="Payment Mode">
                <Select allowClear>
                  {[
                    'cash',
                    'online',
                    'upi',
                    'card',
                    'gpay',
                    'phonepe',
                    'paytm',
                  ].map((m) => (
                    <Option key={m} value={m}>
                      {m}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </>
          )}

          <Form.Item name="reviewNote" label="Note (optional)">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
