import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card } from '../../../components/Card'
import { Alert } from '../../../components/Alert'
import { StatusBadge } from '../../../components/StatusBadge'
import { Select } from '../../../components/Select'
import { Button } from '../../../components/Button'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { DownloadIconButton } from '../../../components/DownloadIconButton'
import { extractErrorMessage } from '../../../api/client'
import {
  approveGreenApplications,
  listApplicationTriage,
  listApplications,
  requestApplicationCorrections,
} from '../../../api/applicationAdminApi'
import { listDormitories } from '../../../api/dormitoryApi'
import { listUsers } from '../../../api/adminUserApi'
import { listBenefits, listStudentBenefits } from '../../../api/benefitApi'
import { downloadPetitionPdf } from '../../../utils/petitionPdf'
import { formatDate } from '../../../utils/dateFormat'
import { bilingualField } from '../../../utils/bilingualField'
import { markApplicationsSeenNow } from './applicationsSeen'
import { BulkDownloadDialog } from './BulkDownloadDialog'
import {
  adminCellClass,
  adminPageHeading,
  adminRowClickableClass,
  adminTableWrapClass,
  adminTheadClass,
} from '../adminTable'
import type {
  Application,
  ApplicationStatus,
  ApplicationTriage,
  BulkResult,
  TriageColor,
  TriageReason,
} from '../../../types/applications'
import type { User } from '../../../types'

const STATUSES: ApplicationStatus[] = ['pending', 'needs_correction', 'approved', 'rejected']

const TRIAGE_COLORS: TriageColor[] = ['green', 'yellow', 'red']

const triageChipClasses: Record<TriageColor, string> = {
  green: 'bg-mint-500/10 text-mint-400',
  yellow: 'bg-amber-500/10 text-amber-400',
  red: 'bg-clay-500/10 text-clay-400',
}

type BulkAction = 'approve' | 'correct'

