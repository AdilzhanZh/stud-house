import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { DeleteIconButton } from '../../../components/DeleteIconButton'
import { extractErrorMessage } from '../../../api/client'
import { createReportTemplate, deleteReportTemplate, listReportTemplates } from '../../../api/reportTemplateApi'
import { reportStudentColumnLabel, reportStudentColumnOrder } from '../../../utils/reportColumns'
import type { ReportStudentColumn, ReportTemplate } from '../../../types/reports'

export function ReportTemplateListPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [templates, setTemplates] = useState<ReportTemplate[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [introText, setIntroText] = useState('')
  const [columns, setColumns] = useState<Set<ReportStudentColumn>>(new Set(['full_name']))
  const [createError, setCreateError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<ReportTemplate | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  function load() {
    listReportTemplates()
      .then(setTemplates)
      .catch((err) => setLoadError(extractErrorMessage(err, t('admin.reports.loadTemplatesError'))))
  }

  useEffect(load, [])

  function toggleColumn(column: ReportStudentColumn) {
    setColumns((prev) => {
      const next = new Set(prev)
      if (next.has(column)) next.delete(column)
      else next.add(column)
      return next
    })
  }

  async function handleCreate() {
    if (!name.trim() || columns.size === 0) return
    setCreateError(null)
    setIsCreating(true)
    try {
      await createReportTemplate({
        name: name.trim(),
        intro_text: introText.trim(),
        student_columns: Array.from(columns),
      })
      setName('')
      setIntroText('')
      setColumns(new Set(['full_name']))
      load()
    } catch (err) {
      setCreateError(extractErrorMessage(err, t('admin.reports.createTemplateFailed')))
    } finally {
      setIsCreating(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleteError(null)
    setIsDeleting(true)
    try {
      await deleteReportTemplate(deleteTarget.id)
      setDeleteTarget(null)
      load()
    } catch (err) {
      setDeleteError(extractErrorMessage(err, t('admin.reports.deleteTemplateFailed')))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[23px] font-bold text-sand-100">{t('admin.reports.templatesTitle')}</h1>
        <Button variant="secondary" onClick={() => navigate('/admin/reports')}>
          ← {t('admin.reports.backToReports')}
        </Button>
      </div>

      <Card title={t('admin.reports.newTemplate')}>
        {createError && <Alert variant="error" message={createError} />}
        <div className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-sand-200">{t('admin.dormitories.name')}</label>
            <input
              className="rounded-[14px] border border-navy-700 bg-navy-950 px-3.5 py-2.5 text-sand-100 text-sm outline-none focus:border-turquoise-400 focus:ring-4 focus:ring-turquoise-400/15"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('admin.reports.templateNamePlaceholder')}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-sand-200">
              {t('admin.reports.introText')}
              <span className="ml-1 text-xs font-normal text-sand-400">{t('admin.common.optional')}</span>
            </label>
            <textarea
              className="min-h-22 rounded-[14px] border border-navy-700 bg-navy-950 px-3.5 py-2.5 text-sand-100 text-sm outline-none focus:border-turquoise-400 focus:ring-4 focus:ring-turquoise-400/15"
              value={introText}
              onChange={(e) => setIntroText(e.target.value)}
              placeholder={t('admin.reports.introTextPlaceholder')}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-sand-200">{t('admin.reports.columnsLabel')}</label>
            <ul className="flex flex-col gap-2">
              {reportStudentColumnOrder.map((column) => (
                <li key={column}>
                  <label className="flex items-center gap-2 text-sm text-sand-200">
                    <input
                      type="checkbox"
                      checked={columns.has(column)}
                      onChange={() => toggleColumn(column)}
                    />
                    {reportStudentColumnLabel(column, t)}
                  </label>
                </li>
              ))}
            </ul>
          </div>

          <Button
            type="button"
            onClick={handleCreate}
            isLoading={isCreating}
            disabled={!name.trim() || columns.size === 0}
            className="self-start"
          >
            {t('admin.reports.createTemplate')}
          </Button>
        </div>
      </Card>

      <Card title={t('admin.reports.existingTemplates')}>
        {loadError && <Alert variant="error" message={loadError} />}
        {deleteError && <Alert variant="error" message={deleteError} />}
        {!loadError && !templates && <p className="text-sm text-sand-300">{t('admin.common.loading')}</p>}
        <ul className="flex flex-col gap-3">
          {templates?.map((tpl) => (
            <li key={tpl.id} className="flex items-start justify-between gap-3 rounded-2xl border border-navy-700 p-3.5">
              <div>
                <p className="font-medium text-sand-100">{tpl.name}</p>
                {tpl.intro_text && <p className="mt-0.5 text-sm text-sand-300">{tpl.intro_text}</p>}
                <p className="mt-1 text-xs text-sand-400">
                  {tpl.student_columns.map((c) => reportStudentColumnLabel(c, t)).join(', ')}
                </p>
              </div>
              <DeleteIconButton onClick={() => setDeleteTarget(tpl)} />
            </li>
          ))}
          {templates && templates.length === 0 && <p className="text-sm text-sand-300">{t('admin.reports.noTemplates')}</p>}
        </ul>
      </Card>

      <ConfirmDialog
        open={deleteTarget != null}
        title={t('admin.reports.deleteTemplateTitle')}
        message={t('admin.reports.deleteTemplateConfirm', { name: deleteTarget?.name })}
        danger
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
