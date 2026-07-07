import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { ReportSummaryCards } from '../../../components/ReportSummaryCards'
import { extractErrorMessage } from '../../../api/client'
import { exportReport, getReportDetail, reviseReport } from '../../../api/reportApi'
import type { ReportDetail } from '../../../types/reports'

function downloadJSON(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function ReportDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [report, setReport] = useState<ReportDetail | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [keptIds, setKeptIds] = useState<Set<string>>(new Set())
  const [reviseError, setReviseError] = useState<string | null>(null)
  const [isRevising, setIsRevising] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  function load() {
    if (!id) return
    getReportDetail(id)
      .then((r) => {
        setReport(r)
        setKeptIds(new Set(r.students.map((s) => s.application_id)))
      })
      .catch((err) => setLoadError(extractErrorMessage(err, 'Жүктеу сәтсіз аяқталды')))
  }

  useEffect(load, [id])

  function toggleKept(applicationId: string) {
    setKeptIds((prev) => {
      const next = new Set(prev)
      if (next.has(applicationId)) next.delete(applicationId)
      else next.add(applicationId)
      return next
    })
  }

  async function handleRevise() {
    if (!id || keptIds.size === 0) return
    setReviseError(null)
    setIsRevising(true)
    try {
      const revised = await reviseReport(id, Array.from(keptIds))
      navigate(`/admin/reports/${revised.id}`)
    } catch (err) {
      setReviseError(extractErrorMessage(err, 'Қайта қарау сәтсіз аяқталды'))
    } finally {
      setIsRevising(false)
    }
  }

  async function handleExport() {
    if (!id) return
    setExportError(null)
    setIsExporting(true)
    try {
      const detail = await exportReport(id)
      downloadJSON(`report-${id}.json`, detail)
    } catch (err) {
      setExportError(extractErrorMessage(err, 'Выгрузка сәтсіз аяқталды'))
    } finally {
      setIsExporting(false)
    }
  }

  if (loadError) return <Alert variant="error" message={loadError} />
  if (!report) return <p className="text-sm text-gray-500">Жүктелуде...</p>

  return (
    <div className="flex flex-col gap-6">
      <ReportSummaryCards report={report} />

      {report.status === 'rejected' && (
        <Card title="Рапортты қайта қарау">
          {reviseError && <Alert variant="error" message={reviseError} />}
          <ul className="mb-4 flex flex-col gap-2">
            {report.students.map((s) => (
              <li key={s.application_id}>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={keptIds.has(s.application_id)}
                    onChange={() => toggleKept(s.application_id)}
                  />
                  {s.student_full_name}
                </label>
              </li>
            ))}
          </ul>
          <Button onClick={handleRevise} isLoading={isRevising} disabled={keptIds.size === 0}>
            Қайта қарауға жіберу
          </Button>
        </Card>
      )}

      {report.status === 'approved' && (
        <Card title="Выгрузка">
          {exportError && <Alert variant="error" message={exportError} />}
          <Button onClick={handleExport} isLoading={isExporting}>
            Выгрузка
          </Button>
        </Card>
      )}
    </div>
  )
}
