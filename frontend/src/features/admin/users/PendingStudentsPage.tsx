import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { extractErrorMessage } from '../../../api/client'
import { decideStudentApproval, listPendingStudents } from '../../../api/adminUserApi'
import type { User } from '../../../types'

export function PendingStudentsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [students, setStudents] = useState<User[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [submittingId, setSubmittingId] = useState<string | null>(null)

  function load() {
    listPendingStudents()
      .then(setStudents)
      .catch((err) => setError(extractErrorMessage(err, t('admin.users.loadPendingError'))))
  }

  useEffect(load, [])

  async function handleDecision(id: string, action: 'approve' | 'reject') {
    setActionError(null)
    setSubmittingId(id)
    try {
      await decideStudentApproval(id, action)
      load()
    } catch (err) {
      setActionError(extractErrorMessage(err, t('admin.common.actionFailed')))
    } finally {
      setSubmittingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[23px] font-bold text-sand-100">{t('admin.layout.pendingStudents')}</h1>
        <Button onClick={() => navigate('/admin/students/new')}>{t('admin.users.registerStudent')}</Button>
      </div>

      {error && <Alert variant="error" message={error} />}
      {actionError && <Alert variant="error" message={actionError} />}
      {!error && !students && <p className="text-sm text-sand-300">{t('admin.common.loading')}</p>}

      <div className="flex flex-col gap-3">
        {students?.map((s) => (
          <Card key={s.id}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-sand-100">{s.full_name}</p>
                <p className="text-sm text-sand-300">{s.email}</p>
                <p className="text-sm text-sand-300">{t('admin.applications.phone')}: {s.phone || '—'}</p>
                <p className="font-mono text-sm text-sand-300">{t('admin.applications.iin')}: {s.iin ?? '—'}</p>
              </div>
              <div className="flex shrink-0 gap-3">
                <Button
                  onClick={() => handleDecision(s.id, 'approve')}
                  isLoading={submittingId === s.id}
                >
                  {t('common.confirm')}
                </Button>
                <Button
                  variant="danger"
                  onClick={() => handleDecision(s.id, 'reject')}
                  isLoading={submittingId === s.id}
                >
                  {t('admin.committee.disapprove')}
                </Button>
              </div>
            </div>
          </Card>
        ))}
        {students && students.length === 0 && (
          <p className="text-sm text-sand-300">{t('admin.users.noPendingStudents')}</p>
        )}
      </div>
    </div>
  )
}
