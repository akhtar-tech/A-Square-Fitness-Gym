import { Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from '@/components/layout/AppLayout'
import ProtectedRoute from '@/components/layout/ProtectedRoute'
import LoginPage from '@/pages/Login'
import DashboardPage from '@/pages/Dashboard'
import ClientsPage from '@/pages/Clients'
import PaymentsPage from '@/pages/Payments'
import ExpensesPage from '@/pages/Expenses'
import ImportPage from '@/pages/Import'

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="expenses" element={<ExpensesPage />} />
        {/* <Route path="import" element={<ImportPage />} /> */}
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
