import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { KeyRound, Search, ShieldCheck } from 'lucide-react'
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
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<User[] | null>(null)
  const [roleFilter, setRoleFilter] = useState<Role | ''>('')
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const [passwordTarget, setPasswordTarget] = useState<User | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [isSavingPassword, setIsSavingPassword] = useState(false)

  const [detailsTarget, setDetailsTarget] = useState<User | null>(null)

  function load() {
    listUsers()
      .then(setUsers)
      .catch((err) => setError(extractErrorMessage(err, t('admin.users.loadError'))))
  }

  useEffect(load, [])

  const stats = useMemo(() => {
    if (!users) return null
    return {
      total: users.length,
      admins: users.filter((u) => u.role === 'admin').length,
      managers: users.filter((u) => u.role === 'manager').length,
      students: users.filter((u) => u.role === 'student').length,
    }
  }, [users])

  const visibleUsers = useMemo(() => {
    if (!users) return null
    const byRole = roleFilter ? users.filter((u) => u.role === roleFilter) : users
    const q = search.trim().toLowerCase()
    if (!q) return byRole
    return byRole.filter(
      (u) => u.full_name.toLowerCase().includes(q) || (u.iin ?? '').includes(q),
    )
  }, [users, roleFilter, search])

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleteError(null)
    setIsDeleting(true)
    try {
      await deleteUser(deleteTarget.id)
      setDeleteTarget(null)
      load()
    } catch (err) {
      setDeleteError(extractErrorMessage(err, t('admin.users.deleteFailed')))
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
      setPasswordError(extractErrorMessage(err, t('admin.users.changePasswordFailed')))
    } finally {
      setIsSavingPassword(false)
    }
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <h1 className={adminPageHeading}>{t('admin.layout.users')}</h1>
        <div className="flex gap-3">
          <Button onClick={() => navigate('/admin/students/new')}>{t('admin.users.registerStudent')}</Button>
          {currentUser?.role === 'admin' && (
            <Button variant="secondary" onClick={() => navigate('/admin/users/new')}>
              {t('admin.users.registerManager')}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Card className="!p-4">
          <p className="text-[11px] font-semibold tracking-wide text-sand-300 uppercase">{t('admin.users.statsTotal')}</p>
          <p className="mt-1.5 text-2xl font-bold text-sand-100">{stats?.total ?? '—'}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-[11px] font-semibold tracking-wide text-sand-300 uppercase">{t('admin.users.statsAdmins')}</p>
          <p className="mt-1.5 text-2xl font-bold text-turquoise-400">{stats?.admins ?? '—'}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-[11px] font-semibold tracking-wide text-sand-300 uppercase">{t('admin.users.statsManagers')}</p>
          <p className="mt-1.5 text-2xl font-bold text-amber-400">{stats?.managers ?? '—'}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-[11px] font-semibold tracking-wide text-sand-300 uppercase">{t('admin.users.statsStudents')}</p>
          <p className="mt-1.5 text-2xl font-bold text-mint-400">{stats?.students ?? '—'}</p>
        </Card>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="max-w-xs">
          <Select
            label={t('admin.users.roleFilter')}
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as Role | '')}
          >
            <option value="">{t('admin.users.allRoles')}</option>
            <option value="admin">{roleLabels.admin}</option>
            <option value="manager">{roleLabels.manager}</option>
            <option value="student">{roleLabels.student}</option>
          </Select>
        </div>
        {users && users.length > 0 && (
          <div className="flex max-w-80 items-center gap-2 rounded-full border border-navy-700 bg-navy-900 px-4 py-2.5">
            <Search className="h-4 w-4 shrink-0 text-sand-300" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('admin.users.searchPlaceholder')}
              className="w-full bg-transparent text-sm text-sand-100 outline-none placeholder:text-sand-400"
            />
          </div>
        )}
      </div>

      {error && <Alert variant="error" message={error} />}
      {deleteError && <Alert variant="error" message={deleteError} />}
      {!error && !users && <p className="text-sm text-sand-300">{t('admin.common.loading')}</p>}

      {users && (
        <Card className={adminTableWrapClass}>
          <table className="w-full text-left text-sm">
            <thead className={adminTheadClass}>
              <tr>
                <th className={adminCellClass}>{t('admin.users.fullName')}</th>
                <th className={adminCellClass}>Email</th>
                <th className={adminCellClass}>{t('admin.users.role')}</th>
                <th className={adminCellClass}>{t('admin.users.committeeMember')}</th>
                <th className={adminCellClass}>{t('admin.users.chairperson')}</th>
                {currentUser?.role === 'admin' && <th className={adminCellClass}>{t('admin.dormitories.actions')}</th>}
              </tr>
            </thead>
            <tbody>
              {visibleUsers?.map((u) => (
                <tr key={u.id} className={`${adminRowClass} cursor-pointer`} onClick={() => setDetailsTarget(u)}>
                  <td className={`${adminCellClass} font-semibold text-sand-100`}>{u.full_name}</td>
                  <td className={`${adminCellClass} text-sand-300`}>{u.email}</td>
                  <td className={`${adminCellClass} text-sand-300`}>{roleLabels[u.role]}</td>
                  <td className={`${adminCellClass} text-sand-300`}>{u.is_committee_member ? t('admin.users.yes') : '—'}</td>
                  <td className={`${adminCellClass} text-sand-300`}>{u.is_chairperson ? t('admin.users.yes') : '—'}</td>
                  {currentUser?.role === 'admin' && (
                    <td className={adminCellClass} onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center">
                          {u.role === 'manager' && (
                            <button
                              type="button"
                              aria-label={t('admin.users.assignRoleCommittee')}
                              title={t('admin.users.assignRoleCommittee')}
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
                            aria-label={t('admin.users.changePassword')}
                            title={t('admin.users.changePassword')}
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
                    {t('admin.users.empty')}
                  </td>
                </tr>
              )}
              {users.length > 0 && visibleUsers?.length === 0 && (
                <tr>
                  <td className={`${adminCellClass} text-sand-300`} colSpan={6}>
                    {t('admin.users.noSearchResults')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      )}

      <ConfirmDialog
        open={deleteTarget != null}
        title={t('admin.users.deleteTitle')}
        message={t('admin.users.deleteConfirm', { name: deleteTarget?.full_name })}
        danger
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={passwordTarget != null}
        title={t('admin.users.changePassword')}
        message={t('admin.users.changePasswordHint', { name: passwordTarget?.full_name })}
        confirmLabel={t('admin.common.save')}
        isLoading={isSavingPassword}
        onConfirm={handleSetPassword}
        onCancel={() => setPasswordTarget(null)}
      >
        <Input
          label={t('admin.users.newPassword')}
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />
        {passwordError && <p className="mt-2 text-xs text-clay-400">{passwordError}</p>}
      </ConfirmDialog>

      {detailsTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/70 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={() => setDetailsTarget(null)}
        >
          <div
            className="w-full max-w-sm rounded-[20px] bg-navy-900 p-6 shadow-[var(--shadow-card)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-heading text-lg text-sand-100">{detailsTarget.full_name}</h2>
            <dl className="mt-4 flex flex-col gap-2.5 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-sand-300">Email</dt>
                <dd className="text-right text-sand-100">{detailsTarget.email}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-sand-300">{t('admin.users.phone')}</dt>
                <dd className="text-right text-sand-100">{detailsTarget.phone || '—'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-sand-300">{t('admin.users.iin')}</dt>
                <dd className="text-right text-sand-100">{detailsTarget.iin || '—'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-sand-300">{t('admin.users.role')}</dt>
                <dd className="text-right text-sand-100">{roleLabels[detailsTarget.role]}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-sand-300">{t('admin.users.committeeMember')}</dt>
                <dd className="text-right text-sand-100">
                  {detailsTarget.is_committee_member ? t('admin.users.yes') : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-sand-300">{t('admin.users.chairperson')}</dt>
                <dd className="text-right text-sand-100">
                  {detailsTarget.is_chairperson ? t('admin.users.yes') : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-sand-300">{t('admin.users.createdAt')}</dt>
                <dd className="text-right text-sand-100">
                  {new Date(detailsTarget.created_at).toLocaleDateString()}
                </dd>
              </div>
            </dl>
            <div className="mt-6 flex justify-end">
              <Button variant="secondary" onClick={() => setDetailsTarget(null)}>
                {t('admin.common.close')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
