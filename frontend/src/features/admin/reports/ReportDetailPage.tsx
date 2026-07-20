import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { ReportSummaryCards } from '../../../components/ReportSummaryCards'
import { extractErrorMessage } from '../../../api/client'
import { getReportDetail, reviseReport } from '../../../api/reportApi'
import { downloadReportPdf } from '../../../utils/reportPdf'
import type { ReportDetail } from '../../../types/reports'

export function ReportDetailPage() {
  const { t } = useTranslation()
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
      .catch((err) => setLoadError(extractErrorMessage(err, t('admin.common.loadError'))))
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
      setReviseError(extractErrorMessage(err, t('admin.reports.reviseFailed')))
    } finally {
      setIsRevising(false)
    }
  }

  async function handleExport() {
    if (!report) return
    setExportError(null)
    setIsExporting(true)
    try {
      await downloadReportPdf(report, t)
    } catch (err) {
      setExportError(extractErrorMessage(err, t('admin.reports.exportFailed')))
    } finally {
      setIsExporting(false)
    }
  }

  if (loadError) return <Alert variant="error" message={loadError} />
  if (!report) return <p className="text-sm text-sand-300">{t('admin.common.loading')}</p>

  return (
    <div className="flex flex-col gap-6">
      <Button variant="secondary" className="self-start" onClick={() => navigate('/admin/reports')}>
        ← {t('admin.common.back')}
      </Button>

      <ReportSummaryCards report={report} />

      {report.status === 'rejected' && (
        <Card title={t('admin.reports.reviseTitle')}>
          {reviseError && <Alert variant="error" message={reviseError} />}
          <ul className="mb-4 flex flex-col gap-2">
            {report.students.map((s) => (
              <li key={s.application_id}>
                <label className="flex items-center gap-2 text-sm text-sand-200">
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
            {t('admin.reports.sendForRevision')}
          </Button>
        </Card>
      )}

      {report.status === 'approved' && (
        <Card title={t('admin.reports.exportTitle')}>
          {exportError && <Alert variant="error" message={exportError} />}
          <Button onClick={handleExport} isLoading={isExporting}>
            {t('admin.reports.exportTitle')}
          </Button>
        </Card>
      )}
    </div>
  )
}
