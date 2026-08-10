import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronLeft } from 'lucide-react'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { TemplateEditor } from '../../../components/TemplateEditor'
import { extractErrorMessage } from '../../../api/client'
import { getProtocolTemplate, updateProtocolTemplate } from '../../../api/protocolTemplateApi'
import { formatDateTime } from '../../../utils/dateFormat'
import { adminPageHeading } from '../adminTable'
import type { TemplateEditorHandle } from '../../../components/TemplateEditor'
import type { ProtocolVariable } from '../../../api/protocolTemplateApi'

export function ProtocolTemplatePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const editorRef = useRef<TemplateEditorHandle>(null)

  const [pages, setPages] = useState<string[] | null>(null)
  const [variables, setVariables] = useState<ProtocolVariable[]>([])
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    getProtocolTemplate()
      .then((tpl) => {
        setPages(tpl.pages)
        setVariables(tpl.variables ?? [])
        setUpdatedAt(tpl.updated_at)
      })
      .catch((err) => setLoadError(extractErrorMessage(err, t('admin.common.loadError'))))
      .finally(() => setIsLoading(false))
  }, [t])

  async function handleSave() {
    if (!editorRef.current) return
    setSaveError(null)
    setSaveSuccess(false)
    setIsSaving(true)
    try {
      const result = await updateProtocolTemplate(editorRef.current.getPages())
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
        <h1 className={adminPageHeading}>{t('admin.protocolTemplate.title')}</h1>
      </div>

      <p className="text-sm text-sand-300">{t('admin.protocolTemplate.hint')}</p>

      {loadError && <Alert variant="error" message={loadError} />}
      {saveError && <Alert variant="error" message={saveError} />}
      {saveSuccess && <Alert variant="success" message={t('admin.protocolTemplate.saved')} />}

      {!loadError && !isLoading && pages && (
        <>
          <TemplateEditor
            ref={editorRef}
            initialPages={pages}
            variables={variables}
            pageClassName="protocol-page"
            chipClassName="protocol-var"
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

          <div className="flex items-center justify-between">
            <p className="text-xs text-sand-400">
              {updatedAt
                ? t('admin.protocolTemplate.lastSaved', { date: formatDateTime(updatedAt) })
                : t('admin.protocolTemplate.neverSaved')}
            </p>
            <Button onClick={handleSave} isLoading={isSaving}>
              {t('admin.protocolTemplate.save')}
            </Button>
          </div>
        </>
      )}

      {!loadError && isLoading && <p className="text-sm text-sand-300">{t('admin.common.loading')}</p>}
    </div>
  )
}
