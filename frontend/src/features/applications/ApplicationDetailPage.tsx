import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card } from '../../components/Card'
import { Input } from '../../components/Input'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import { StatusBadge } from '../../components/StatusBadge'
import { ApplicationJourneyStepper } from '../../components/ApplicationJourneyStepper'
import { extractErrorMessage } from '../../api/client'
import {
  addApplicationDocument,
  getApplication,
  resubmitApplication,
} from '../../api/applicationApi'
import { applicationStatusToJourneyStep } from './statusHelpers'
import type { ApplicationDetail, ApplicationStatus } from '../../types/applications'

const statusLabels: Record<ApplicationStatus, string> = {
  pending: 'Қаралуда',
  manager_review: 'Қаралуда',
  needs_correction: 'Түзету қажет',
  approved: 'Мақұлданды',
  rejected: 'Қабылданбады',
  settled: 'Аяқталды',
}

export function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [application, setApplication] = useState<ApplicationDetail | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [documentName, setDocumentName] = useState('')
  const [fileUrl, setFileUrl] = useState('')
  const [docError, setDocError] = useState<string | null>(null)
  const [docSubmitting, setDocSubmitting] = useState(false)

  const [notes, setNotes] = useState('')
  const [notesError, setNotesError] = useState<string | null>(null)
  const [notesSubmitting, setNotesSubmitting] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)

  function load() {
    if (!id) return
    getApplication(id)
      .then((data) => {
        setApplication(data)
        setNotes(data.notes ?? '')
      })
      .catch((err) => setLoadError(extractErrorMessage(err, 'Өтінішті жүктеу сәтсіз аяқталды')))
  }

  useEffect(load, [id])

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
      setDocError(extractErrorMessage(err, 'Құжат қосу сәтсіз аяқталды'))
    } finally {
      setDocSubmitting(false)
    }
  }

  async function handleUpdateNotes(e: React.FormEvent) {
    e.preventDefault()
    if (!id) return
    setNotesError(null)
    setNotesSaved(false)
    setNotesSubmitting(true)
    try {
      await resubmitApplication(id, { notes: notes.trim() || null })
      setNotesSaved(true)
      load()
    } catch (err) {
      setNotesError(extractErrorMessage(err, 'Сақтау сәтсіз аяқталды'))
    } finally {
      setNotesSubmitting(false)
    }
  }

  if (loadError) return <Alert variant="error" message={loadError} />
  if (!application) return <p className="text-sm text-sand-300/60">Жүктелуде...</p>

  return (
    <div className="flex flex-col gap-6">
      <Button variant="secondary" className="self-start" onClick={() => navigate('/applications/my')}>
        ← Артқа
      </Button>

      <Card>
        <div className="flex items-center justify-between">
          <h1 className="font-heading text-xl text-sand-100">Өтініш</h1>
          <StatusBadge status={application.status} />
        </div>
        {application.notes && (
          <p className="mt-2 text-sm text-sand-300/70">Жазба: {application.notes}</p>
        )}
      </Card>

      {applicationStatusToJourneyStep(application.status) && (
        <Card title="Өтініштің жолы">
          <ApplicationJourneyStepper
            currentStep={applicationStatusToJourneyStep(application.status)!}
            className="overflow-x-auto py-2"
          />
        </Card>
      )}

      <Card title="Статус тарихы">
        <ol className="flex flex-col gap-3">
          {application.history.map((entry) => (
            <li key={entry.id} className="border-l-2 border-turquoise-400/30 pl-3">
              <p className="text-xs text-sand-300/60">
                {new Date(entry.created_at).toLocaleString('kk-KZ')}
              </p>
              <p className="text-sm text-sand-100">
                {entry.from_status ? `${statusLabels[entry.from_status]} → ` : ''}
                {statusLabels[entry.to_status]}
              </p>
              {entry.comment && <p className="text-sm text-sand-300/70">{entry.comment}</p>}
            </li>
          ))}
        </ol>
      </Card>

      <Card title="Жүктелген құжаттар">
        {application.documents.length === 0 && (
          <p className="text-sm text-sand-300/60">Құжат жүктелмеген</p>
        )}
        <ul className="flex flex-col gap-2">
          {application.documents.map((doc) => (
            <li key={doc.id} className="text-sm">
              <a
                href={doc.file_url}
                target="_blank"
                rel="noreferrer"
                className="text-turquoise-400 hover:underline"
              >
                {doc.display_name}
              </a>
            </li>
          ))}
        </ul>
      </Card>

      {application.status === 'needs_correction' && (
        <>
          <Card title="Жаңа құжат жүктеу">
            <p className="mb-3 text-xs text-sand-300/60">
              Файл жүктеу қызметі кейін қосылады — әзірге файлдың сілтемесін (URL) енгізіңіз.
            </p>
            <form className="flex flex-col gap-4" onSubmit={handleAddDocument}>
              {docError && <Alert variant="error" message={docError} />}
              <Input
                label="Құжат атауы"
                value={documentName}
                onChange={(e) => setDocumentName(e.target.value)}
                required
              />
              <Input
                label="Файл URL"
                type="url"
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
                required
              />
              <Button type="submit" isLoading={docSubmitting} className="self-start">
                Қосу
              </Button>
            </form>
          </Card>

          <Card title="Жазбаны жаңарту">
            <form className="flex flex-col gap-4" onSubmit={handleUpdateNotes}>
              {notesError && <Alert variant="error" message={notesError} />}
              {notesSaved && <Alert variant="success" message="Сақталды" />}
              <textarea
                rows={4}
                className="rounded-md border border-sand-100/15 bg-navy-950/60 px-3 py-2 text-sand-100 text-sm outline-none focus:border-turquoise-400 focus:ring-2 focus:ring-turquoise-400/30"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <Button type="submit" isLoading={notesSubmitting} className="self-start">
                Сақтау
              </Button>
            </form>
          </Card>
        </>
      )}
    </div>
  )
}
