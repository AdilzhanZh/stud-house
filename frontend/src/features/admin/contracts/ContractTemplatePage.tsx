import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronLeft } from 'lucide-react'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { TemplateEditor } from '../../../components/TemplateEditor'
import { extractErrorMessage } from '../../../api/client'
import { getContractTemplate, updateContractTemplate } from '../../../api/contractTemplateApi'
import { formatDateTime } from '../../../utils/dateFormat'
import { adminPageHeading } from '../adminTable'
import type { TemplateEditorHandle } from '../../../components/TemplateEditor'
import type { ContractLanguage, ContractVariable } from '../../../api/contractTemplateApi'

const LANGUAGES: ContractLanguage[] = ['kk', 'ru']

export function ContractTemplatePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const editorRef = useRef<TemplateEditorHandle>(null)

  const [language, setLanguage] = useState<ContractLanguage>('kk')
  const [pages, setPages] = useState<string[] | null>(null)
  const [variables, setVariables] = useState<ContractVariable[]>([])
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setIsLoading(true)
    setPages(null)
    setLoadError(null)
    setSaveSuccess(false)
    getContractTemplate(language)
      .then((tpl) => {
        setPages(tpl.pages)
        setVariables(tpl.variables ?? [])
        setUpdatedAt(tpl.updated_at)
      })
      .catch((err) => setLoadError(extractErrorMessage(err, t('admin.common.loadError'))))
      .finally(() => setIsLoading(false))
  }, [t, language])

  async function handleSave() {
    if (!editorRef.current) return
    setSaveError(null)
    setSaveSuccess(false)
    setIsSaving(true)
    try {
      const result = await updateContractTemplate(language, editorRef.current.getPages())
      setUpdatedAt(result.updated_at)
      setSaveSuccess(true)
    } catch (err) {
      setSaveError(extractErrorMessage(err, t('admin.contractTemplate.saveFailed')))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/admin/contracts')}
          aria-label={t('wizard.back')}
          className="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-full border border-navy-700 bg-navy-900 text-sand-200"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h1 className={adminPageHeading}>{t('admin.contractTemplate.title')}</h1>
      </div>

      <p className="text-sm text-sand-300">{t('admin.contractTemplate.hint')}</p>

      <div className="flex flex-wrap gap-2">
        {LANGUAGES.map((lang) => (
          <button
            key={lang}
            onClick={() => setLanguage(lang)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold whitespace-nowrap ${
              language === lang
                ? 'border-turquoise-500 bg-turquoise-500/10 text-turquoise-400'
                : 'border-navy-700 bg-navy-900 text-sand-300 hover:text-sand-100'
            }`}
          >
            {t(`admin.contractTemplate.language.${lang}`)}
          </button>
        ))}
      </div>

      {loadError && <Alert variant="error" message={loadError} />}
      {saveError && <Alert variant="error" message={saveError} />}
      {saveSuccess && <Alert variant="success" message={t('admin.contractTemplate.saved')} />}

      {!loadError && !isLoading && pages && (
        <>
          <TemplateEditor
            key={language}
            ref={editorRef}
            initialPages={pages}
            variables={variables}
            pageClassName="contract-page"
            chipClassName="contract-var"
            labels={{
              bold: t('admin.contractTemplate.bold'),
              italic: t('admin.contractTemplate.italic'),
              alignLeft: t('admin.contractTemplate.alignLeft'),
              alignCenter: t('admin.contractTemplate.alignCenter'),
              alignRight: t('admin.contractTemplate.alignRight'),
              alignJustify: t('admin.contractTemplate.alignJustify'),
              chooseVariable: t('admin.contractTemplate.chooseVariable'),
              insertVariable: t('admin.contractTemplate.insertVariable'),
              addPage: t('admin.contractTemplate.addPage'),
              deletePage: t('admin.contractTemplate.deletePage'),
              deletePageConfirmTitle: t('admin.contractTemplate.deletePageConfirmTitle'),
              deletePageConfirmMessage: t('admin.contractTemplate.deletePageConfirmMessage'),
              pageLabel: (current, total) => t('admin.contractTemplate.pageLabel', { current, total }),
            }}
          />

          <div className="flex items-center justify-between">
            <p className="text-xs text-sand-400">
              {updatedAt
                ? t('admin.contractTemplate.lastSaved', { date: formatDateTime(updatedAt) })
                : t('admin.contractTemplate.neverSaved')}
            </p>
            <Button onClick={handleSave} isLoading={isSaving}>
              {t('admin.contractTemplate.save')}
            </Button>
          </div>
        </>
      )}

      {!loadError && isLoading && <p className="text-sm text-sand-300">{t('admin.common.loading')}</p>}
    </div>
  )
}
