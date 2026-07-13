import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Check } from 'lucide-react'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { StatusBadge } from '../../../components/StatusBadge'
import { ApplicationJourneyStepper } from '../../../components/ApplicationJourneyStepper'
import { extractErrorMessage } from '../../../api/client'
import { getApplication } from '../../../api/applicationApi'
import { decideApplication, listApplications } from '../../../api/applicationAdminApi'
import { getDormitory } from '../../../api/dormitoryApi'
import { listRoomResidents, listRoomsByDormitory } from '../../../api/roomApi'
import { listUsers } from '../../../api/adminUserApi'
import { createReport, getReportDetail, listReports } from '../../../api/reportApi'
import { listReportTemplates } from '../../../api/reportTemplateApi'
import { listBenefits, listStudentBenefits } from '../../../api/benefitApi'
import { applicationStatusToJourneyStep } from '../../applications/statusHelpers'
import type { ApplicationDetail, ApplicationStatus } from '../../../types/applications'
import type { Dormitory } from '../../../types/dormitories'
import type { Benefit } from '../../../types/benefits'
import type { Room } from '../../../types/rooms'
import type { User } from '../../../types'

const statusLabels: Record<ApplicationStatus, string> = {
  pending: 'Қаралуда',
  manager_review: 'Қаралуда',
  needs_correction: 'Түзету қажет',
  approved: 'Мақұлданды',
  rejected: 'Қабылданбады',
  settled: 'Аяқталды',
}

interface RoomWithOccupancy extends Room {
  residentCount: number
}

type ActionPanel = 'reject' | 'correction' | null

