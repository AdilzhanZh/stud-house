import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, Check, AlertCircle } from 'lucide-react'
import { Card } from '../../components/Card'
import { Input } from '../../components/Input'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import { StatusBadge } from '../../components/StatusBadge'
import { ApplicationJourneyStepper } from '../../components/ApplicationJourneyStepper'
import { extractErrorMessage } from '../../api/client'
import { addApplicationDocument, getApplication, resubmitApplication } from '../../api/applicationApi'
import { getDormitory } from '../../api/dormitoryApi'
import { maxStayMonths } from '../../utils/stayMonths'
import { formatDateTime } from '../../utils/dateFormat'
import { useApplicationJourneys } from './useApplicationJourneys'
import type { ApplicationDetail } from '../../types/applications'

export function ApplicationDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [application, setApplication] = useState<ApplicationDetail | null>(null)
  const [dormitoryName, setDormitoryName] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const journeys = useApplicationJourneys(application ? [application] : null)
  const step = application ? journeys[application.id]?.step : undefined

  const [documentName, setDocumentName] = useState('')
  const [fileUrl, setFileUrl] = useState('')
  const [docError, setDocError] = useState<string | null>(null)
  const [docSubmitting, setDocSubmitting] = useState(false)

  const [notes, setNotes] = useState('')
  const [stayMonths, setStayMonths] = useState('')
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesError, setNotesError] = useState<string | null>(null)
  const [notesSubmitting, setNotesSubmitting] = useState(false)

  function load() {
    if (!id) return
    getApplication(id)
      .then((data) => {
        setApplication(data)
        setNotes(data.notes ?? '')
        setStayMonths(data.stay_months != null ? String(data.stay_months) : '')
        getDormitory(data.dormitory_id)
          .then((d) => setDormitoryName(d.name))
          .catch(() => setDormitoryName(null))
      })
      .catch((err) => setLoadError(extractErrorMessage(err, t('appDetail.loadError'))))
  }

  useEffect(load, [id, t])

  async function handleAddDocument(e: React.FormEvent) {
    e.preventDefault()
    if (!id) return
    setDocError(null)
    setDocSubmitting(true)
    try {
      await addApplicationDocument(id, { document_name: documentName, file_url: fileUrl })
      setDocumentName('')
      setFileUrl('')
      load()
    } catch (err) {
      setDocError(extractErrorMessage(err, t('appDetail.addDocError')))
    } finally {
      setDocSubmitting(false)
    }
  }

  async function handleUpdateNotes(e: React.FormEvent) {
    e.preventDefault()
    if (!id) return
    const months = Number(stayMonths)
    const maxMonths = maxStayMonths()
    if (!Number.isInteger(months) || months < 1 || months > maxMonths) {
      setNotesError(t('appDetail.stayMonthsError', { max: maxMonths }))
      return
    }
    setNotesError(null)
    setNotesSubmitting(true)
    try {
      await resubmitApplication(id, { notes: notes.trim() || null, stay_months: months })
      setEditingNotes(false)
      load()
    } catch (err) {
      setNotesError(extractErrorMessage(err, t('appDetail.saveFailed')))
    } finally {
      setNotesSubmitting(false)
    }
  }

  if (loadError) return <Alert variant="error" message={loadError} />
  if (!application) return <p className="text-sm text-sand-300">{t('appDetail.loading')}</p>

  const canEdit = application.status === 'needs_correction'

  return (
    <div className="flex flex-col gap-3.5">
      <button
        onClick={() => navigate('/applications/my')}
        className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-sand-300 hover:text-sand-100"
      >
        <ChevronLeft className="h-4 w-4" /> {t('appDetail.backToList')}
      </button>

      <div className="flex items-center justify-between gap-3">
        <p className="text-[22px] font-bold text-sand-100">{dormitoryName ?? '...'}</p>
        <StatusBadge status={application.status} />
      </div>

      <div className="flex flex-col gap-3.5 md:grid md:grid-cols-2 md:items-start md:gap-5">
        <div className="flex flex-col gap-3.5">
          {step && (
            <Card>
              <p className="mb-3.5 text-[15px] font-bold text-sand-100">{t('appDetail.journeyTitle')}</p>
              <ApplicationJourneyStepper currentStep={step} orientation="vertical" />
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-3.5">
          <Card>
            <p className="mb-3 text-[15px] font-bold text-sand-100">{t('appDetail.documentsTitle')}</p>
            {application.documents.length === 0 && (
              <p className="text-sm text-sand-300">{t('appDetail.noDocuments')}</p>
            )}
            <div className="flex flex-col gap-2.5">
              {application.documents.map((doc) => (
                <div key={doc.id} className="flex items-center gap-2.5">
                  <span className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-full bg-mint-500/15">
                    <Check className="h-3.5 w-3.5 text-mint-400" strokeWidth={2.5} />
                  </span>
                  <span className="flex-1 text-sm text-sand-100">{doc.display_name}</span>
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-semibold text-sand-100 hover:text-turquoise-400"
                  >
                    {t('appDetail.openDoc')}
                  </a>
                </div>
              ))}
            </div>

            {canEdit && (
              <form className="mt-4 flex flex-col gap-3 border-t border-navy-700 pt-4" onSubmit={handleAddDocument}>
                {docError && <Alert variant="error" message={docError} />}
                <Input
                  label={t('appDetail.documentNameLabel')}
                  value={documentName}
                  onChange={(e) => setDocumentName(e.target.value)}
                  required
                />
                <Input
                  label={t('appDetail.fileUrlLabel')}
                  type="url"
                  value={fileUrl}
                  onChange={(e) => setFileUrl(e.target.value)}
                  required
                />
                <Button type="submit" isLoading={docSubmitting} className="self-start">
                  {t('appDetail.addButton')}
                </Button>
              </form>
            )}
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <p className="text-[15px] font-bold text-sand-100">{t('appDetail.stayAndWishTitle')}</p>
              {canEdit && !editingNotes && (
                <button
                  onClick={() => setEditingNotes(true)}
                  className="text-sm font-semibold text-sand-100 hover:text-turquoise-400"
                >
                  {t('wizard.change')}
                </button>
              )}
            </div>
            {editingNotes ? (
              <form className="mt-2.5 flex flex-col gap-3" onSubmit={handleUpdateNotes}>
                {notesError && <Alert variant="error" message={notesError} />}
                <Input
                  label={t('appDetail.stayMonthsLabel', { max: maxStayMonths() })}
                  type="number"
                  min={1}
                  max={maxStayMonths()}
                  value={stayMonths}
                  onChange={(e) => setStayMonths(e.target.value)}
                  required
                />
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full resize-y rounded-xl border border-navy-700 bg-navy-950 px-3 py-2.5 text-sm text-sand-100 outline-none focus:border-turquoise-400"
                />
                <div className="flex gap-2.5">
                  <Button type="submit" isLoading={notesSubmitting}>
                    {t('appDetail.saveButton')}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setEditingNotes(false)}>
                    {t('appDetail.cancelButton')}
                  </Button>
                </div>
              </form>
            ) : (
              <>
                <p className="mt-1.5 text-sm text-sand-200">
                  {application.stay_months != null
                    ? t('appDetail.stayMonthsValue', { count: application.stay_months })
                    : t('appDetail.stayMonthsUnset')}
                </p>
                <p className="mt-1 text-sm text-sand-200">{application.notes || t('appDetail.wishUnset')}</p>
              </>
            )}
          </Card>

          {application.status === 'needs_correction' && (
            <div className="flex items-center gap-3 rounded-2xl bg-amber-500/10 px-4 py-3.5">
              <AlertCircle className="h-5 w-5 shrink-0 text-amber-400" />
              <p className="text-sm font-semibold text-amber-400">{t('appDetail.needsCorrectionHint')}</p>
            </div>
          )}

          <Card>
            <p className="mb-2.5 text-[15px] font-bold text-sand-100">{t('appDetail.historyTitle')}</p>
            <div className="flex flex-col gap-2 text-sm">
              {application.history.map((entry) => (
                <div key={entry.id} className="flex justify-between gap-3">
                  <span className="text-sand-100">
                    {entry.from_status ? `${t(`status.${entry.from_status}`)} → ` : ''}
                    {t(`status.${entry.to_status}`)}
                  </span>
                  <span className="shrink-0 text-sand-300">{formatDateTime(entry.created_at)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
