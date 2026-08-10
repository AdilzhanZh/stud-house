import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { ProtocolStatusBadge } from '../../../components/ProtocolStatusBadge'
import { extractErrorMessage } from '../../../api/client'
import { TemplatePages } from '../../../components/TemplatePages'
import { deleteProtocol, getProtocolDetail, voteProtocol } from '../../../api/protocolApi'
import { downloadProtocolPdf, getFilledProtocolPages } from '../../../utils/protocolPdf'
import { formatDate } from '../../../utils/dateFormat'
import { useAuth } from '../../auth/useAuth'
import type { ProtocolDetail } from '../../../types/protocols'

export function ProtocolDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [protocol, setProtocol] = useState<ProtocolDetail | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [previewPages, setPreviewPages] = useState<string[] | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)

  const [showRejectForm, setShowRejectForm] = useState(false)
  const [reason, setReason] = useState('')
  const [voteError, setVoteError] = useState<string | null>(null)
  const [isVoting, setIsVoting] = useState(false)

  function load() {
    if (!id) return
    getProtocolDetail(id)
      .then(setProtocol)
      .catch((err) => setLoadError(extractErrorMessage(err, t('admin.common.loadError'))))
  }

  useEffect(load, [id])

  function protocolFieldValues() {
    if (!protocol) return null
    return {
      protocolNumber: protocol.number,
      studentNames: protocol.students.map((s) => s.student_full_name),
      protocolDate: formatDate(protocol.created_at),
    }
  }

  // Renders the filled-in document inline (a read-only "white page", same
  // look as the template editor) so a manager or committee member can read
  // the whole protocol right here — they no longer have to download the PDF
  // just to see what's in it.
  useEffect(() => {
    const values = protocolFieldValues()
    if (!values) return
    let cancelled = false
    getFilledProtocolPages(values)
      .then((pages) => {
        if (!cancelled) setPreviewPages(pages)
      })
      .catch((err) => {
        if (!cancelled) setPreviewError(extractErrorMessage(err, t('admin.protocols.previewFailed')))
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [protocol])

  async function handleDownload() {
    const values = protocolFieldValues()
    if (!protocol || !values) return
    setDownloadError(null)
    setIsDownloading(true)
    try {
      await downloadProtocolPdf(values, `khattama-${protocol.number}.pdf`)
    } catch (err) {
      setDownloadError(extractErrorMessage(err, t('admin.protocols.downloadFailed')))
    } finally {
      setIsDownloading(false)
    }
  }

  async function handleDelete() {
    if (!id) return
    setDeleteError(null)
    setIsDeleting(true)
    try {
      await deleteProtocol(id)
      navigate('/admin/protocols')
    } catch (err) {
      setDeleteError(extractErrorMessage(err, t('admin.protocols.deleteFailed')))
      setIsDeleting(false)
    }
  }

  async function handleApprove() {
    if (!id) return
    setVoteError(null)
    setIsVoting(true)
    try {
      await voteProtocol(id, 'approved')
      load()
    } catch (err) {
      setVoteError(extractErrorMessage(err, t('admin.committee.voteFailed')))
    } finally {
      setIsVoting(false)
    }
  }

  async function handleReject() {
    if (!id || !reason.trim()) return
    setVoteError(null)
    setIsVoting(true)
    try {
      await voteProtocol(id, 'rejected', reason.trim())
      setShowRejectForm(false)
      setReason('')
      load()
    } catch (err) {
      setVoteError(extractErrorMessage(err, t('admin.committee.voteFailed')))
    } finally {
      setIsVoting(false)
    }
  }

  if (loadError) return <Alert variant="error" message={loadError} />
  if (!protocol || !user) return <p className="text-sm text-sand-300">{t('admin.common.loading')}</p>

  const myVote = protocol.votes.find((v) => v.committee_member_id === user.id)
  const canVote = user.is_committee_member && protocol.status === 'pending' && !myVote?.decision

  return (
    <div className="flex flex-col gap-6">
      <Button variant="secondary" className="self-start" onClick={() => navigate('/admin/protocols')}>
        ← {t('admin.common.back')}
      </Button>

      <Card>
        <div className="flex items-center justify-between">
          <h1 className="font-heading text-lg text-sand-100">
            {t('admin.protocols.protocolTitle', { number: protocol.number })}
          </h1>
          <ProtocolStatusBadge status={protocol.status} />
        </div>
        <p className="mt-1 text-sm text-sand-300">{formatDate(protocol.created_at)}</p>
        {downloadError && <Alert variant="error" message={downloadError} />}
        <div className="mt-3 flex gap-2">
          <Button variant="secondary" onClick={handleDownload} isLoading={isDownloading}>
            {t('admin.protocols.download')}
          </Button>
          {protocol.status === 'pending' && (
            <Button variant="danger" onClick={() => setDeleteOpen(true)}>
              {t('common.delete')}
            </Button>
          )}
        </div>
      </Card>

      <Card title={t('admin.protocols.documentPreview')}>
        {previewError && <Alert variant="error" message={previewError} />}
        {!previewError && !previewPages && <p className="text-sm text-sand-300">{t('admin.common.loading')}</p>}
        {/* Read-only render of the already-sanitized-by-us template content
            (only ever written by the manager's own editor via
            updateProtocolTemplate) with real values substituted in — not
            user-supplied HTML from an untrusted source. */}
        {previewPages && <TemplatePages pages={previewPages} />}
      </Card>

      <Card title={t('admin.protocols.studentsTitle')}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th className="px-2 py-1.5 text-xs font-semibold text-sand-300">{t('admin.applications.student')}</th>
                <th className="px-2 py-1.5 text-xs font-semibold text-sand-300">{t('admin.layout.dormitories')}</th>
                <th className="px-2 py-1.5 text-xs font-semibold text-sand-300">{t('admin.protocols.roomColumn')}</th>
              </tr>
            </thead>
            <tbody>
              {protocol.students.map((s) => (
                <tr key={s.application_id}>
                  <td className="px-2 py-1.5 text-sand-100">{s.student_full_name}</td>
                  <td className="px-2 py-1.5 text-sand-100">{s.dormitory_name}</td>
                  <td className="px-2 py-1.5 text-sand-100">{s.room_number ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title={t('admin.protocols.committeeVotes')}>
        <ul className="flex flex-col gap-2">
          {protocol.votes.map((v) => {
            const label =
              v.decision === 'approved'
                ? t('admin.protocols.voteApproved')
                : v.decision === 'rejected'
                  ? t('admin.protocols.voteRejected')
                  : t('admin.protocols.votePending')
            return (
              <li key={v.committee_member_id} className="flex justify-between text-sm">
                <span className="text-sand-100">{v.committee_member_name}</span>
                <span className="text-sand-300/70">
                  {label}
                  {v.reason ? ` — ${v.reason}` : ''}
                </span>
              </li>
            )
          })}
        </ul>
      </Card>

      {canVote && (
        <Card title={t('admin.committee.castVote')}>
          {voteError && <Alert variant="error" message={voteError} />}
          {!showRejectForm ? (
            <div className="flex gap-3">
              <Button onClick={handleApprove} isLoading={isVoting}>
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
                className="rounded-[14px] border border-navy-700 bg-navy-950 px-3.5 py-2.5 text-sm text-sand-100 outline-none focus:border-turquoise-400 focus:ring-4 focus:ring-turquoise-400/15"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <div className="flex gap-3">
                <Button variant="danger" onClick={handleReject} isLoading={isVoting} disabled={!reason.trim()}>
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

      {myVote?.decision && (
        <Alert
          variant={myVote.decision === 'approved' ? 'success' : 'error'}
          message={t('admin.committee.yourVote', {
            decision:
              myVote.decision === 'approved' ? t('admin.protocols.voteApproved') : t('admin.protocols.voteRejected'),
          })}
        />
      )}

      <ConfirmDialog
        open={deleteOpen}
        title={t('admin.protocols.deleteTitle')}
        message={t('admin.protocols.deleteConfirm')}
        danger
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
      {deleteError && <Alert variant="error" message={deleteError} />}
    </div>
  )
}