export function ApplicationAdminDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [application, setApplication] = useState<ApplicationDetail | null>(null)
  const [student, setStudent] = useState<User | null>(null)
  const [dormitory, setDormitory] = useState<Dormitory | null>(null)
  const [studentBenefitNames, setStudentBenefitNames] = useState<string[]>([])
  const [rooms, setRooms] = useState<RoomWithOccupancy[]>([])
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [panel, setPanel] = useState<ActionPanel>(null)
  const [comment, setComment] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function load() {
    if (!id) return
    getApplication(id)
      .then(async (app) => {
        setApplication(app)
        const [users, dorm, studentBenefits, benefits, roomList] = await Promise.all([
          listUsers('student'),
          getDormitory(app.dormitory_id),
          listStudentBenefits(app.student_id).catch(() => []),
          listBenefits().catch(() => [] as Benefit[]),
          listRoomsByDormitory(app.dormitory_id).catch(() => []),
        ])
        setStudent(users.find((u) => u.id === app.student_id) ?? null)
        setDormitory(dorm)
        const benefitNamesById = Object.fromEntries(benefits.map((b) => [b.id, b.name]))
        setStudentBenefitNames(studentBenefits.map((sb) => benefitNamesById[sb.benefit_id] ?? sb.benefit_id))
        const withOccupancy = await Promise.all(
          roomList.map(async (r) => {
            const residents = await listRoomResidents(r.id).catch(() => [])
            return { ...r, residentCount: residents.length }
          }),
        )
        setRooms(withOccupancy)
        setSelectedRoomId(app.assigned_room_id)
      })
      .catch((err) => setLoadError(extractErrorMessage(err, 'Жүктеу сәтсіз аяқталды')))
  }

  useEffect(load, [id])

  function resetPanel() {
    setPanel(null)
    setComment('')
    setActionError(null)
  }

  // Committee reports bundle every approved-and-not-yet-reported application
  // together. "Already reported" means attached to any non-rejected report
  // (pending_committee or approved) — a rejected report's applications are
  // free to be re-bundled into a new one. Silently a no-op if no report
  // template is configured yet (nothing to auto-register into).
  async function autoRegisterInReport() {
    const templates = await listReportTemplates()
    const templateId = templates[0]?.id
    if (!templateId) return

    const [approvedApps, allReports] = await Promise.all([listApplications('approved'), listReports()])
    const activeReports = allReports.filter((r) => r.status !== 'rejected')
    const claimed = new Set<string>()
    const details = await Promise.all(activeReports.map((r) => getReportDetail(r.id)))
    for (const detail of details) {
      for (const s of detail.students) claimed.add(s.application_id)
    }
    const eligibleIds = approvedApps.filter((a) => !claimed.has(a.id)).map((a) => a.id)
    if (eligibleIds.length === 0) return
    await createReport(templateId, eligibleIds)
  }

  // Room selection here is optional — if a manager doesn't pick one, the
  // student is placed later via the dormitory's room/resident management
  // screens, same as before this screen supported assignment inline. The
  // backend has always accepted room_id on decide(); this page just started
  // sending it.
  async function handleApprove() {
    if (!id) return
    setActionError(null)
    setIsSubmitting(true)
    try {
      await decideApplication(id, { action: 'approve', room_id: selectedRoomId ?? undefined })
      // Best-effort — the approval itself already succeeded by this point,
      // so a report-registration hiccup shouldn't be reported as a failed
      // approval (the manager can register it from the reports page).
      await autoRegisterInReport().catch(() => {})
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
  if (!application) return <p className="text-sm text-sand-300">Жүктелуде...</p>

  // Decide() only accepts status='pending' on the backend — needs_correction
  // is a student-facing waiting state (they resubmit via PATCH
  // /applications/{id}, which flips it back to 'pending' before a manager
  // can act again), so no action buttons render for it.
  const canDecide = application.status === 'pending'

  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={() => navigate('/admin/applications')}
        className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-sand-300 hover:text-sand-100"
      >
        <ChevronLeft className="h-4 w-4" /> Өтініштер
      </button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <p className="text-[22px] font-bold text-sand-100">{student?.full_name ?? application.student_id}</p>
          <StatusBadge status={application.status} />
        </div>
        {canDecide && (
          <div className="flex gap-2">
            <Button variant="secondary" className="!text-amber-400" onClick={() => setPanel('correction')}>
              Құжат сұрау
            </Button>
            <Button variant="secondary" className="!text-clay-400" onClick={() => setPanel('reject')}>
              Бас тарту
            </Button>
            <Button onClick={handleApprove} isLoading={isSubmitting}>
              Мақұлдау
            </Button>
          </div>
        )}
      </div>

      {actionError && <Alert variant="error" message={actionError} />}

      {panel && (
        <Card>
          <p className="mb-3 text-sm font-semibold text-sand-100">
            {panel === 'reject' ? 'Қабылдамау себебі' : 'Түзету талабы'}
          </p>
          <div className="flex flex-col gap-3">
            <textarea
              rows={3}
              placeholder="Міндетті"
              className="rounded-[14px] border border-navy-700 bg-navy-950 px-3.5 py-2.5 text-sm text-sand-100 outline-none focus:border-turquoise-400 focus:ring-4 focus:ring-turquoise-400/15"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <div className="flex gap-3">
              <Button
                variant={panel === 'reject' ? 'danger' : 'primary'}
                onClick={panel === 'reject' ? handleReject : handleRequestCorrection}
                isLoading={isSubmitting}
                disabled={!comment.trim()}
              >
                Растау
              </Button>
              <Button variant="secondary" onClick={resetPanel}>
                Бас тарту
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Card>
            <p className="mb-3 text-[15px] font-bold text-sand-100">Студент туралы</p>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-sand-300">Email</span>
                <span className="font-semibold text-sand-100">{student?.email}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-sand-300">Телефон</span>
                <span className="font-semibold text-sand-100">{student?.phone || '—'}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-sand-300">ИИН</span>
                <span className="font-semibold text-sand-100">{student?.iin ?? '—'}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-sand-300">Жатақхана</span>
                <span className="font-semibold text-sand-100">{dormitory?.name}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-sand-300">Тұру мерзімі</span>
                <span className="font-semibold text-sand-100">
                  {application.stay_months != null ? `${application.stay_months} ай` : '—'}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-sand-300">Льгота</span>
                <span className="font-semibold text-sand-100">
                  {studentBenefitNames.length > 0 ? studentBenefitNames.join(', ') : 'Жоқ'}
                </span>
              </div>
            </div>
          </Card>

          {application.notes && (
            <Card>
              <p className="mb-2 text-[15px] font-bold text-sand-100">Тілегі</p>
              <p className="text-sm text-sand-200">{application.notes}</p>
            </Card>
          )}

          {canDecide && (
            <Card>
              <p className="mb-3 text-[15px] font-bold text-sand-100">Бөлме тағайындау</p>
              {rooms.length === 0 ? (
                <p className="text-sm text-sand-300">Бұл жатақханада бөлме енгізілмеген</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {rooms.map((r) => {
                    const full = r.residentCount >= r.capacity
                    const selected = selectedRoomId === r.id
                    return (
                      <button
                        key={r.id}
                        disabled={full}
                        onClick={() => setSelectedRoomId(selected ? null : r.id)}
                        className={`rounded-xl px-3.5 py-2 text-sm font-semibold ${
                          full
                            ? 'cursor-not-allowed bg-navy-800 text-sand-400 opacity-50'
                            : selected
                              ? 'border-2 border-turquoise-500 bg-turquoise-500/10 text-turquoise-400'
                              : 'border border-navy-700 bg-navy-900 text-sand-200'
                        }`}
                      >
                        {r.room_number}
                      </button>
                    )
                  })}
                </div>
              )}
              <p className="mt-2.5 text-xs text-sand-300">
                Мақұлдаған кезде тағайындалған бөлме сақталады. Таңдамасаңыз, кейінірек тағайындауға болады.
              </p>
            </Card>
          )}

          {applicationStatusToJourneyStep(application.status) && (
            <Card>
              <p className="mb-3 text-[15px] font-bold text-sand-100">Өтініштің жолы</p>
              <ApplicationJourneyStepper
                currentStep={applicationStatusToJourneyStep(application.status)!}
                className="overflow-x-auto py-2"
              />
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <p className="mb-3 text-[15px] font-bold text-sand-100">Құжаттар</p>
            {application.documents.length === 0 && <p className="text-sm text-sand-300">Құжат жүктелмеген</p>}
            <div className="flex flex-col gap-2.5">
              {application.documents.map((doc) => (
                <div key={doc.id} className="flex items-center gap-2.5">
                  <span className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-full bg-mint-500/15">
                    <Check className="h-3.5 w-3.5 text-mint-400" strokeWidth={2.5} />
                  </span>
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 text-sm text-sand-100 hover:text-turquoise-400"
                  >
                    {doc.display_name}
                  </a>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <p className="mb-2.5 text-[15px] font-bold text-sand-100">Тарих</p>
            <div className="flex flex-col gap-2 text-sm">
              {application.history.map((entry) => (
                <div key={entry.id} className="flex flex-col gap-0.5 border-b border-navy-700 pb-2 last:border-0">
                  <div className="flex justify-between gap-3">
                    <span className="text-sand-100">
                      {entry.from_status ? `${statusLabels[entry.from_status]} → ` : ''}
                      {statusLabels[entry.to_status]}
                    </span>
                    <span className="shrink-0 text-sand-300">
                      {new Date(entry.created_at).toLocaleString('kk-KZ')}
                    </span>
                  </div>
                  {entry.comment && <p className="text-sand-300">{entry.comment}</p>}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
