import { useEffect, useState } from 'react'
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
  Statistic,
  Row,
  Col,
} from 'antd'
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons'
import { expensesApi, Expense, CreateExpensePayload, ExpenseCategory } from '@/api/expenses.api'
import dayjs, { Dayjs } from 'dayjs'

const { Title } = Typography
const { Option } = Select

const CATEGORIES: { value: ExpenseCategory; label: string; color: string }[] = [
  { value: 'RENT', label: 'Rent', color: 'red' },
  { value: 'UTILITIES', label: 'Utilities', color: 'orange' },
  { value: 'EQUIPMENT', label: 'Equipment', color: 'blue' },
  { value: 'SALARIES', label: 'Salaries', color: 'purple' },
  { value: 'MAINTENANCE', label: 'Maintenance', color: 'cyan' },
  { value: 'MARKETING', label: 'Marketing', color: 'geekblue' },
  { value: 'OTHER', label: 'Other', color: 'default' },
]

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [filterMonth, setFilterMonth] = useState<Dayjs>(dayjs())
  const [form] = Form.useForm()

  const fetchExpenses = async (month: Dayjs) => {
    setLoading(true)
    try {
      const res = await expensesApi.list({
        month: month.month() + 1,
        year: month.year(),
      })
      setExpenses(res.data.expenses)
      setTotal(res.data.total)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchExpenses(filterMonth)
  }, [filterMonth])

  const openAdd = () => {
    setEditingExpense(null)
    form.resetFields()
    form.setFieldsValue({ date: dayjs(), category: 'OTHER' })
    setModalOpen(true)
  }

  const openEdit = (expense: Expense) => {
    setEditingExpense(expense)
    form.setFieldsValue({
      title: expense.title,
      amount: Number(expense.amount),
      category: expense.category,
      description: expense.description,
      date: dayjs(expense.date),
    })
    setModalOpen(true)
  }

  const onSave = async () => {
    const values = await form.validateFields()
    const payload: CreateExpensePayload = {
      title: values.title,
      amount: values.amount,
      category: values.category,
      description: values.description || undefined,
      date: values.date?.toISOString(),
    }

    try {
      if (editingExpense) {
        await expensesApi.update(editingExpense.id, payload)
        message.success('Expense updated')
      } else {
        await expensesApi.create(payload)
        message.success('Expense added')
      }
      setModalOpen(false)
      fetchExpenses(filterMonth)
    } catch {
      message.error('Failed to save expense')
    }
  }

  const onDelete = async (id: string) => {
    try {
      await expensesApi.delete(id)
      message.success('Expense deleted')
      fetchExpenses(filterMonth)
    } catch {
      message.error('Failed to delete')
    }
  }

  const columns = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      render: (v: string) => <strong>{v}</strong>,
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      render: (v: ExpenseCategory) => {
        const cat = CATEGORIES.find((c) => c.value === v)
        return <Tag color={cat?.color}>{cat?.label ?? v}</Tag>
      },
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      render: (v: number) => (
        <strong style={{ color: '#f5222d' }}>₹{Number(v).toLocaleString()}</strong>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (v: string) => v || '—',
    },
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      render: (v: string) => dayjs(v).format('DD MMM YYYY'),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, record: Expense) => (
        <Space>
          <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(record)} />
          <Popconfirm
            title="Delete this expense?"
            onConfirm={() => onDelete(record.id)}
          >
            <Button icon={<DeleteOutlined />} size="small" danger />
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
          Expenses
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
          Add Expense
        </Button>
      </div>

      {/* Monthly Summary */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col>
          <Card size="small" style={{ background: '#fff1f0', border: 'none' }}>
            <Statistic
              title={`Total — ${filterMonth.format('MMMM YYYY')}`}
              value={total}
              prefix="₹"
              valueStyle={{ color: '#f5222d', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col style={{ display: 'flex', alignItems: 'center' }}>
          <DatePicker
            picker="month"
            value={filterMonth}
            onChange={(v) => v && setFilterMonth(v)}
          />
        </Col>
      </Row>

      <Card bordered={false}>
        <Table
          dataSource={expenses}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 15 }}
        />
      </Card>

      <Modal
        title={editingExpense ? 'Edit Expense' : 'Add Expense'}
        open={modalOpen}
        onOk={onSave}
        onCancel={() => setModalOpen(false)}
        okText="Save"
        width={480}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="title" label="Title" rules={[{ required: true }]}>
            <Input placeholder="Monthly rent" />
          </Form.Item>

          <Form.Item name="amount" label="Amount (₹)" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="category" label="Category" rules={[{ required: true }]}>
            <Select>
              {CATEGORIES.map((c) => (
                <Option key={c.value} value={c.value}>
                  {c.label}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="description" label="Description (optional)">
            <Input.TextArea rows={2} />
          </Form.Item>

          <Form.Item name="date" label="Date">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
