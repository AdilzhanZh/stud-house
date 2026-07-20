import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { extractErrorMessage } from '../../../api/client'
import { listUsers, setChairperson, setCommitteeMember } from '../../../api/adminUserApi'
import type { User } from '../../../types'

// Reached only from manager rows in UserListPage — the user stays a manager
// here, this page only toggles the committee-member/chairperson flags on top
// of that role.
export function RoleAssignPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [user, setUser] = useState<User | null>(null)
  const [isCommitteeMember, setIsCommitteeMember] = useState(false)
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
          setLoadError(t('admin.users.notFound'))
          return
        }
        setUser(found)
        setIsCommitteeMember(found.is_committee_member)
        setIsChairperson(found.is_chairperson)
      })
      .catch((err) => setLoadError(extractErrorMessage(err, t('admin.common.loadError'))))
  }, [id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!id) return
    setError(null)
    setIsSubmitting(true)
    try {
      await setCommitteeMember(id, isCommitteeMember)
      if (isCommitteeMember) {
        await setChairperson(id, isChairperson)
      }
      navigate('/admin/users')
    } catch (err) {
      setError(extractErrorMessage(err, t('admin.common.saveFailed')))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loadError) return <Alert variant="error" message={loadError} />
  if (!user) return <p className="text-sm text-sand-300">{t('admin.common.loading')}</p>

  return (
    <div className="flex flex-col gap-6">
      <Button variant="secondary" className="self-start" onClick={() => navigate('/admin/users')}>
        ← {t('admin.common.back')}
      </Button>

      <Card title={t('admin.users.assignCommitteeTitle', { name: user.full_name })}>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          {error && <Alert variant="error" message={error} />}
          <label className="flex items-center gap-2 text-sm text-sand-200">
            <input
              type="checkbox"
              checked={isCommitteeMember}
              onChange={(e) => {
                setIsCommitteeMember(e.target.checked)
                if (!e.target.checked) setIsChairperson(false)
              }}
            />
            {t('admin.users.committeeMember')}
          </label>
          <label className="flex items-center gap-2 text-sm text-sand-200">
            <input
              type="checkbox"
              checked={isChairperson}
              disabled={!isCommitteeMember}
              onChange={(e) => setIsChairperson(e.target.checked)}
            />
            {t('admin.users.chairperson')}
            {!isCommitteeMember && (
              <span className="text-xs text-sand-400">{t('admin.users.chairpersonHint')}</span>
            )}
          </label>
          <Button type="submit" isLoading={isSubmitting} className="self-start">
            {t('admin.common.save')}
          </Button>
        </form>
      </Card>
    </div>
  )
}
