import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { extractErrorMessage } from '../../../api/client'
import { listApplications } from '../../../api/applicationAdminApi'
import { listReportTemplates } from '../../../api/reportTemplateApi'
import { createReport, getReportDetail, listReports } from '../../../api/reportApi'
import { listUsers } from '../../../api/adminUserApi'
import { listDormitories } from '../../../api/dormitoryApi'
import type { Application } from '../../../types/applications'
import type { ReportTemplate } from '../../../types/reports'

export function ReportBuilderPage() {
  const navigate = useNavigate()

  const [templates, setTemplates] = useState<ReportTemplate[]>([])
  const [templateId, setTemplateId] = useState('')
  const [availableApps, setAvailableApps] = useState<Application[] | null>(null)
  const [namesById, setNamesById] = useState<Record<string, string>>({})
  const [dormitoryNamesById, setDormitoryNamesById] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    // No backend filter for "approved and not already in a report" exists
    // (see backend/README.md's kezeng-5 note) — computed here by fetching
    // every pending_committee report's application_ids and excluding them.
    Promise.all([
      listReportTemplates(),
      listApplications('approved'),
      listReports('pending_committee'),
      listUsers('student'),
      listDormitories(),
    ])
      .then(async ([templateList, approvedApps, pendingReports, students, dormitories]) => {
        const claimed = new Set<string>()
        const details = await Promise.all(pendingReports.map((r) => getReportDetail(r.id)))
        for (const detail of details) {
          for (const s of detail.students) claimed.add(s.application_id)
        }
        setTemplates(templateList)
        setAvailableApps(approvedApps.filter((a) => !claimed.has(a.id)))
        setNamesById(Object.fromEntries(students.map((s) => [s.id, s.full_name])))
        setDormitoryNamesById(Object.fromEntries(dormitories.map((d) => [d.id, d.name])))
      })
      .catch((err) => setLoadError(extractErrorMessage(err, 'Жүктеу сәтсіз аяқталды')))
  }, [])

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!templateId || selected.size === 0) return
    setSubmitError(null)
    setIsSubmitting(true)
    try {
      const report = await createReport(templateId, Array.from(selected))
      navigate(`/admin/reports/${report.id}`)
    } catch (err) {
      setSubmitError(extractErrorMessage(err, 'Рапорт құру сәтсіз аяқталды'))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loadError) return <Alert variant="error" message={loadError} />

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-gray-900">Рапорт құрастырушы</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <Card title="Шаблон">
          <select
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            required
          >
            <option value="">Таңдаңыз</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Card>

        <Card title="Approved өтініштер">
          {!availableApps && <p className="text-sm text-gray-500">Жүктелуде...</p>}
          {availableApps && availableApps.length === 0 && (
            <p className="text-sm text-gray-500">Рапортқа қосуға болатын өтініш жоқ</p>
          )}
          <ul className="flex flex-col gap-2">
            {availableApps?.map((app) => (
              <li key={app.id}>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={selected.has(app.id)}
                    onChange={() => toggle(app.id)}
                  />
                  {namesById[app.student_id] ?? app.student_id} —{' '}
                  {dormitoryNamesById[app.dormitory_id] ?? app.dormitory_id}
                </label>
              </li>
            ))}
          </ul>
        </Card>

        {submitError && <Alert variant="error" message={submitError} />}
        <Button type="submit" isLoading={isSubmitting} disabled={!templateId || selected.size === 0} className="self-start">
          Рапорт құру
        </Button>
      </form>
    </div>
  )
}
