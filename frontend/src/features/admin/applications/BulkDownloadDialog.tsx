import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../../components/Button'
import { Select } from '../../../components/Select'
import { Input } from '../../../components/Input'
import { Alert } from '../../../components/Alert'
import { StatusBadge } from '../../../components/StatusBadge'
import { extractErrorMessage } from '../../../api/client'
import { formatDate } from '../../../utils/dateFormat'
import { downloadPetitionsBulkPdf } from '../../../utils/petitionPdf'
import type { Application, ApplicationStatus } from '../../../types/applications'
import type { User } from '../../../types'

const STATUSES: ApplicationStatus[] = ['pending', 'needs_correction', 'approved', 'rejected']

type SortField = 'date' | 'priority'
type SortDirection = 'asc' | 'desc'

interface BulkDownloadDialogProps {
  open: boolean
  onClose: () => void
  applications: Application[]
  namesById: Record<string, string>
  studentsById: Record<string, User>
  dormitoryNamesById: Record<string, string>
  priorityByStudent: Record<string, number>
  statusLabels: Record<ApplicationStatus | 'all', string>
}

// Manager-facing "download applications" dialog: filters the full applicant
// pool by time period / status / dormitory, lets the manager pick a sort
// order and a subset of students, then merges every selected student's
// petition into one downloadable PDF (see downloadPetitionsBulkPdf).
export function BulkDownloadDialog({
  open,
  onClose,
  applications,
  namesById,
  studentsById,
  dormitoryNamesById,
  priorityByStudent,
  statusLabels,
}: BulkDownloadDialogProps) {
  const { t } = useTranslation()
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | 'all'>('all')
  const [dormitoryFilter, setDormitoryFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isDownloading, setIsDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset the picker each time the dialog is (re)opened rather than leaving
  // a stale selection/error from the previous open.
  useEffect(() => {
    if (open) {
      setSelectedIds(new Set())
      setError(null)
    }
  }, [open])

  function sortApps(list: Application[]): Application[] {
    const dir = sortDirection === 'asc' ? 1 : -1
    return [...list].sort((a, b) => {
      if (sortField === 'priority') {
        return ((priorityByStudent[a.student_id] ?? 1) - (priorityByStudent[b.student_id] ?? 1)) * dir
      }
      return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir
    })
  }

  const filtered = useMemo(() => {
    let list = applications
    if (statusFilter !== 'all') list = list.filter((a) => a.status === statusFilter)
    if (dormitoryFilter) list = list.filter((a) => a.dormitory_id === dormitoryFilter)
    if (dateFrom) {
      const from = new Date(dateFrom).getTime()
      list = list.filter((a) => new Date(a.created_at).getTime() >= from)
    }
    if (dateTo) {
      // Include the entire end day, not just its midnight instant.
      const to = new Date(dateTo).getTime() + 24 * 60 * 60 * 1000 - 1
      list = list.filter((a) => new Date(a.created_at).getTime() <= to)
    }
    return sortApps(list)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applications, statusFilter, dormitoryFilter, dateFrom, dateTo, sortField, sortDirection, priorityByStudent])

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      const allVisibleSelected = filtered.length > 0 && filtered.every((a) => prev.has(a.id))
      const next = new Set(prev)
      filtered.forEach((a) => (allVisibleSelected ? next.delete(a.id) : next.add(a.id)))
      return next
    })
  }

  async function handleDownload() {
    const selected = sortApps(applications.filter((a) => selectedIds.has(a.id)))
    if (selected.length === 0) return
    setError(null)
    setIsDownloading(true)
    try {
      const values = selected.map((app) => {
        const student = studentsById[app.student_id]
        return {
          full_name: student?.full_name ?? namesById[app.student_id] ?? app.student_id,
          study_group: app.study_group,
          hometown: app.hometown,
          phone_self: student?.phone ?? '',
          parent_contact: app.parent_contact,
          dormitory_name: dormitoryNamesById[app.dormitory_id] ?? app.dormitory_id,
          date: formatDate(app.created_at),
        }
      })
      await downloadPetitionsBulkPdf(values, `applications-${new Date().toISOString().slice(0, 10)}.pdf`)
      onClose()
    } catch (err) {
      setError(extractErrorMessage(err, t('admin.applications.bulkDownloadFailed')))
    } finally {
      setIsDownloading(false)
    }
  }

  if (!open) return null

  const allVisibleSelected = filtered.length > 0 && filtered.every((a) => selectedIds.has(a.id))

  function sortIndicator(field: SortField) {
    if (sortField !== field) return null
    return <span className="text-turquoise-400">{sortDirection === 'asc' ? ' ▲' : ' ▼'}</span>
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/70 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-[20px] bg-navy-900 p-6 shadow-[var(--shadow-card)]">
        <h2 className="font-heading text-lg text-sand-100">{t('admin.applications.bulkDownloadTitle')}</h2>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Select
            label={t('admin.applications.status')}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ApplicationStatus | 'all')}
          >
            <option value="all">{statusLabels.all}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabels[s]}
              </option>
            ))}
          </Select>
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
          <Input
            label={t('admin.applications.bulkDownloadDateFrom')}
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <Input
            label={t('admin.applications.bulkDownloadDateTo')}
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>

        {error && (
          <div className="mt-3">
            <Alert variant="error" message={error} />
          </div>
        )}

        <div className="mt-4 flex-1 overflow-y-auto rounded-[14px] border border-navy-700">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 border-b border-navy-700 bg-navy-900 text-xs font-semibold tracking-wide text-sand-300 uppercase">
              <tr>
                <th className="px-4 py-3">
                  <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} />
                </th>
                <th className="px-4 py-3">{t('admin.applications.student')}</th>
                <th className="px-4 py-3">{t('admin.layout.dormitories')}</th>
                <th
                  className="cursor-pointer select-none px-4 py-3 hover:text-sand-100"
                  onClick={() => toggleSort('priority')}
                >
                  {t('admin.applications.priority')}
                  {sortIndicator('priority')}
                </th>
                <th
                  className="cursor-pointer select-none px-4 py-3 hover:text-sand-100"
                  onClick={() => toggleSort('date')}
                >
                  {t('admin.applications.date')}
                  {sortIndicator('date')}
                </th>
                <th className="px-4 py-3">{t('admin.applications.status')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((app) => (
                <tr key={app.id} className="border-b border-navy-700 last:border-0">
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selectedIds.has(app.id)} onChange={() => toggleSelected(app.id)} />
                  </td>
                  <td className="px-4 py-3 font-semibold text-sand-100">
                    {namesById[app.student_id] ?? app.student_id}
                  </td>
                  <td className="px-4 py-3 text-sand-300">
                    {dormitoryNamesById[app.dormitory_id] ?? app.dormitory_id}
                  </td>
                  <td className="px-4 py-3 text-sand-300">{priorityByStudent[app.student_id] ?? 1}</td>
                  <td className="px-4 py-3 text-sand-300">{formatDate(app.created_at)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={app.status} />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td className="px-4 py-3 text-sand-300" colSpan={6}>
                    {t('admin.applications.empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <span className="text-sm text-sand-300">
            {t('admin.applications.bulkDownloadSelected', { count: selectedIds.size })}
          </span>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={onClose} disabled={isDownloading}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleDownload} isLoading={isDownloading} disabled={selectedIds.size === 0}>
              {t('admin.applications.bulkDownloadButton')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
