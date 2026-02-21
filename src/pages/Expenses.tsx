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
  Statistic,
  Row,
  Col,
} from 'antd'
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons'
import { expensesApi, Expense, CreateExpensePayload, ExpenseCategory } from '@/api/expenses.api'
import { dayjs } from '@/utils/date'
import type { Dayjs } from 'dayjs'
import { logError } from '@/utils/errorHandler'
import { PAGINATION } from '@/constants/pagination'
import { useFilters } from '@/contexts/FilterContext'

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
  const { filters, setFilter } = useFilters()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [form] = Form.useForm()

  // Get month/year from global filters, default to current month
  const monthYear = filters.monthYear as { month: number; year: number } | undefined
  const currentMonth = monthYear || { month: dayjs().month() + 1, year: dayjs().year() }

  const fetchExpenses = async () => {
    setLoading(true)
    try {
      const res = await expensesApi.list({
        month: currentMonth.month,
        year: currentMonth.year,
      })
      setExpenses(res.data.expenses)
      setTotal(res.data.total)
    } catch (err) {
      logError('Expenses fetch', err)
      message.error('Failed to load expenses')
    } finally {
      setLoading(false)
    }
  }

  // Initialize filter to current month if not set
  useEffect(() => {
    if (!monthYear) {
      setFilter('monthYear', { month: dayjs().month() + 1, year: dayjs().year() })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    fetchExpenses()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonth.month, currentMonth.year])

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
      fetchExpenses()
    } catch (err) {
      logError('Expense save', err)
      message.error('Failed to save expense')
    }
  }

  const onDelete = async (id: string) => {
    try {
      await expensesApi.delete(id)
      message.success('Expense deleted')
      fetchExpenses()
    } catch (err) {
      logError('Expense delete', err)
      message.error('Failed to delete')
    }
  }

  // Client-side filtering for search and date range
  const filteredExpenses = useMemo(() => {
    let data = expenses

    // Search filter
    const search = filters.search
    if (search) {
      const q = search.toLowerCase()
      data = data.filter((exp) => {
        return (
          exp.title.toLowerCase().includes(q) ||
          (exp.description ?? '').toLowerCase().includes(q) ||
          exp.category.toLowerCase().includes(q)
        )
      })
    }

    // Date range filter
    const dateRange = filters.dateRange as [any, any] | undefined
    if (dateRange && (dateRange[0] || dateRange[1])) {
      data = data.filter((exp) => {
        const expDate = dayjs(exp.date)
        const fromDate = dateRange[0] ? dayjs(dateRange[0]).startOf('day') : null
        const toDate = dateRange[1] ? dayjs(dateRange[1]).endOf('day') : null

        if (fromDate && toDate) {
          return expDate.isAfter(fromDate) && expDate.isBefore(toDate)
        } else if (fromDate) {
          return expDate.isAfter(fromDate)
        } else if (toDate) {
          return expDate.isBefore(toDate)
        }
        return true
      })
    }

    return data
  }, [expenses, filters.search, filters.dateRange])

  const columns = useMemo(
    () => [
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
            <Button
              icon={<EditOutlined />}
              size="small"
              onClick={() => openEdit(record)}
              aria-label="Edit expense"
            />
            <Popconfirm
              title="Delete this expense?"
              onConfirm={() => onDelete(record.id)}
            >
              <Button
                icon={<DeleteOutlined />}
                size="small"
                danger
                aria-label="Delete expense"
              />
            </Popconfirm>
          </Space>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

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
              title={`Total — ${dayjs().month(currentMonth.month - 1).year(currentMonth.year).format('MMMM YYYY')}`}
              value={total}
              prefix="₹"
              valueStyle={{ color: '#f5222d', fontWeight: 700 }}
            />
          </Card>
        </Col>
      </Row>

      <Card bordered={false}>
        <Table
          dataSource={filteredExpenses}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: PAGINATION.DEFAULT_PAGE_SIZE }}
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
