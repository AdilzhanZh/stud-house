import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card } from '../../../components/Card'
import { Select } from '../../../components/Select'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { StatusBadge } from '../../../components/StatusBadge'
import { extractErrorMessage } from '../../../api/client'
import { getApplication } from '../../../api/applicationApi'
import { decideApplication } from '../../../api/applicationAdminApi'
import { getDormitory } from '../../../api/dormitoryApi'
import { listRoomsByDormitory } from '../../../api/roomApi'
import { listUsers } from '../../../api/adminUserApi'
import type { ApplicationDetail, ApplicationStatus } from '../../../types/applications'
import type { Room } from '../../../types/rooms'
import type { Dormitory } from '../../../types/dormitories'
import type { User } from '../../../types'

const statusLabels: Record<ApplicationStatus, string> = {
  pending: 'Қаралуда',
  manager_review: 'Қаралуда',
  needs_correction: 'Түзету қажет',
  approved: 'Мақұлданды',
  rejected: 'Қабылданбады',
}

type ActionPanel = 'approve' | 'reject' | 'correction' | null

export function ApplicationAdminDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [application, setApplication] = useState<ApplicationDetail | null>(null)
  const [student, setStudent] = useState<User | null>(null)
  const [dormitory, setDormitory] = useState<Dormitory | null>(null)
  const [rooms, setRooms] = useState<Room[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  const [panel, setPanel] = useState<ActionPanel>(null)
  const [roomId, setRoomId] = useState('')
  const [comment, setComment] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function load() {
    if (!id) return
    getApplication(id)
      .then(async (app) => {
        setApplication(app)
        const [users, dorm, roomList] = await Promise.all([
          listUsers('student'),
          getDormitory(app.dormitory_id),
          listRoomsByDormitory(app.dormitory_id),
        ])
        setStudent(users.find((u) => u.id === app.student_id) ?? null)
        setDormitory(dorm)
        setRooms(roomList)
      })
      .catch((err) => setLoadError(extractErrorMessage(err, 'Жүктеу сәтсіз аяқталды')))
  }

  useEffect(load, [id])

  function resetPanel() {
    setPanel(null)
    setRoomId('')
    setComment('')
    setActionError(null)
  }

  async function handleApprove() {
    if (!id || !roomId) return
    setActionError(null)
    setIsSubmitting(true)
    try {
      await decideApplication(id, { action: 'approve', room_id: roomId })
      navigate('/admin/applications')
    } catch (err) {
      setActionError(extractErrorMessage(err, 'Қабылдау сәтсіз аяқталды'))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleReject() {
    if (!id || !comment.trim()) return
    setActionError(null)
    setIsSubmitting(true)
    try {
      await decideApplication(id, { action: 'reject', comment: comment.trim() })
      navigate('/admin/applications')
    } catch (err) {
      setActionError(extractErrorMessage(err, 'Әрекет сәтсіз аяқталды'))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleRequestCorrection() {
    if (!id || !comment.trim()) return
    setActionError(null)
    setIsSubmitting(true)
    try {
      await decideApplication(id, { action: 'request_correction', comment: comment.trim() })
      navigate('/admin/applications')
    } catch (err) {
      setActionError(extractErrorMessage(err, 'Әрекет сәтсіз аяқталды'))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loadError) return <Alert variant="error" message={loadError} />
  if (!application) return <p className="text-sm text-gray-500">Жүктелуде...</p>

  // Decide() only accepts status='pending' on the backend — needs_correction
  // is a student-facing waiting state (they resubmit via PATCH
  // /applications/{id}, which flips it back to 'pending' before a manager
  // can act again), so no action buttons render for it.
  const canDecide = application.status === 'pending'

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900">Өтініш</h1>
          <StatusBadge status={application.status} />
        </div>
        <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase text-gray-500">Студент</dt>
            <dd className="text-sm text-gray-900">{student?.full_name ?? application.student_id}</dd>
            <dd className="text-sm text-gray-500">{student?.email}</dd>
            <dd className="text-sm text-gray-500">{student?.phone}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-gray-500">Жатақхана</dt>
            <dd className="text-sm text-gray-900">{dormitory?.name}</dd>
          </div>
        </dl>
        {application.notes && (
          <p className="mt-3 text-sm text-gray-600">Жазба: {application.notes}</p>
        )}
      </Card>

      <Card title="Жүктелген құжаттар">
        {application.documents.length === 0 && (
          <p className="text-sm text-gray-500">Құжат жүктелмеген</p>
        )}
        <ul className="flex flex-col gap-2">
          {application.documents.map((doc) => (
            <li key={doc.id} className="text-sm">
              <a
                href={doc.file_url}
                target="_blank"
                rel="noreferrer"
                className="text-indigo-600 hover:underline"
              >
                {doc.document_name ?? doc.file_url}
              </a>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Статус тарихы">
        <ol className="flex flex-col gap-3">
          {application.history.map((entry) => (
            <li key={entry.id} className="border-l-2 border-indigo-200 pl-3">
              <p className="text-xs text-gray-500">
                {new Date(entry.created_at).toLocaleString('kk-KZ')}
              </p>
              <p className="text-sm text-gray-900">
                {entry.from_status ? `${statusLabels[entry.from_status]} → ` : ''}
                {statusLabels[entry.to_status]}
              </p>
              {entry.comment && <p className="text-sm text-gray-600">{entry.comment}</p>}
            </li>
          ))}
        </ol>
      </Card>

      {canDecide && (
        <Card title="Шешім қабылдау">
          {actionError && <Alert variant="error" message={actionError} />}
          {panel === null && (
            <div className="flex gap-3">
              <Button onClick={() => setPanel('approve')}>Қабылдау</Button>
              <Button variant="danger" onClick={() => setPanel('reject')}>
                Қабылдамау
              </Button>
              <Button variant="secondary" onClick={() => setPanel('correction')}>
                Түзету сұрау
              </Button>
            </div>
          )}

          {panel === 'approve' && (
            <div className="flex flex-col gap-4">
              <Select label="Бөлме" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
                <option value="">Таңдаңыз</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.room_number} ({r.capacity} орын)
                  </option>
                ))}
              </Select>
              <div className="flex gap-3">
                <Button onClick={handleApprove} isLoading={isSubmitting} disabled={!roomId}>
                  Растау
                </Button>
                <Button variant="secondary" onClick={resetPanel}>
                  Бас тарту
                </Button>
              </div>
            </div>
          )}

          {panel === 'reject' && (
            <div className="flex flex-col gap-4">
              <textarea
                rows={3}
                placeholder="Қабылдамау себебі (міндетті)"
                className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <div className="flex gap-3">
                <Button variant="danger" onClick={handleReject} isLoading={isSubmitting} disabled={!comment.trim()}>
                  Растау
                </Button>
                <Button variant="secondary" onClick={resetPanel}>
                  Бас тарту
                </Button>
              </div>
            </div>
          )}

          {panel === 'correction' && (
            <div className="flex flex-col gap-4">
              <textarea
                rows={3}
                placeholder="Түзету талабы (міндетті)"
                className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <div className="flex gap-3">
                <Button onClick={handleRequestCorrection} isLoading={isSubmitting} disabled={!comment.trim()}>
                  Растау
                </Button>
                <Button variant="secondary" onClick={resetPanel}>
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
