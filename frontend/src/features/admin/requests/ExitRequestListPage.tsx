import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { extractErrorMessage } from '../../../api/client'
import { decideExitRequest, listExitRequests } from '../../../api/exitRequestAdminApi'
import { listUsers } from '../../../api/adminUserApi'
import { formatDate } from '../../../utils/dateFormat'
import type { ExitRequest } from '../../../types/exitRequests'

interface Row extends ExitRequest {
  studentName: string
  studentIin: string | null
  studentPhone: string
}

export function ExitRequestListPage() {
  const { t } = useTranslation()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [rejectTarget, setRejectTarget] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [submittingId, setSubmittingId] = useState<string | null>(null)

  function load() {
    setRows(null)
    Promise.all([listExitRequests('pending'), listUsers('student')])
      .then(([requests, students]) => {
        const namesById = Object.fromEntries(students.map((s) => [s.id, s.full_name]))
        const iinById = Object.fromEntries(students.map((s) => [s.id, s.iin]))
        const phoneById = Object.fromEntries(students.map((s) => [s.id, s.phone]))
        setRows(
          requests.map((r) => ({
            ...r,
            studentName: namesById[r.student_id] ?? r.student_id,
            studentIin: iinById[r.student_id] ?? null,
            studentPhone: phoneById[r.student_id] ?? '—',
          })),
        )
      })
      .catch((err) => setError(extractErrorMessage(err, t('admin.common.loadError'))))
  }

  useEffect(load, [])

  async function handleApprove(id: string) {
    setActionError(null)
    setSubmittingId(id)
    try {
      await decideExitRequest(id, { action: 'approve' })
      load()
    } catch (err) {
      setActionError(extractErrorMessage(err, t('admin.common.actionFailed')))
    } finally {
      setSubmittingId(null)
    }
  }

  async function handleReject(id: string) {
    if (!comment.trim()) return
    setActionError(null)
    setSubmittingId(id)
    try {
      await decideExitRequest(id, { action: 'reject', comment: comment.trim() })
      setRejectTarget(null)
      setComment('')
      load()
    } catch (err) {
      setActionError(extractErrorMessage(err, t('admin.common.actionFailed')))
    } finally {
      setSubmittingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-[23px] font-bold text-sand-100">{t('admin.layout.exitRequests')}</h1>

      {error && <Alert variant="error" message={error} />}
      {actionError && <Alert variant="error" message={actionError} />}
      {!error && !rows && <p className="text-sm text-sand-300">{t('admin.common.loading')}</p>}

      <div className="flex flex-col gap-3">
        {rows?.map((r) => (
          <Card key={r.id}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-sand-100">{r.studentName}</p>
                <p className="text-sm text-sand-300">
                  {t('admin.applications.phone')}: {r.studentPhone}
                  {r.studentIin && ` · ${t('admin.applications.iin')}: ${r.studentIin}`}
                </p>
                {r.reason && <p className="text-sm text-sand-300">{r.reason}</p>}
                <p className="text-xs text-sand-400">{formatDate(r.requested_at)}</p>
              </div>
              {rejectTarget !== r.id && (
                <div className="flex gap-3">
                  <Button onClick={() => handleApprove(r.id)} isLoading={submittingId === r.id}>
                    {t('admin.applications.approve')}
                  </Button>
                  <Button variant="danger" onClick={() => setRejectTarget(r.id)}>
                    {t('admin.committee.disapprove')}
                  </Button>
                </div>
              )}
            </div>

            {rejectTarget === r.id && (
              <div className="mt-4 flex flex-col gap-3">
                <textarea
                  rows={3}
                  placeholder={t('admin.requests.reasonRequired')}
                  className="rounded-[14px] border border-navy-700 bg-navy-950 px-3.5 py-2.5 text-sand-100 text-sm outline-none focus:border-turquoise-400 focus:ring-4 focus:ring-turquoise-400/15"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
                <div className="flex gap-3">
                  <Button
                    variant="danger"
                    onClick={() => handleReject(r.id)}
                    isLoading={submittingId === r.id}
                    disabled={!comment.trim()}
                  >
                    {t('common.confirm')}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setRejectTarget(null)
                      setComment('')
                    }}
                  >
                    {t('common.cancel')}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        ))}
        {rows && rows.length === 0 && (
          <p className="text-sm text-sand-300">{t('admin.requests.noRequestsToReview')}</p>
        )}
      </div>
    </div>
  )
}
