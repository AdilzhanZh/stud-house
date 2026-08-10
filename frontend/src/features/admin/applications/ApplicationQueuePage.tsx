import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card } from '../../../components/Card'
import { Alert } from '../../../components/Alert'
import { StatusBadge } from '../../../components/StatusBadge'
import { Select } from '../../../components/Select'
import { Button } from '../../../components/Button'
import { DownloadIconButton } from '../../../components/DownloadIconButton'
import { extractErrorMessage } from '../../../api/client'
import { listApplications } from '../../../api/applicationAdminApi'
import { listDormitories } from '../../../api/dormitoryApi'
import { listUsers } from '../../../api/adminUserApi'
import { listBenefits, listStudentBenefits } from '../../../api/benefitApi'
import { downloadPetitionPdf } from '../../../utils/petitionPdf'
import { formatDate } from '../../../utils/dateFormat'
import { markApplicationsSeenNow } from './applicationsSeen'
import { BulkDownloadDialog } from './BulkDownloadDialog'
import {
  adminCellClass,
  adminPageHeading,
  adminRowClickableClass,
  adminTableWrapClass,
  adminTheadClass,
} from '../adminTable'
import type { Application, ApplicationStatus } from '../../../types/applications'
import type { User } from '../../../types'

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
  const [studentsById, setStudentsById] = useState<Record<string, User>>({})
  const [dormitoryNamesById, setDormitoryNamesById] = useState<Record<string, string>>({})
  const [priorityByStudent, setPriorityByStudent] = useState<Record<string, number>>({})
  const [dormitoryFilter, setDormitoryFilter] = useState('')
  const [sortField, setSortField] = useState<'priority' | 'date'>('priority')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [error, setError] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false)

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
        setStudentsById(Object.fromEntries(students.map((s) => [s.id, s])))
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
    const dir = sortDirection === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      if (sortField === 'priority') {
        const priorityDiff = ((priorityByStudent[a.student_id] ?? 1) - (priorityByStudent[b.student_id] ?? 1)) * dir
        if (priorityDiff !== 0) return priorityDiff
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      }
      return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir
    })
  }, [applications, activeFilter, dormitoryFilter, priorityByStudent, sortField, sortDirection])

  function toggleSort(field: 'priority' | 'date') {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  function sortIndicator(field: 'priority' | 'date') {
    if (sortField !== field) return null
    return <span className="text-turquoise-400">{sortDirection === 'asc' ? ' ▲' : ' ▼'}</span>
  }

  async function handleDownload(app: Application) {
    setDownloadError(null)
    const student = studentsById[app.student_id]
    try {
      await downloadPetitionPdf(
        {
          full_name: student?.full_name ?? namesById[app.student_id] ?? app.student_id,
          study_group: app.study_group,
          hometown: app.hometown,
          phone_self: student?.phone ?? '',
          parent_contact: app.parent_contact,
          dormitory_name: dormitoryNamesById[app.dormitory_id] ?? app.dormitory_id,
          date: formatDate(app.created_at),
        },
        `otinish-${app.id}.pdf`,
      )
    } catch (err) {
      setDownloadError(extractErrorMessage(err, t('admin.applications.petitionDownloadFailed')))
    }
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between gap-3">
        <h1 className={adminPageHeading}>{t('admin.layout.applications')}</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setBulkDialogOpen(true)} disabled={!applications}>
            {t('admin.applications.downloadApplicationsButton')}
          </Button>
          <Button variant="secondary" onClick={() => navigate('/admin/applications/petition-template')}>
            {t('admin.applications.petitionTemplateButton')}
          </Button>
        </div>
      </div>

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
      {downloadError && <Alert variant="error" message={downloadError} />}
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
                  <th
                    className={`${adminCellClass} cursor-pointer select-none hover:text-sand-100`}
                    onClick={() => toggleSort('priority')}
                  >
                    {t('admin.applications.priority')}
                    {sortIndicator('priority')}
                  </th>
                  <th
                    className={`${adminCellClass} cursor-pointer select-none hover:text-sand-100`}
                    onClick={() => toggleSort('date')}
                  >
                    {t('admin.applications.date')}
                    {sortIndicator('date')}
                  </th>
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

      {applications && (
        <BulkDownloadDialog
          open={bulkDialogOpen}
          onClose={() => setBulkDialogOpen(false)}
          applications={applications}
          namesById={namesById}
          studentsById={studentsById}
          dormitoryNamesById={dormitoryNamesById}
          priorityByStudent={priorityByStudent}
          statusLabels={STATUS_LABELS}
        />
      )}
    </div>
  )
}
