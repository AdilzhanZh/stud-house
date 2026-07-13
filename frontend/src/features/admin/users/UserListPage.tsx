import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound, ShieldCheck } from 'lucide-react'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { DeleteIconButton } from '../../../components/DeleteIconButton'
import { Input } from '../../../components/Input'
import { Select } from '../../../components/Select'
import { extractErrorMessage } from '../../../api/client'
import { deleteUser, listUsers, setUserPassword } from '../../../api/adminUserApi'
import { useAuth } from '../../auth/useAuth'
import { roleLabels } from '../../../constants/roles'
import { adminCellClass, adminPageHeading, adminRowClass, adminTableWrapClass, adminTheadClass } from '../adminTable'
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
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <h1 className={adminPageHeading}>Пайдаланушылар</h1>
        {currentUser?.role === 'admin' && (
          <Button onClick={() => navigate('/admin/users/new')}>Жаңа менеджер тіркеу</Button>
        )}
      </div>

      <div className="max-w-xs">
        <Select
          label="Рөлі бойынша сүзгі"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as Role | '')}
        >
          <option value="">Барлық рөлдер</option>
          <option value="admin">{roleLabels.admin}</option>
          <option value="manager">{roleLabels.manager}</option>
          <option value="student">{roleLabels.student}</option>
        </Select>
      </div>

      {error && <Alert variant="error" message={error} />}
      {deleteError && <Alert variant="error" message={deleteError} />}
      {!error && !users && <p className="text-sm text-sand-300">Жүктелуде...</p>}

      {users && (
        <Card className={adminTableWrapClass}>
          <table className="w-full text-left text-sm">
            <thead className={adminTheadClass}>
              <tr>
                <th className={adminCellClass}>Аты-жөні</th>
                <th className={adminCellClass}>Email</th>
                <th className={adminCellClass}>Рөлі</th>
                <th className={adminCellClass}>Комиссия мүшесі</th>
                <th className={adminCellClass}>Төраға</th>
                {currentUser?.role === 'admin' && <th className={adminCellClass}>Әрекеттер</th>}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className={adminRowClass}>
                  <td className={`${adminCellClass} font-semibold text-sand-100`}>{u.full_name}</td>
                  <td className={`${adminCellClass} text-sand-300`}>{u.email}</td>
                  <td className={`${adminCellClass} text-sand-300`}>{roleLabels[u.role]}</td>
                  <td className={`${adminCellClass} text-sand-300`}>{u.is_committee_member ? 'Иә' : '—'}</td>
                  <td className={`${adminCellClass} text-sand-300`}>{u.is_chairperson ? 'Иә' : '—'}</td>
                  {currentUser?.role === 'admin' && (
                    <td className={adminCellClass}>
                      <div className="flex items-center gap-1">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center">
                          {u.role === 'manager' && (
                            <button
                              type="button"
                              aria-label="Рөл/комиссия тағайындау"
                              title="Рөл/комиссия тағайындау"
                              className="shrink-0 rounded-lg p-1.5 text-turquoise-400 transition-colors hover:bg-turquoise-500/10"
                              onClick={() => navigate(`/admin/users/${u.id}/role`)}
                            >
                              <ShieldCheck className="h-4.5 w-4.5" />
                            </button>
                          )}
                        </div>
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center">
                          <button
                            type="button"
                            aria-label="Құпия сөзді өзгерту"
                            title="Құпия сөзді өзгерту"
                            className="shrink-0 rounded-lg p-1.5 text-turquoise-400 transition-colors hover:bg-turquoise-500/10"
                            onClick={() => openPasswordDialog(u)}
                          >
                            <KeyRound className="h-4.5 w-4.5" />
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
                  <td className={`${adminCellClass} text-sand-300`} colSpan={6}>
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
