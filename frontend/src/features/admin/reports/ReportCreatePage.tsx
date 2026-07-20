import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card } from '../../../components/Card'
import { Select } from '../../../components/Select'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { extractErrorMessage } from '../../../api/client'
import { listApplications } from '../../../api/applicationAdminApi'
import { listDormitories } from '../../../api/dormitoryApi'
import { listUsers } from '../../../api/adminUserApi'
import { createReport, listClaimedApplicationIds } from '../../../api/reportApi'
import { listReportTemplates } from '../../../api/reportTemplateApi'
import type { Application } from '../../../types/applications'
import type { Dormitory } from '../../../types/dormitories'
import type { ReportTemplate } from '../../../types/reports'
import type { User } from '../../../types'

interface Candidate {
  application: Application
  student: User | null
}

export function ReportCreatePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [dormitories, setDormitories] = useState<Dormitory[]>([])
  const [templates, setTemplates] = useState<ReportTemplate[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false)

  const [dormitoryId, setDormitoryId] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    Promise.all([listDormitories(), listReportTemplates()])
      .then(([dorms, tpls]) => {
        setDormitories(dorms)
        setTemplates(tpls)
      })
      .catch((err) => setLoadError(extractErrorMessage(err, t('admin.common.loadError'))))
  }, [])

  useEffect(() => {
    if (!dormitoryId) {
      setCandidates([])
      setSelectedIds(new Set())
      return
    }
    const dormitory = dormitories.find((d) => d.id === dormitoryId)
    setTemplateId(dormitory?.default_report_template_id ?? '')
    setSelectedIds(new Set())
    setIsLoadingCandidates(true)
    Promise.all([listApplications('approved'), listUsers('student'), listClaimedApplicationIds()])
      .then(([apps, students, claimed]) => {
        const eligible = apps.filter((a) => a.dormitory_id === dormitoryId && !claimed.has(a.id))
        const studentsById = new Map(students.map((s) => [s.id, s]))
        setCandidates(eligible.map((a) => ({ application: a, student: studentsById.get(a.student_id) ?? null })))
      })
      .catch((err) => setLoadError(extractErrorMessage(err, t('admin.applications.loadError'))))
      .finally(() => setIsLoadingCandidates(false))
  }, [dormitoryId, dormitories])

  function toggleSelected(applicationId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(applicationId)) next.delete(applicationId)
      else next.add(applicationId)
      return next
    })
  }

  function toggleSelectAll() {
    setSelectedIds((prev) =>
      prev.size === candidates.length ? new Set() : new Set(candidates.map((c) => c.application.id)),
    )
  }

  async function handleSubmit() {
    if (!templateId || selectedIds.size === 0) return
    setSubmitError(null)
    setIsSubmitting(true)
    try {
      const report = await createReport(templateId, Array.from(selectedIds))
      navigate(`/admin/reports/${report.id}`)
    } catch (err) {
      setSubmitError(extractErrorMessage(err, t('admin.reports.createFailed')))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[23px] font-bold text-sand-100">{t('admin.reports.newReport')}</h1>
        <Button variant="secondary" onClick={() => navigate('/admin/reports')}>
          ← {t('admin.reports.backToReports')}
        </Button>
      </div>

      {loadError && <Alert variant="error" message={loadError} />}

      <Card>
        <div className="flex flex-col gap-4">
          <Select
            label={t('admin.layout.dormitories')}
            value={dormitoryId}
            onChange={(e) => setDormitoryId(e.target.value)}
            required
          >
            <option value="">{t('admin.common.select')}</option>
            {dormitories.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>

          <Select
            label={t('admin.reports.template')}
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            required
            disabled={!dormitoryId}
          >
            <option value="">{t('admin.common.select')}</option>
            {templates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.name}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {dormitoryId && (
        <Card title={t('admin.reports.gatherStudents')}>
          {isLoadingCandidates && <p className="text-sm text-sand-300">{t('admin.common.loading')}</p>}
          {!isLoadingCandidates && candidates.length === 0 && (
            <p className="text-sm text-sand-300">{t('admin.reports.noEligibleApplications')}</p>
          )}
          {!isLoadingCandidates && candidates.length > 0 && (
            <>
              <label className="mb-3 flex items-center gap-2 text-sm font-medium text-sand-200">
                <input
                  type="checkbox"
                  checked={selectedIds.size === candidates.length}
                  onChange={toggleSelectAll}
                />
                {t('admin.reports.selectAll')}
              </label>
              <ul className="flex flex-col gap-2">
                {candidates.map(({ application, student }) => (
                  <li key={application.id}>
                    <label className="flex items-center gap-2 text-sm text-sand-200">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(application.id)}
                        onChange={() => toggleSelected(application.id)}
                      />
                      <span className="font-medium text-sand-100">{student?.full_name ?? application.student_id}</span>
                      {student && <span className="text-sand-300/70"> ({student.email})</span>}
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      )}

      {submitError && <Alert variant="error" message={submitError} />}
      <Button
        onClick={handleSubmit}
        isLoading={isSubmitting}
        disabled={!templateId || selectedIds.size === 0}
        className="self-start"
      >
        {t('admin.reports.createReport')}
      </Button>
    </div>
  )
}
