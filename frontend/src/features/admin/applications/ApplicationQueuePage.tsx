import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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
import { formatDate } from '../../../utils/dateFormat'
import { markApplicationsSeenNow } from './applicationsSeen'
import {
  adminCellClass,
  adminPageHeading,
  adminRowClickableClass,
  adminTableWrapClass,
  adminTheadClass,
} from '../adminTable'
import type { Application, ApplicationStatus } from '../../../types/applications'

const STATUSES: ApplicationStatus[] = ['pending', 'needs_correction', 'approved', 'rejected']

export function ApplicationQueuePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const STATUS_LABELS: Record<ApplicationStatus | 'all', string> = {
    all: t('admin.applications.statusAll'),
    pending: t('admin.applications.statusNew'),
    needs_correction: t('admin.applications.statusCorrection'),
    approved: t('status.approved'),
    rejected: t('admin.applications.statusRejected'),
    manager_review: t('status.manager_review'),
    settled: t('status.settled'),
  }
  const [activeFilter, setActiveFilter] = useState<ApplicationStatus | 'all'>('all')
  const [applications, setApplications] = useState<Application[] | null>(null)
  const [namesById, setNamesById] = useState<Record<string, string>>({})
  const [dormitoryNamesById, setDormitoryNamesById] = useState<Record<string, string>>({})
  const [priorityByStudent, setPriorityByStudent] = useState<Record<string, number>>({})
  const [dormitoryFilter, setDormitoryFilter] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      ...STATUSES.map((s) => listApplications(s)),
      listUsers('student'),
      listDormitories(),
      listBenefits(),
    ])
      .then(async (results) => {
        if (cancelled) return
        const apps = (results.slice(0, STATUSES.length) as Application[][]).flat()
        const students = results[STATUSES.length] as Awaited<ReturnType<typeof listUsers>>
        const dormitories = results[STATUSES.length + 1] as Awaited<ReturnType<typeof listDormitories>>
        const benefits = results[STATUSES.length + 2] as Awaited<ReturnType<typeof listBenefits>>

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
        if (!cancelled) markApplicationsSeenNow()
      })
      .catch((err) => {
        if (!cancelled) setError(extractErrorMessage(err, t('admin.applications.loadError')))
      })
    return () => {
      cancelled = true
    }
  }, [])

  const counts = useMemo(() => {
    const c: Record<ApplicationStatus | 'all', number> = {
      all: applications?.length ?? 0,
      pending: 0,
      needs_correction: 0,
      approved: 0,
      rejected: 0,
      manager_review: 0,
      settled: 0,
    }
    applications?.forEach((a) => {
      c[a.status] += 1
    })
    return c
  }, [applications])

  const visibleApplications = useMemo(() => {
    if (!applications) return null
    let filtered = activeFilter === 'all' ? applications : applications.filter((a) => a.status === activeFilter)
    if (dormitoryFilter) filtered = filtered.filter((app) => app.dormitory_id === dormitoryFilter)
    return [...filtered].sort((a, b) => {
      const priorityDiff = (priorityByStudent[b.student_id] ?? 1) - (priorityByStudent[a.student_id] ?? 1)
      if (priorityDiff !== 0) return priorityDiff
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    })
  }, [applications, activeFilter, dormitoryFilter, priorityByStudent])

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
    <div className="flex flex-col gap-3.5">
      <h1 className={adminPageHeading}>{t('admin.layout.applications')}</h1>

      <div className="flex flex-wrap gap-2">
        {(['all', ...STATUSES] as const).map((status) => (
          <button
            key={status}
            onClick={() => setActiveFilter(status)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold whitespace-nowrap ${
              activeFilter === status
                ? 'border-turquoise-500 bg-turquoise-500/10 text-turquoise-400'
                : 'border-navy-700 bg-navy-900 text-sand-300 hover:text-sand-100'
            }`}
          >
            {STATUS_LABELS[status]} ({counts[status]})
          </button>
        ))}
      </div>

      {error && <Alert variant="error" message={error} />}
      {!error && !applications && <p className="text-sm text-sand-300">{t('admin.common.loading')}</p>}

      {applications && (
        <>
          <div className="max-w-xs">
            <Select
              label={t('admin.applications.dormitoryFilter')}
              value={dormitoryFilter}
              onChange={(e) => setDormitoryFilter(e.target.value)}
            >
              <option value="">{t('admin.applications.allDormitories')}</option>
              {Object.entries(dormitoryNamesById).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </Select>
          </div>

          <Card className={adminTableWrapClass}>
            <table className="w-full text-left text-sm">
              <thead className={adminTheadClass}>
                <tr>
                  <th className={adminCellClass}>{t('admin.applications.student')}</th>
                  <th className={adminCellClass}>{t('admin.layout.dormitories')}</th>
                  <th className={adminCellClass}>{t('admin.applications.priority')}</th>
                  <th className={adminCellClass}>{t('admin.applications.date')}</th>
                  <th className={adminCellClass}>{t('admin.applications.status')}</th>
                  <th className={adminCellClass} />
                </tr>
              </thead>
              <tbody>
                {visibleApplications?.map((app) => (
                  <tr
                    key={app.id}
                    className={adminRowClickableClass}
                    onClick={() => navigate(`/admin/applications/${app.id}`)}
                  >
                    <td className={`${adminCellClass} font-semibold text-sand-100`}>
                      {namesById[app.student_id] ?? app.student_id}
                    </td>
                    <td className={`${adminCellClass} text-sand-300`}>
                      {dormitoryNamesById[app.dormitory_id] ?? app.dormitory_id}
                    </td>
                    <td className={`${adminCellClass} text-sand-300`}>
                      {priorityByStudent[app.student_id] ?? 1}
                    </td>
                    <td className={`${adminCellClass} text-sand-300`}>
                      {formatDate(app.created_at)}
                    </td>
                    <td className={adminCellClass}>
                      <StatusBadge status={app.status} />
                    </td>
                    <td className={adminCellClass} onClick={(e) => e.stopPropagation()}>
                      {app.status === 'approved' && <DownloadIconButton onClick={() => handleDownload(app)} />}
                    </td>
                  </tr>
                ))}
                {visibleApplications?.length === 0 && (
                  <tr>
                    <td className={`${adminCellClass} text-sand-300`} colSpan={6}>
                      {t('admin.applications.empty')}
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
