import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { DeleteIconButton } from '../../../components/DeleteIconButton'
import { ReportStatusBadge } from '../../../components/ReportStatusBadge'
import { extractErrorMessage } from '../../../api/client'
import { deleteReport, getReportDetail, listReports } from '../../../api/reportApi'
import { listReportTemplates } from '../../../api/reportTemplateApi'
import {
  adminCellClass,
  adminPageHeading,
  adminRowClickableClass,
  adminTableWrapClass,
  adminTheadClass,
} from '../adminTable'
import { formatDate } from '../../../utils/dateFormat'
import type { Report } from '../../../types/reports'

interface Row extends Report {
  templateName: string
  studentCount: number
}

export function ReportListPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  function load() {
    Promise.all([listReports(), listReportTemplates()])
      .then(async ([reports, templates]) => {
        const templateNamesById = Object.fromEntries(templates.map((t) => [t.id, t.name]))
        const withDetail = await Promise.all(
          reports.map(async (r) => {
            const detail = await getReportDetail(r.id).catch(() => null)
            return {
              ...r,
              templateName: templateNamesById[r.template_id] ?? r.template_id,
              studentCount: detail?.students.length ?? 0,
            }
          }),
        )
        setRows(withDetail)
      })
      .catch((err) => {
        setError(extractErrorMessage(err, t('admin.reports.loadError')))
      })
  }

  useEffect(load, [])

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleteError(null)
    setIsDeleting(true)
    try {
      await deleteReport(deleteTarget.id)
      setDeleteTarget(null)
      load()
    } catch (err) {
      setDeleteError(extractErrorMessage(err, t('admin.reports.deleteFailed')))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <h1 className={adminPageHeading}>{t('admin.layout.reports')}</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate('/admin/reports/templates')}>
            {t('admin.reports.templates')}
          </Button>
          <Button onClick={() => navigate('/admin/reports/new')}>{t('admin.reports.newReport')}</Button>
        </div>
      </div>

      {error && <Alert variant="error" message={error} />}
      {deleteError && <Alert variant="error" message={deleteError} />}
      {!error && !rows && <p className="text-sm text-sand-300">{t('admin.common.loading')}</p>}

      {rows && (
        <Card className={adminTableWrapClass}>
          <table className="w-full text-left text-sm">
            <thead className={adminTheadClass}>
              <tr>
                <th className={adminCellClass}>{t('admin.reports.createdAt')}</th>
                <th className={adminCellClass}>{t('admin.reports.template')}</th>
                <th className={adminCellClass}>{t('admin.reports.studentCount')}</th>
                <th className={adminCellClass}>{t('admin.applications.status')}</th>
                <th className={adminCellClass} />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={adminRowClickableClass} onClick={() => navigate(`/admin/reports/${r.id}`)}>
                  <td className={`${adminCellClass} text-sand-300`}>
                    {formatDate(r.created_at)}
                  </td>
                  <td className={`${adminCellClass} font-semibold text-sand-100`}>{r.templateName}</td>
                  <td className={`${adminCellClass} text-sand-300`}>{r.studentCount}</td>
                  <td className={adminCellClass}>
                    <ReportStatusBadge status={r.status} />
                  </td>
                  <td className={adminCellClass} onClick={(e) => e.stopPropagation()}>
                    <DeleteIconButton onClick={() => setDeleteTarget(r)} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className={`${adminCellClass} text-sand-300`} colSpan={5}>
                    {t('admin.reports.empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      )}

      <ConfirmDialog
        open={deleteTarget != null}
        title={t('admin.reports.deleteTitle')}
        message={t('admin.reports.deleteConfirm')}
        danger
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