export function ApplicationQueuePage() {
  const { t, i18n } = useTranslation()
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
  const [triageById, setTriageById] = useState<Record<string, ApplicationTriage>>({})
  const [triageFilter, setTriageFilter] = useState<TriageColor | 'all'>('all')
  const [pendingBulkAction, setPendingBulkAction] = useState<BulkAction | null>(null)
  const [bulkRunning, setBulkRunning] = useState(false)
  const [bulkResults, setBulkResults] = useState<{ action: BulkAction; results: BulkResult[] } | null>(null)
  const [bulkError, setBulkError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      ...STATUSES.map((s) => listApplications(s)),
      listUsers('student'),
      listDormitories(),
      listBenefits(),
      listApplicationTriage(),
    ])
      .then(async (results) => {
        if (cancelled) return
        const apps = (results.slice(0, STATUSES.length) as Application[][]).flat()
        const students = results[STATUSES.length] as Awaited<ReturnType<typeof listUsers>>
        const dormitories = results[STATUSES.length + 1] as Awaited<ReturnType<typeof listDormitories>>
        const benefits = results[STATUSES.length + 2] as Awaited<ReturnType<typeof listBenefits>>
        const triage = results[STATUSES.length + 3] as ApplicationTriage[]

        setApplications(apps)
        setTriageById(Object.fromEntries(triage.map((tr) => [tr.application_id, tr])))
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
  }, [reloadKey])

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

  // Triage only exists for pending applications, so its filter and bulk
  // actions only apply while the "new" status tab is selected.
  const showTriage = activeFilter === 'pending'

  const triageCounts = useMemo(() => {
    const c: Record<TriageColor | 'all', number> = { all: 0, green: 0, yellow: 0, red: 0 }
    applications?.forEach((a) => {
      const tr = triageById[a.id]
      if (a.status !== 'pending' || !tr) return
      if (dormitoryFilter && a.dormitory_id !== dormitoryFilter) return
      c.all += 1
      c[tr.color] += 1
    })
    return c
  }, [applications, triageById, dormitoryFilter])

  const visibleApplications = useMemo(() => {
    if (!applications) return null
    let filtered = activeFilter === 'all' ? applications : applications.filter((a) => a.status === activeFilter)
    if (dormitoryFilter) filtered = filtered.filter((app) => app.dormitory_id === dormitoryFilter)
    if (showTriage && triageFilter !== 'all') {
      filtered = filtered.filter((app) => triageById[app.id]?.color === triageFilter)
    }
    const dir = sortDirection === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      if (sortField === 'priority') {
        const priorityDiff = ((priorityByStudent[a.student_id] ?? 1) - (priorityByStudent[b.student_id] ?? 1)) * dir
        if (priorityDiff !== 0) return priorityDiff
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      }
      return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir
    })
  }, [applications, activeFilter, dormitoryFilter, showTriage, triageFilter, triageById, priorityByStudent, sortField, sortDirection])

  // Bulk actions cover every pending application of the matching color
  // (respecting the dormitory filter), not just the ones the color filter
  // currently shows.
  function bulkTargets(color: TriageColor): Application[] {
    return (applications ?? []).filter(
      (a) =>
        a.status === 'pending' &&
        triageById[a.id]?.color === color &&
        (!dormitoryFilter || a.dormitory_id === dormitoryFilter),
    )
  }

  async function runBulkAction() {
    if (!pendingBulkAction) return
    const action = pendingBulkAction
    const ids = bulkTargets(action === 'approve' ? 'green' : 'yellow').map((a) => a.id)
    setBulkRunning(true)
    setBulkError(null)
    setBulkResults(null)
    try {
      const results =
        action === 'approve' ? await approveGreenApplications(ids) : await requestApplicationCorrections(ids)
      setBulkResults({ action, results })
      setReloadKey((k) => k + 1)
    } catch (err) {
      setBulkError(extractErrorMessage(err, t('admin.applications.triage.bulkFailed')))
    } finally {
      setBulkRunning(false)
      setPendingBulkAction(null)
    }
  }

  function reasonText(reason: TriageReason): string {
    return t(`admin.applications.triage.reasons.${reason.code}`, {
      doc: bilingualField(reason.document_name_kk ?? '', reason.document_name_ru ?? '', i18n.language),
      detail: reason.detail ?? '',
    })
  }

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

      {showTriage && applications && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-navy-700 bg-navy-900 px-4 py-3">
          <div className="flex flex-wrap gap-2">
            {(['all', ...TRIAGE_COLORS] as const).map((color) => (
              <button
                key={color}
                onClick={() => setTriageFilter(color)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold whitespace-nowrap ${
                  triageFilter === color
                    ? 'border-turquoise-500 bg-turquoise-500/10 text-turquoise-400'
                    : 'border-navy-700 bg-navy-950 text-sand-300 hover:text-sand-100'
                }`}
              >
                {t(`admin.applications.triage.${color}`)} ({triageCounts[color]})
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={triageCounts.yellow === 0}
              onClick={() => setPendingBulkAction('correct')}
            >
              {t('admin.applications.triage.requestCorrectionsButton', { count: triageCounts.yellow })}
            </Button>
            <Button disabled={triageCounts.green === 0} onClick={() => setPendingBulkAction('approve')}>
              {t('admin.applications.triage.approveGreenButton', { count: triageCounts.green })}
            </Button>
          </div>
        </div>
      )}

      {bulkError && <Alert variant="error" message={bulkError} />}
      {bulkResults && (
        <Alert
          variant={bulkResults.results.every((r) => r.ok) ? 'success' : 'warning'}
          message={[
            t(
              bulkResults.action === 'approve'
                ? 'admin.applications.triage.approvedSummary'
                : 'admin.applications.triage.correctionsSummary',
              {
                done: bulkResults.results.filter((r) => r.ok).length,
                skipped: bulkResults.results.filter((r) => !r.ok).length,
              },
            ),
            ...bulkResults.results
              .filter((r) => !r.ok)
              .map((r) => {
                const app = applications?.find((a) => a.id === r.application_id)
                const name = app ? namesById[app.student_id] ?? app.student_id : r.application_id
                return `${name}: ${r.error ?? ''}`
              }),
          ].join('\n')}
        />
      )}

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
                  {showTriage && <th className={adminCellClass}>{t('admin.applications.triage.column')}</th>}
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
                    {showTriage && (
                      <td className={adminCellClass}>
                        {triageById[app.id] && (
                          <div className="flex flex-col items-start gap-1">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                                triageChipClasses[triageById[app.id].color]
                              }`}
                            >
                              {t(`admin.applications.triage.${triageById[app.id].color}`)}
                            </span>
                            {triageById[app.id].checking && (
                              <span className="text-xs text-turquoise-400">{t('admin.applications.triage.checking')}</span>
                            )}
                            {triageById[app.id].reasons.map((reason, i) => (
                              <span key={i} className="text-xs text-sand-300">
                                {reasonText(reason)}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    )}
                    <td className={adminCellClass} onClick={(e) => e.stopPropagation()}>
                      {app.status === 'approved' && <DownloadIconButton onClick={() => handleDownload(app)} />}
                    </td>
                  </tr>
                ))}
                {visibleApplications?.length === 0 && (
                  <tr>
                    <td className={`${adminCellClass} text-sand-300`} colSpan={showTriage ? 7 : 6}>
                      {t('admin.applications.empty')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </>
      )}

      <ConfirmDialog
        open={pendingBulkAction !== null}
        title={t(
          pendingBulkAction === 'approve'
            ? 'admin.applications.triage.approveGreenTitle'
            : 'admin.applications.triage.requestCorrectionsTitle',
        )}
        message={t(
          pendingBulkAction === 'approve'
            ? 'admin.applications.triage.approveGreenConfirm'
            : 'admin.applications.triage.requestCorrectionsConfirm',
          { count: pendingBulkAction === 'approve' ? triageCounts.green : triageCounts.yellow },
        )}
        isLoading={bulkRunning}
        onConfirm={runBulkAction}
        onCancel={() => setPendingBulkAction(null)}
      />

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
