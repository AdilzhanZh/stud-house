import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { ReportSummaryCards } from '../../../components/ReportSummaryCards'
import { extractErrorMessage } from '../../../api/client'
import { getReportDetail, voteReport } from '../../../api/reportApi'
import { useAuth } from '../../auth/useAuth'
import type { ReportDetail } from '../../../types/reports'

export function CommitteeVotePage() {
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
      .catch((err) => setLoadError(extractErrorMessage(err, 'Жүктеу сәтсіз аяқталды')))
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
      setVoteError(extractErrorMessage(err, 'Дауыс беру сәтсіз аяқталды'))
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
      setVoteError(extractErrorMessage(err, 'Дауыс беру сәтсіз аяқталды'))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loadError) return <Alert variant="error" message={loadError} />
  if (!report || !user) return <p className="text-sm text-sand-300/60">Жүктелуде...</p>

  const myVote = report.votes.find((v) => v.committee_member_id === user.id)
  // Hide the vote panel once the report has left pending_committee (backend
  // would 409 anyway) or once this member has already voted — same
  // hide-rather-than-error principle used for needs_correction in kezeng 5.
  const canVote = report.status === 'pending_committee' && !myVote?.decision

  return (
    <div className="flex flex-col gap-6">
      <Button variant="secondary" className="self-start" onClick={() => navigate('/committee/reports')}>
        ← Артқа
      </Button>

      <ReportSummaryCards report={report} />

      {myVote?.decision && (
        <Alert
          variant={myVote.decision === 'approved' ? 'success' : 'error'}
          message={`Сіздің дауысыңыз: ${myVote.decision === 'approved' ? 'approved' : 'rejected'}`}
        />
      )}

      {canVote && (
        <Card title="Дауыс беру">
          {voteError && <Alert variant="error" message={voteError} />}
          {!showRejectForm ? (
            <div className="flex gap-3">
              <Button onClick={handleApprove} isLoading={isSubmitting}>
                Мақұлдау
              </Button>
              <Button variant="danger" onClick={() => setShowRejectForm(true)}>
                Мақұлдамау
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <textarea
                rows={3}
                placeholder="Мақұлдамау себебі (міндетті)"
                className="rounded-md border border-sand-100/15 bg-navy-950/60 px-3 py-2 text-sand-100 text-sm outline-none focus:border-turquoise-400 focus:ring-2 focus:ring-turquoise-400/30"
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
                  Растау
                </Button>
                <Button variant="secondary" onClick={() => setShowRejectForm(false)}>
                  Бас тарту
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
