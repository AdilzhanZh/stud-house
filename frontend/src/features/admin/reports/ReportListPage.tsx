import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '../../../components/Card'
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
import type { Report } from '../../../types/reports'

interface Row extends Report {
  templateName: string
  studentCount: number
}

export function ReportListPage() {
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
        setError(extractErrorMessage(err, 'Рапорттарды жүктеу сәтсіз аяқталды'))
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
      setDeleteError(extractErrorMessage(err, 'Рапортты өшіру сәтсіз аяқталды'))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-3.5">
      <h1 className={adminPageHeading}>Рапорттар</h1>

      {error && <Alert variant="error" message={error} />}
      {deleteError && <Alert variant="error" message={deleteError} />}
      {!error && !rows && <p className="text-sm text-sand-300">Жүктелуде...</p>}

      {rows && (
        <Card className={adminTableWrapClass}>
          <table className="w-full text-left text-sm">
            <thead className={adminTheadClass}>
              <tr>
                <th className={adminCellClass}>Құрылған күні</th>
                <th className={adminCellClass}>Шаблон</th>
                <th className={adminCellClass}>Студенттер саны</th>
                <th className={adminCellClass}>Статус</th>
                <th className={adminCellClass} />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={adminRowClickableClass} onClick={() => navigate(`/admin/reports/${r.id}`)}>
                  <td className={`${adminCellClass} text-sand-300`}>
                    {new Date(r.created_at).toLocaleDateString('kk-KZ')}
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
                    Рапорт жоқ
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      )}

      <ConfirmDialog
        open={deleteTarget != null}
        title="Рапортты өшіру"
        message="Бұл рапортты өшіргіңіз келе ме? Бұл әрекетті қайтару мүмкін емес."
        danger
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
