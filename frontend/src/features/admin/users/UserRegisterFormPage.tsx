import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '../../../components/Card'
import { Input } from '../../../components/Input'
import { Select } from '../../../components/Select'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { extractErrorMessage } from '../../../api/client'
import { createUser } from '../../../api/adminUserApi'
import type { Role } from '../../../types'

// student is deliberately excluded — students self-register via
// /auth/register (see features/auth/RegisterPage.tsx from kezeng 1).
const ASSIGNABLE_ROLES: Role[] = ['admin', 'manager', 'committee_member']

export function UserRegisterFormPage() {
  const navigate = useNavigate()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('manager')

  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await createUser({ full_name: fullName, email, phone, password, role })
      navigate('/admin/users')
    } catch (err) {
      setError(extractErrorMessage(err, 'Тіркеу сәтсіз аяқталды'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card title="Жаңа пайдаланушы тіркеу">
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        {error && <Alert variant="error" message={error} />}
        <Input label="Аты-жөні" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input label="Телефон" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Input
          label="Құпия сөз"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Select label="Рөлі" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {ASSIGNABLE_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </Select>
        <Button type="submit" isLoading={isSubmitting} className="self-start">
          Тіркеу
        </Button>
      </form>
    </Card>
  )
}
