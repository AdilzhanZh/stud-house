import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { ReportStatusBadge } from '../../../components/ReportStatusBadge'
import { extractErrorMessage } from '../../../api/client'
import { getReportDetail, listReports } from '../../../api/reportApi'
import { listReportTemplates } from '../../../api/reportTemplateApi'
import type { Report } from '../../../types/reports'

interface Row extends Report {
  templateName: string
  studentCount: number
}

export function ReportListPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
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
        if (!cancelled) setRows(withDetail)
      })
      .catch((err) => {
        if (!cancelled) setError(extractErrorMessage(err, 'Рапорттарды жүктеу сәтсіз аяқталды'))
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Рапорттар</h1>
        <Button onClick={() => navigate('/admin/reports/new')}>Жаңа рапорт</Button>
      </div>

      {error && <Alert variant="error" message={error} />}
      {!error && !rows && <p className="text-sm text-gray-500">Жүктелуде...</p>}

      {rows && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Құрылған күні</th>
                <th className="px-4 py-3">Шаблон</th>
                <th className="px-4 py-3">Студенттер саны</th>
                <th className="px-4 py-3">Статус</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="cursor-pointer border-b border-gray-100 last:border-0 hover:bg-gray-50"
                  onClick={() => navigate(`/admin/reports/${r.id}`)}
                >
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(r.created_at).toLocaleDateString('kk-KZ')}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{r.templateName}</td>
                  <td className="px-4 py-3 text-gray-600">{r.studentCount}</td>
                  <td className="px-4 py-3">
                    <ReportStatusBadge status={r.status} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="px-4 py-3 text-gray-500" colSpan={4}>
                    Рапорт жоқ
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
