import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { extractErrorMessage } from '../../../api/client'
import { listUsers } from '../../../api/adminUserApi'
import { useAuth } from '../../auth/useAuth'
import type { Role, User } from '../../../types'

const roleLabels: Record<Role, string> = {
  admin: 'Admin',
  manager: 'Manager',
  student: 'Student',
  committee_member: 'Committee member',
}

export function UserListPage() {
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<User[] | null>(null)
  const [roleFilter, setRoleFilter] = useState<Role | ''>('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listUsers(roleFilter || undefined)
      .then(setUsers)
      .catch((err) => setError(extractErrorMessage(err, 'Пайдаланушыларды жүктеу сәтсіз аяқталды')))
  }, [roleFilter])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Пайдаланушылар</h1>
        {currentUser?.role === 'admin' && (
          <Button onClick={() => navigate('/admin/users/new')}>Жаңа пайдаланушы тіркеу</Button>
        )}
      </div>

      <select
        className="w-56 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
        value={roleFilter}
        onChange={(e) => setRoleFilter(e.target.value as Role | '')}
      >
        <option value="">Барлық рөлдер</option>
        <option value="admin">Admin</option>
        <option value="manager">Manager</option>
        <option value="student">Student</option>
        <option value="committee_member">Committee member</option>
      </select>

      {error && <Alert variant="error" message={error} />}
      {!error && !users && <p className="text-sm text-gray-500">Жүктелуде...</p>}

      {users && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Аты-жөні</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Рөлі</th>
                <th className="px-4 py-3">Chairperson</th>
                {currentUser?.role === 'admin' && <th className="px-4 py-3">Әрекеттер</th>}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-gray-900">{u.full_name}</td>
                  <td className="px-4 py-3 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3 text-gray-600">{roleLabels[u.role]}</td>
                  <td className="px-4 py-3 text-gray-600">{u.is_chairperson ? 'Иә' : '—'}</td>
                  {currentUser?.role === 'admin' && (
                    <td className="px-4 py-3">
                      <button
                        className="text-indigo-600 hover:underline"
                        onClick={() => navigate(`/admin/users/${u.id}/role`)}
                      >
                        Рөлін өзгерту
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td className="px-4 py-3 text-gray-500" colSpan={5}>
                    Пайдаланушы жоқ
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
