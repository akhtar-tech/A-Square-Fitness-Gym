import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { FilterProvider } from './contexts/FilterContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <ConfigProvider
          theme={{
            token: {
              colorPrimary: '#1677ff',
              borderRadius: 8,
            },
          }}
        >
          <AuthProvider>
            <FilterProvider>
              <App />
            </FilterProvider>
          </AuthProvider>
        </ConfigProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
)
