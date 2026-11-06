import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronLeft } from 'lucide-react'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { TemplateEditor } from '../../../components/TemplateEditor'
import { TemplatePages } from '../../../components/TemplatePages'
import { extractErrorMessage } from '../../../api/client'
import { getReferralTemplate, updateReferralTemplate } from '../../../api/referralTemplateApi'
import { formatDateTime } from '../../../utils/dateFormat'
import { getFilledReferralDocument } from '../../../utils/referralPdf'
import { sanitizeTemplateHtml } from '../../../utils/sanitizeTemplateHtml'
import { adminPageHeading } from '../adminTable'
import type { TemplateEditorHandle, TemplateVariable } from '../../../components/TemplateEditor'
import type { FilledDocument } from '../../../utils/pdf'
import type { Referral } from '../../../types/referrals'

const SAMPLE_REFERRAL: Omit<Referral, 'template_pages'> = {
  number: 1,
  token: '00000000000000000000000000000000',
  valid: true,
  issued_at: new Date().toISOString(),
  protocol_number: 1,
  student_full_name: 'Әлімова Айгерім Серікқызы',
  institute: 'Жаратылыстану институты',
  study_group: 'ИС-21-2',
  dormitory_name: 'Студенттер үйі №5',
  dormitory_address: 'Қызылорда қаласы, Ажарова көшесі №34',
  room_number: '412',
  signatory_name: 'У.С. Ибраев',
}

export function ReferralTemplatePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const editorRef = useRef<TemplateEditorHandle>(null)

  const [pages, setPages] = useState<string[] | null>(null)
  const [variables, setVariables] = useState<TemplateVariable[]>([])
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [preview, setPreview] = useState<FilledDocument | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    getReferralTemplate()
      .then((template) => {
        setPages(template.pages.map(sanitizeTemplateHtml))
        setVariables(template.variables ?? [])
        setUpdatedAt(template.updated_at)
      })
      .catch((err) => setLoadError(extractErrorMessage(err, t('admin.common.loadError'))))
  }, [t])

  async function handlePreview() {
    if (!editorRef.current) return
    setSaveError(null)
    try {
      setPreview(await getFilledReferralDocument({ ...SAMPLE_REFERRAL, template_pages: editorRef.current.getPages() }))
    } catch {
      setSaveError(t('referral.renderFailed'))
    }
  }

  async function handleSave() {
    if (!editorRef.current) return
    setSaveError(null)
    setSaveSuccess(false)
    setIsSaving(true)
    try {
      const result = await updateReferralTemplate(editorRef.current.getPages())
      setUpdatedAt(result.updated_at)
      setSaveSuccess(true)
    } catch (err) {
      setSaveError(extractErrorMessage(err, t('admin.protocolTemplate.saveFailed')))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/admin/protocols')}
          aria-label={t('wizard.back')}
          className="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-full border border-navy-700 bg-navy-900 text-sand-200"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h1 className={adminPageHeading}>{t('referral.templateTitle')}</h1>
      </div>

      <p className="text-sm text-sand-300">{t('referral.templateHint')}</p>

      {loadError && <Alert variant="error" message={loadError} />}
      {saveError && <Alert variant="error" message={saveError} />}
      {saveSuccess && <Alert variant="success" message={t('admin.protocolTemplate.saved')} />}

      {!loadError && !pages && <p className="text-sm text-sand-300">{t('admin.common.loading')}</p>}

      {pages && (
        <>
          <TemplateEditor
            ref={editorRef}
            initialPages={pages}
            variables={variables}
            pageClassName="referral-page"
            chipClassName="referral-var"
            labels={{
              bold: t('admin.protocolTemplate.bold'),
              italic: t('admin.protocolTemplate.italic'),
              alignLeft: t('admin.protocolTemplate.alignLeft'),
              alignCenter: t('admin.protocolTemplate.alignCenter'),
              alignRight: t('admin.protocolTemplate.alignRight'),
              alignJustify: t('admin.protocolTemplate.alignJustify'),
              chooseVariable: t('admin.protocolTemplate.chooseVariable'),
              insertVariable: t('admin.protocolTemplate.insertVariable'),
              addPage: t('admin.protocolTemplate.addPage'),
              deletePage: t('admin.protocolTemplate.deletePage'),
              deletePageConfirmTitle: t('admin.protocolTemplate.deletePageConfirmTitle'),
              deletePageConfirmMessage: t('admin.protocolTemplate.deletePageConfirmMessage'),
              pageLabel: (current, total) => t('admin.protocolTemplate.pageLabel', { current, total }),
            }}
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-sand-400">
              {updatedAt
                ? t('admin.protocolTemplate.lastSaved', { date: formatDateTime(updatedAt) })
                : t('admin.protocolTemplate.neverSaved')}
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={handlePreview}>
                {t('referral.templatePreview')}
              </Button>
              <Button onClick={handleSave} isLoading={isSaving}>
                {t('admin.protocolTemplate.save')}
              </Button>
            </div>
          </div>

          {preview && <TemplatePages document={preview} />}
        </>
      )}
    </div>
  )
}
