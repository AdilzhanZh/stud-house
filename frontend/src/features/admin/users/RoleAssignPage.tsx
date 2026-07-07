import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card } from '../../../components/Card'
import { Select } from '../../../components/Select'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { extractErrorMessage } from '../../../api/client'
import { listUsers, setChairperson, updateUserRole } from '../../../api/adminUserApi'
import type { Role, User } from '../../../types'

const ALL_ROLES: Role[] = ['admin', 'manager', 'committee_member', 'student']

export function RoleAssignPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<Role>('student')
  const [isChairperson, setIsChairperson] = useState(false)

  const [loadError, setLoadError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!id) return
    // No single GET /admin/users/{id} endpoint exists — reuse the list
    // endpoint and find the row, same pattern as other admin pages.
    listUsers()
      .then((users) => {
        const found = users.find((u) => u.id === id)
        if (!found) {
          setLoadError('Пайдаланушы табылмады')
          return
        }
        setUser(found)
        setRole(found.role)
        setIsChairperson(found.is_chairperson)
      })
      .catch((err) => setLoadError(extractErrorMessage(err, 'Жүктеу сәтсіз аяқталды')))
  }, [id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!id) return
    setError(null)
    setIsSubmitting(true)
    try {
      await updateUserRole(id, role)
      if (role === 'committee_member') {
        await setChairperson(id, isChairperson)
      }
      navigate('/admin/users')
    } catch (err) {
      setError(extractErrorMessage(err, 'Сақтау сәтсіз аяқталды'))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loadError) return <Alert variant="error" message={loadError} />
  if (!user) return <p className="text-sm text-gray-500">Жүктелуде...</p>

  return (
    <Card title={`Рөлін тағайындау — ${user.full_name}`}>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        {error && <Alert variant="error" message={error} />}
        <Select label="Рөлі" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {ALL_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={isChairperson}
            disabled={role !== 'committee_member'}
            onChange={(e) => setIsChairperson(e.target.checked)}
          />
          Chairperson
          {role !== 'committee_member' && (
            <span className="text-xs text-gray-400">(тек committee_member рөлінде)</span>
          )}
        </label>
        <Button type="submit" isLoading={isSubmitting} className="self-start">
          Сақтау
        </Button>
      </form>
    </Card>
  )
}
