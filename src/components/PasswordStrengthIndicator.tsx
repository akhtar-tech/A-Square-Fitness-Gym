import { getPasswordStrength } from '@/utils/validation'
import { Space, Tag } from 'antd'
import { CheckCircleFilled, CloseCircleFilled } from '@ant-design/icons'

interface PasswordStrengthIndicatorProps {
  password: string
}

/**
 * Visual indicator for password strength requirements
 * Shows if password meets backend validation requirements
 */
export function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  const strength = getPasswordStrength(password)

  const requirements = [
    { key: 'length', label: 'At least 8 characters', met: strength.hasMinLength },
    { key: 'lowercase', label: 'One lowercase letter', met: strength.hasLowercase },
    { key: 'uppercase', label: 'One uppercase letter', met: strength.hasUppercase },
    { key: 'number', label: 'One number', met: strength.hasNumber },
  ]

  return (
    <Space direction="vertical" size="small" style={{ width: '100%' }}>
      {requirements.map((req) => (
        <div key={req.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {req.met ? (
            <CheckCircleFilled style={{ color: '#52c41a', fontSize: 14 }} />
          ) : (
            <CloseCircleFilled style={{ color: '#d9d9d9', fontSize: 14 }} />
          )}
          <span style={{ fontSize: 12, color: req.met ? '#52c41a' : '#8c8c8c' }}>
            {req.label}
          </span>
        </div>
      ))}

      {password && (
        <div style={{ marginTop: 8 }}>
          <Tag color={strength.score === 4 ? 'success' : strength.score >= 2 ? 'warning' : 'error'}>
            Strength: {strength.score === 4 ? 'Strong' : strength.score >= 2 ? 'Moderate' : 'Weak'}
          </Tag>
        </div>
      )}
    </Space>
  )
}
