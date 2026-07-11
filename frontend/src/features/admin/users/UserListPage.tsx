import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { DeleteIconButton } from '../../../components/DeleteIconButton'
import { Input } from '../../../components/Input'
import { extractErrorMessage } from '../../../api/client'
import { deleteUser, listUsers, setUserPassword } from '../../../api/adminUserApi'
import { useAuth } from '../../auth/useAuth'
import { roleLabels } from '../../../constants/roles'
import type { Role, User } from '../../../types'

export function UserListPage() {
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<User[] | null>(null)
  const [roleFilter, setRoleFilter] = useState<Role | ''>('')
  const [error, setError] = useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const [passwordTarget, setPasswordTarget] = useState<User | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [isSavingPassword, setIsSavingPassword] = useState(false)

  function load() {
    listUsers(roleFilter || undefined)
      .then(setUsers)
      .catch((err) => setError(extractErrorMessage(err, 'Пайдаланушыларды жүктеу сәтсіз аяқталды')))
  }

  useEffect(load, [roleFilter])

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleteError(null)
    setIsDeleting(true)
    try {
      await deleteUser(deleteTarget.id)
      setDeleteTarget(null)
      load()
    } catch (err) {
      setDeleteError(extractErrorMessage(err, 'Пайдаланушыны өшіру сәтсіз аяқталды'))
    } finally {
      setIsDeleting(false)
    }
  }

  function openPasswordDialog(u: User) {
    setPasswordTarget(u)
    setNewPassword('')
    setPasswordError(null)
  }

  async function handleSetPassword() {
    if (!passwordTarget) return
    setPasswordError(null)
    setIsSavingPassword(true)
    try {
      await setUserPassword(passwordTarget.id, newPassword)
      setPasswordTarget(null)
    } catch (err) {
      setPasswordError(extractErrorMessage(err, 'Құпия сөзді өзгерту сәтсіз аяқталды'))
    } finally {
      setIsSavingPassword(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl text-sand-100">Пайдаланушылар</h1>
        {currentUser?.role === 'admin' && (
          <Button onClick={() => navigate('/admin/users/new')}>Жаңа менеджер тіркеу</Button>
        )}
      </div>

      <select
        className="w-56 rounded-md border border-sand-100/15 bg-navy-950/60 px-3 py-2 text-sand-100 text-sm outline-none focus:border-turquoise-400 focus:ring-2 focus:ring-turquoise-400/30"
        value={roleFilter}
        onChange={(e) => setRoleFilter(e.target.value as Role | '')}
      >
        <option value="">Барлық рөлдер</option>
        <option value="admin">{roleLabels.admin}</option>
        <option value="manager">{roleLabels.manager}</option>
        <option value="student">{roleLabels.student}</option>
      </select>

      {error && <Alert variant="error" message={error} />}
      {deleteError && <Alert variant="error" message={deleteError} />}
      {!error && !users && <p className="text-sm text-sand-300/60">Жүктелуде...</p>}

      {users && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-sand-100/10 text-xs uppercase text-sand-300/60">
              <tr>
                <th className="px-4 py-3">Аты-жөні</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Рөлі</th>
                <th className="px-4 py-3">Комиссия мүшесі</th>
                <th className="px-4 py-3">Төраға</th>
                {currentUser?.role === 'admin' && <th className="px-4 py-3">Әрекеттер</th>}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-sand-100/10 last:border-0">
                  <td className="px-4 py-3 font-medium text-sand-100">{u.full_name}</td>
                  <td className="px-4 py-3 text-sand-300/70">{u.email}</td>
                  <td className="px-4 py-3 text-sand-300/70">{roleLabels[u.role]}</td>
                  <td className="px-4 py-3 text-sand-300/70">{u.is_committee_member ? 'Иә' : '—'}</td>
                  <td className="px-4 py-3 text-sand-300/70">{u.is_chairperson ? 'Иә' : '—'}</td>
                  {currentUser?.role === 'admin' && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center">
                          {u.role === 'manager' && (
                            <button
                              type="button"
                              aria-label="Рөл/комиссия тағайындау"
                              title="Рөл/комиссия тағайындау"
                              className="shrink-0 rounded-md p-1.5 text-turquoise-400 transition-colors hover:bg-turquoise-500/10"
                              onClick={() => navigate(`/admin/users/${u.id}/role`)}
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="h-5 w-5"
                              >
                                <path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5z" />
                                <path d="m9 12 2 2 4-4" />
                              </svg>
                            </button>
                          )}
                        </div>
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center">
                          <button
                            type="button"
                            aria-label="Құпия сөзді өзгерту"
                            title="Құпия сөзді өзгерту"
                            className="shrink-0 rounded-md p-1.5 text-turquoise-400 transition-colors hover:bg-turquoise-500/10"
                            onClick={() => openPasswordDialog(u)}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={2}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="h-5 w-5"
                            >
                              <circle cx="7.5" cy="15.5" r="5.5" />
                              <path d="m21 2-9.6 9.6" />
                              <path d="m15.5 7.5 3 3L22 7l-3-3" />
                            </svg>
                          </button>
                        </div>
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center">
                          {currentUser.id !== u.id && (
                            <DeleteIconButton onClick={() => setDeleteTarget(u)} />
                          )}
                        </div>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td className="px-4 py-3 text-sand-300/60" colSpan={6}>
                    Пайдаланушы жоқ
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      )}

      <ConfirmDialog
        open={deleteTarget != null}
        title="Пайдаланушыны өшіру"
        message={`"${deleteTarget?.full_name}" пайдаланушысын өшіргіңіз келе ме? Бұл әрекетті қайтару мүмкін емес.`}
        danger
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={passwordTarget != null}
        title="Құпия сөзді өзгерту"
        message={`"${passwordTarget?.full_name}" пайдаланушысына жаңа құпия сөз орнатыңыз. Ескі құпия сөз көрсетілмейді — тек ауыстыруға болады.`}
        confirmLabel="Сақтау"
        isLoading={isSavingPassword}
        onConfirm={handleSetPassword}
        onCancel={() => setPasswordTarget(null)}
      >
        <Input
          label="Жаңа құпия сөз"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />
        {passwordError && <p className="mt-2 text-xs text-clay-400">{passwordError}</p>}
      </ConfirmDialog>
    </div>
  )
}
