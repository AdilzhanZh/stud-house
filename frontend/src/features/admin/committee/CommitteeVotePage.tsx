import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { ReportSummaryCards } from '../../../components/ReportSummaryCards'
import { extractErrorMessage } from '../../../api/client'
import { getReportDetail, voteReport } from '../../../api/reportApi'
import { useAuth } from '../../auth/useAuth'
import type { ReportDetail } from '../../../types/reports'

export function CommitteeVotePage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [report, setReport] = useState<ReportDetail | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [showRejectForm, setShowRejectForm] = useState(false)
  const [reason, setReason] = useState('')
  const [voteError, setVoteError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function load() {
    if (!id) return
    getReportDetail(id)
      .then(setReport)
      .catch((err) => setLoadError(extractErrorMessage(err, t('admin.common.loadError'))))
  }

  useEffect(load, [id])

  async function handleApprove() {
    if (!id) return
    setVoteError(null)
    setIsSubmitting(true)
    try {
      await voteReport(id, 'approved')
      load()
    } catch (err) {
      setVoteError(extractErrorMessage(err, t('admin.committee.voteFailed')))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleReject() {
    if (!id || !reason.trim()) return
    setVoteError(null)
    setIsSubmitting(true)
    try {
      await voteReport(id, 'rejected', reason.trim())
      load()
    } catch (err) {
      setVoteError(extractErrorMessage(err, t('admin.committee.voteFailed')))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loadError) return <Alert variant="error" message={loadError} />
  if (!report || !user) return <p className="text-sm text-sand-300">{t('admin.common.loading')}</p>

  const myVote = report.votes.find((v) => v.committee_member_id === user.id)
  // Hide the vote panel once the report has left pending_committee (backend
  // would 409 anyway) or once this member has already voted — same
  // hide-rather-than-error principle used for needs_correction in kezeng 5.
  const canVote = report.status === 'pending_committee' && !myVote?.decision

  return (
    <div className="flex flex-col gap-6">
      <Button variant="secondary" className="self-start" onClick={() => navigate('/committee/reports')}>
        ← {t('admin.common.back')}
      </Button>

      <ReportSummaryCards report={report} />

      {myVote?.decision && (
        <Alert
          variant={myVote.decision === 'approved' ? 'success' : 'error'}
          message={t('admin.committee.yourVote', {
            decision: myVote.decision === 'approved' ? t('admin.reports.voteApproved') : t('admin.reports.voteRejected'),
          })}
        />
      )}

      {canVote && (
        <Card title={t('admin.committee.castVote')}>
          {voteError && <Alert variant="error" message={voteError} />}
          {!showRejectForm ? (
            <div className="flex gap-3">
              <Button onClick={handleApprove} isLoading={isSubmitting}>
                {t('admin.applications.approve')}
              </Button>
              <Button variant="danger" onClick={() => setShowRejectForm(true)}>
                {t('admin.committee.disapprove')}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <textarea
                rows={3}
                placeholder={t('admin.committee.disapproveReasonPlaceholder')}
                className="rounded-[14px] border border-navy-700 bg-navy-950 px-3.5 py-2.5 text-sand-100 text-sm outline-none focus:border-turquoise-400 focus:ring-4 focus:ring-turquoise-400/15"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <div className="flex gap-3">
                <Button
                  variant="danger"
                  onClick={handleReject}
                  isLoading={isSubmitting}
                  disabled={!reason.trim()}
                >
                  {t('common.confirm')}
                </Button>
                <Button variant="secondary" onClick={() => setShowRejectForm(false)}>
                  {t('common.cancel')}
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
