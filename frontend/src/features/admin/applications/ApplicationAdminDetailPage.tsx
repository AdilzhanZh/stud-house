import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { StatusBadge } from '../../../components/StatusBadge'
import { ApplicationJourneyStepper } from '../../../components/ApplicationJourneyStepper'
import { extractErrorMessage } from '../../../api/client'
import { getApplication } from '../../../api/applicationApi'
import { decideApplication, listApplications } from '../../../api/applicationAdminApi'
import { getDormitory } from '../../../api/dormitoryApi'
import { listUsers } from '../../../api/adminUserApi'
import { createReport, getReportDetail, listReports } from '../../../api/reportApi'
import { listReportTemplates } from '../../../api/reportTemplateApi'
import { listBenefits, listStudentBenefits } from '../../../api/benefitApi'
import { applicationStatusToJourneyStep } from '../../applications/statusHelpers'
import type { ApplicationDetail, ApplicationStatus } from '../../../types/applications'
import type { Dormitory } from '../../../types/dormitories'
import type { Benefit } from '../../../types/benefits'
import type { User } from '../../../types'

const statusLabels: Record<ApplicationStatus, string> = {
  pending: 'Қаралуда',
  manager_review: 'Қаралуда',
  needs_correction: 'Түзету қажет',
  approved: 'Мақұлданды',
  rejected: 'Қабылданбады',
  settled: 'Аяқталды',
}

type ActionPanel = 'approve' | 'reject' | 'correction' | null

export function ApplicationAdminDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [application, setApplication] = useState<ApplicationDetail | null>(null)
  const [student, setStudent] = useState<User | null>(null)
  const [dormitory, setDormitory] = useState<Dormitory | null>(null)
  const [studentBenefitNames, setStudentBenefitNames] = useState<string[]>([])
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
        const [users, dorm, studentBenefits, benefits] = await Promise.all([
          listUsers('student'),
          getDormitory(app.dormitory_id),
          listStudentBenefits(app.student_id).catch(() => []),
          listBenefits().catch(() => [] as Benefit[]),
        ])
        setStudent(users.find((u) => u.id === app.student_id) ?? null)
        setDormitory(dorm)
        const benefitNamesById = Object.fromEntries(benefits.map((b) => [b.id, b.name]))
        setStudentBenefitNames(
          studentBenefits.map((sb) => benefitNamesById[sb.benefit_id] ?? sb.benefit_id),
        )
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

  // Room assignment no longer happens here — a student is placed in a room
  // later (after their final payment) via the dormitory's room/resident
  // management screens, not at approval time. The application PDF is
  // downloaded on demand from the queue's "Қабылданды" tab, not here.
  async function handleApprove() {
    if (!id) return
    setActionError(null)
    setIsSubmitting(true)
    try {
      await decideApplication(id, { action: 'approve' })
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
  if (!application) return <p className="text-sm text-sand-300/60">Жүктелуде...</p>

  // Decide() only accepts status='pending' on the backend — needs_correction
  // is a student-facing waiting state (they resubmit via PATCH
  // /applications/{id}, which flips it back to 'pending' before a manager
  // can act again), so no action buttons render for it.
  const canDecide = application.status === 'pending'

  return (
    <div className="flex flex-col gap-6">
      <Button variant="secondary" className="self-start" onClick={() => navigate('/admin/applications')}>
        ← Артқа
      </Button>

      <Card>
        <div className="flex items-center justify-between">
          <h1 className="font-heading text-xl text-sand-100">Өтініш</h1>
          <StatusBadge status={application.status} />
        </div>
        <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase text-sand-300/60">Студент</dt>
            <dd className="text-sm text-sand-100">{student?.full_name ?? application.student_id}</dd>
            <dd className="font-mono text-sm text-sand-300/60">ИИН: {student?.iin ?? '—'}</dd>
            <dd className="text-sm text-sand-300/60">{student?.email}</dd>
            <dd className="text-sm text-sand-300/60">{student?.phone}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-sand-300/60">Жатақхана</dt>
            <dd className="text-sm text-sand-100">{dormitory?.name}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-sand-300/60">Льгота</dt>
            <dd className="text-sm text-sand-100">
              {studentBenefitNames.length > 0 ? studentBenefitNames.join(', ') : 'Жоқ'}
            </dd>
          </div>
        </dl>
        {application.notes && (
          <p className="mt-3 text-sm text-sand-300/70">Жазба: {application.notes}</p>
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
              <p className="text-sm text-sand-300/70">
                Өтінішті мақұлдайсыз ба? Бөлме студентке соңғы төлемнен кейін тағайындалады.
              </p>
              <div className="flex gap-3">
                <Button onClick={handleApprove} isLoading={isSubmitting}>
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
                className="rounded-md border border-sand-100/15 bg-navy-950/60 px-3 py-2 text-sand-100 text-sm outline-none focus:border-turquoise-400 focus:ring-2 focus:ring-turquoise-400/30"
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
                className="rounded-md border border-sand-100/15 bg-navy-950/60 px-3 py-2 text-sand-100 text-sm outline-none focus:border-turquoise-400 focus:ring-2 focus:ring-turquoise-400/30"
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
