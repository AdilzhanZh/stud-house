import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronLeft } from 'lucide-react'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { TemplateEditor } from '../../../components/TemplateEditor'
import { extractErrorMessage } from '../../../api/client'
import { getPetitionTemplate, updatePetitionTemplate } from '../../../api/petitionTemplateApi'
import { formatDateTime } from '../../../utils/dateFormat'
import { adminPageHeading } from '../adminTable'
import type { TemplateEditorHandle } from '../../../components/TemplateEditor'
import type { PetitionVariable } from '../../../api/petitionTemplateApi'

export function PetitionTemplatePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const editorRef = useRef<TemplateEditorHandle>(null)

  const [pages, setPages] = useState<string[] | null>(null)
  const [variables, setVariables] = useState<PetitionVariable[]>([])
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    getPetitionTemplate()
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
      const result = await updatePetitionTemplate(editorRef.current.getPages())
      setUpdatedAt(result.updated_at)
      setSaveSuccess(true)
    } catch (err) {
      setSaveError(extractErrorMessage(err, t('admin.petitionTemplate.saveFailed')))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/admin/applications')}
          aria-label={t('wizard.back')}
          className="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-full border border-navy-700 bg-navy-900 text-sand-200"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h1 className={adminPageHeading}>{t('admin.petitionTemplate.title')}</h1>
      </div>

      <p className="text-sm text-sand-300">{t('admin.petitionTemplate.hint')}</p>

      {loadError && <Alert variant="error" message={loadError} />}
      {saveError && <Alert variant="error" message={saveError} />}
      {saveSuccess && <Alert variant="success" message={t('admin.petitionTemplate.saved')} />}

      {!loadError && !isLoading && pages && (
        <>
          <TemplateEditor
            ref={editorRef}
            initialPages={pages}
            variables={variables}
            pageClassName="petition-page"
            chipClassName="petition-var"
            labels={{
              bold: t('admin.petitionTemplate.bold'),
              italic: t('admin.petitionTemplate.italic'),
              alignLeft: t('admin.petitionTemplate.alignLeft'),
              alignCenter: t('admin.petitionTemplate.alignCenter'),
              alignRight: t('admin.petitionTemplate.alignRight'),
              alignJustify: t('admin.petitionTemplate.alignJustify'),
              chooseVariable: t('admin.petitionTemplate.chooseVariable'),
              insertVariable: t('admin.petitionTemplate.insertVariable'),
              addPage: t('admin.petitionTemplate.addPage'),
              deletePage: t('admin.petitionTemplate.deletePage'),
              deletePageConfirmTitle: t('admin.petitionTemplate.deletePageConfirmTitle'),
              deletePageConfirmMessage: t('admin.petitionTemplate.deletePageConfirmMessage'),
              pageLabel: (current, total) => t('admin.petitionTemplate.pageLabel', { current, total }),
            }}
          />

          <div className="flex items-center justify-between">
            <p className="text-xs text-sand-400">
              {updatedAt
                ? t('admin.petitionTemplate.lastSaved', { date: formatDateTime(updatedAt) })
                : t('admin.petitionTemplate.neverSaved')}
            </p>
            <Button onClick={handleSave} isLoading={isSaving}>
              {t('admin.petitionTemplate.save')}
            </Button>
          </div>
        </>
      )}

      {!loadError && isLoading && <p className="text-sm text-sand-300">{t('admin.common.loading')}</p>}
    </div>
  )
}
