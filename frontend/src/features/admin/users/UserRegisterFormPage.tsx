import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '../../../components/Card'
import { Input } from '../../../components/Input'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { extractErrorMessage } from '../../../api/client'
import { createUser } from '../../../api/adminUserApi'

// This form only ever creates managers — students self-register via
// /auth/register, and the system only ever allows one admin account (which
// already exists), so there's no role choice left to make here.
export function UserRegisterFormPage() {
  const navigate = useNavigate()

  const [aty, setAty] = useState('')
  const [familiya, setFamiliya] = useState('')
  const [tegi, setTegi] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const fullName = [aty, familiya, tegi]
        .map((part) => part.trim())
        .filter(Boolean)
        .join(' ')
      await createUser({ full_name: fullName, email, phone, password, role: 'manager' })
      navigate('/admin/users')
    } catch (err) {
      setError(extractErrorMessage(err, 'Тіркеу сәтсіз аяқталды'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Button variant="secondary" className="self-start" onClick={() => navigate('/admin/users')}>
        ← Артқа
      </Button>

      <Card title="Жаңа менеджер тіркеу">
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          {error && <Alert variant="error" message={error} />}
          <Input label="Аты" value={aty} onChange={(e) => setAty(e.target.value)} required />
          <Input label="Фамилия" value={familiya} onChange={(e) => setFamiliya(e.target.value)} />
          <Input label="Тегі" value={tegi} onChange={(e) => setTegi(e.target.value)} />
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input label="Телефон" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input
            label="Құпия сөз"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" isLoading={isSubmitting} className="self-start">
            Тіркеу
          </Button>
        </form>
      </Card>
    </div>
  )
}
