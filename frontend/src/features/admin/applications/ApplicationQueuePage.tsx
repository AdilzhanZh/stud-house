import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '../../../components/Card'
import { Alert } from '../../../components/Alert'
import { StatusBadge } from '../../../components/StatusBadge'
import { Select } from '../../../components/Select'
import { DownloadIconButton } from '../../../components/DownloadIconButton'
import { extractErrorMessage } from '../../../api/client'
import { listApplications } from '../../../api/applicationAdminApi'
import { listDormitories } from '../../../api/dormitoryApi'
import { listUsers } from '../../../api/adminUserApi'
import { listBenefits, listStudentBenefits } from '../../../api/benefitApi'
import { downloadApplicationPdf } from '../../../utils/applicationPdf'
import { markApplicationsSeenNow } from './applicationsSeen'
import type { Application, ApplicationStatus } from '../../../types/applications'

const TABS: { status: ApplicationStatus; label: string }[] = [
  { status: 'pending', label: 'Менеджерді күтуде' },
  { status: 'needs_correction', label: 'Түзетуде' },
  { status: 'approved', label: 'Қабылданды' },
  { status: 'rejected', label: 'Қабылданбады' },
]

export function ApplicationQueuePage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<ApplicationStatus>('pending')
  const [applications, setApplications] = useState<Application[] | null>(null)
  const [namesById, setNamesById] = useState<Record<string, string>>({})
  const [dormitoryNamesById, setDormitoryNamesById] = useState<Record<string, string>>({})
  const [priorityByStudent, setPriorityByStudent] = useState<Record<string, number>>({})
  const [dormitoryFilter, setDormitoryFilter] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setApplications(null)
    Promise.all([listApplications(activeTab), listUsers('student'), listDormitories(), listBenefits()])
      .then(async ([apps, students, dormitories, benefits]) => {
        if (cancelled) return
        setApplications(apps)
        setNamesById(Object.fromEntries(students.map((s) => [s.id, s.full_name])))
        setDormitoryNamesById(Object.fromEntries(dormitories.map((d) => [d.id, d.name])))

        // Highest-priority-first ordering (see BenefitFormPage's "Приоритет
        // салмағы"): each applicant's rank is the highest priority weight
        // among the benefits they hold, defaulting to 1 (lowest) if none.
        const priorityByBenefit = Object.fromEntries(benefits.map((b) => [b.id, b.priority]))
        const uniqueStudentIds = [...new Set(apps.map((a) => a.student_id))]
        const entries = await Promise.all(
          uniqueStudentIds.map(async (studentId) => {
            const studentBenefits = await listStudentBenefits(studentId).catch(() => [])
            const maxPriority = studentBenefits.reduce(
              (max, sb) => Math.max(max, priorityByBenefit[sb.benefit_id] ?? 1),
              1,
            )
            return [studentId, maxPriority] as const
          }),
        )
        if (!cancelled) setPriorityByStudent(Object.fromEntries(entries))
        if (!cancelled && activeTab === 'pending') markApplicationsSeenNow()
      })
      .catch((err) => {
        if (!cancelled) setError(extractErrorMessage(err, 'Өтініштерді жүктеу сәтсіз аяқталды'))
      })
    return () => {
      cancelled = true
    }
  }, [activeTab])

  const visibleApplications = useMemo(() => {
    if (!applications) return null
    const filtered = dormitoryFilter
      ? applications.filter((app) => app.dormitory_id === dormitoryFilter)
      : applications
    return [...filtered].sort((a, b) => {
      const priorityDiff = (priorityByStudent[b.student_id] ?? 1) - (priorityByStudent[a.student_id] ?? 1)
      if (priorityDiff !== 0) return priorityDiff
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    })
  }, [applications, dormitoryFilter, priorityByStudent])

  function handleDownload(app: Application) {
    downloadApplicationPdf({
      applicationId: app.id,
      studentFullName: namesById[app.student_id] ?? app.student_id,
      dormitoryName: dormitoryNamesById[app.dormitory_id] ?? app.dormitory_id,
      roomNumber: null,
      decidedAt: new Date(app.updated_at),
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-2xl text-sand-100">Өтініш кезегі</h1>

      <div className="flex gap-1 border-b border-sand-100/10">
        {TABS.map((tab) => (
          <button
            key={tab.status}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === tab.status
                ? 'border-b-2 border-turquoise-500 text-turquoise-400'
                : 'text-sand-300/60 hover:text-sand-100'
            }`}
            onClick={() => setActiveTab(tab.status)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && <Alert variant="error" message={error} />}
      {!error && !applications && <p className="text-sm text-sand-300/60">Жүктелуде...</p>}

      {applications && (
        <>
          <div className="max-w-xs">
            <Select
              label="Жатақхана бойынша сүзгі"
              value={dormitoryFilter}
              onChange={(e) => setDormitoryFilter(e.target.value)}
            >
              <option value="">Барлық жатақханалар</option>
              {Object.entries(dormitoryNamesById).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </Select>
          </div>

          <Card className="overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-sand-100/10 text-xs uppercase text-sand-300/60">
                <tr>
                  <th className="px-4 py-3">Студент</th>
                  <th className="px-4 py-3">Жатақхана</th>
                  <th className="px-4 py-3">Приоритет</th>
                  <th className="px-4 py-3">Құрылған күні</th>
                  <th className="px-4 py-3">Статус</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {visibleApplications?.map((app) => (
                  <tr
                    key={app.id}
                    className="cursor-pointer border-b border-sand-100/10 last:border-0 hover:bg-navy-950"
                    onClick={() => navigate(`/admin/applications/${app.id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-sand-100">
                      {namesById[app.student_id] ?? app.student_id}
                    </td>
                    <td className="px-4 py-3 text-sand-300/70">
                      {dormitoryNamesById[app.dormitory_id] ?? app.dormitory_id}
                    </td>
                    <td className="px-4 py-3 text-sand-300/70">
                      {priorityByStudent[app.student_id] ?? 1}
                    </td>
                    <td className="px-4 py-3 text-sand-300/70">
                      {new Date(app.created_at).toLocaleDateString('kk-KZ')}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={app.status} />
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      {app.status === 'approved' && (
                        <DownloadIconButton onClick={() => handleDownload(app)} />
                      )}
                    </td>
                  </tr>
                ))}
                {visibleApplications?.length === 0 && (
                  <tr>
                    <td className="px-4 py-3 text-sand-300/60" colSpan={6}>
                      Өтініш жоқ
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  )
}
