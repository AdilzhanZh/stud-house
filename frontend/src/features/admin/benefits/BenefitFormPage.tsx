import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card } from '../../../components/Card'
import { Input } from '../../../components/Input'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { extractErrorMessage } from '../../../api/client'
import {
  addBenefitRequiredDocument,
  createBenefit,
  deleteBenefitRequiredDocument,
  getBenefit,
  listBenefitRequiredDocuments,
  updateBenefit,
} from '../../../api/benefitApi'
import { listRequiredDocuments } from '../../../api/documentApi'
import { bilingualField } from '../../../utils/bilingualField'
import type { BenefitRequiredDocument } from '../../../types/benefits'
import type { RequiredDocument } from '../../../types/documents'

export function BenefitFormPage() {
  const { t, i18n } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  const [nameKk, setNameKk] = useState('')
  const [nameRu, setNameRu] = useState('')
  const [descriptionKk, setDescriptionKk] = useState('')
  const [descriptionRu, setDescriptionRu] = useState('')
  const [priority, setPriority] = useState('1')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [catalog, setCatalog] = useState<RequiredDocument[]>([])
  const [assignedDocs, setAssignedDocs] = useState<BenefitRequiredDocument[]>([])
  const [documentError, setDocumentError] = useState<string | null>(null)
  const [togglingDocId, setTogglingDocId] = useState<string | null>(null)

  function loadChildren(benefitId: string) {
    listBenefitRequiredDocuments(benefitId).then(setAssignedDocs).catch(() => {})
  }

  useEffect(() => {
    listRequiredDocuments().then(setCatalog).catch(() => {})
    if (!id) return
    getBenefit(id)
      .then((b) => {
        setNameKk(b.name_kk)
        setNameRu(b.name_ru)
        setDescriptionKk(b.description_kk)
        setDescriptionRu(b.description_ru)
        setPriority(String(b.priority))
      })
      .catch((err) => setLoadError(extractErrorMessage(err, t('admin.common.loadError'))))
    loadChildren(id)
  }, [id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    setIsSubmitting(true)
    try {
      const payload = {
        name_kk: nameKk,
        name_ru: nameRu,
        description_kk: descriptionKk,
        description_ru: descriptionRu,
        priority: Number(priority),
      }
      if (isEdit && id) {
        await updateBenefit(id, payload)
        navigate('/admin/documents')
      } else {
        const created = await createBenefit(payload)
        navigate(`/admin/benefits/${created.id}/edit`, { replace: true })
      }
    } catch (err) {
      setSubmitError(extractErrorMessage(err, t('admin.common.saveFailed')))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleToggleDocument(documentId: string, checked: boolean) {
    if (!id) return
    setDocumentError(null)
    setTogglingDocId(documentId)
    try {
      if (checked) {
        await addBenefitRequiredDocument(id, documentId)
      } else {
        const assigned = assignedDocs.find((d) => d.document_id === documentId)
        if (assigned) await deleteBenefitRequiredDocument(assigned.id)
      }
      loadChildren(id)
    } catch (err) {
      setDocumentError(extractErrorMessage(err, t('admin.dormitories.saveDocumentFailed')))
    } finally {
      setTogglingDocId(null)
    }
  }

  if (loadError) return <Alert variant="error" message={loadError} />

  return (
    <div className="flex flex-col gap-6">
      <Button variant="secondary" className="self-start" onClick={() => navigate('/admin/documents')}>
        ← {t('admin.common.back')}
      </Button>

      <Card title={isEdit ? t('admin.benefits.editTitle') : t('admin.benefits.newTitle')}>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          {submitError && <Alert variant="error" message={submitError} />}
          <Input label={t('admin.benefits.nameKk')} value={nameKk} onChange={(e) => setNameKk(e.target.value)} />
          <Input label={t('admin.benefits.nameRu')} value={nameRu} onChange={(e) => setNameRu(e.target.value)} />
          <Input
            label={t('admin.benefits.descriptionKk')}
            value={descriptionKk}
            onChange={(e) => setDescriptionKk(e.target.value)}
          />
          <Input
            label={t('admin.benefits.descriptionRu')}
            value={descriptionRu}
            onChange={(e) => setDescriptionRu(e.target.value)}
          />
          <Input
            label={t('admin.benefits.priorityLabel')}
            type="number"
            min={1}
            max={10}
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            required
          />
          <Button type="submit" isLoading={isSubmitting} className="self-start">
            {t('admin.common.save')}
          </Button>
        </form>
      </Card>

      {isEdit && id && (
        <Card title={t('admin.dormitories.requiredDocuments')}>
          {documentError && <Alert variant="error" message={documentError} />}
          {catalog.length === 0 && (
            <p className="text-sm text-sand-300">{t('admin.dormitories.emptyDocumentCatalog')}</p>
          )}
          <ul className="flex flex-col gap-2">
            {catalog.map((doc) => {
              const isAssigned = assignedDocs.some((d) => d.document_id === doc.id)
              return (
                <li key={doc.id}>
                  <label className="flex items-center gap-2 text-sm text-sand-200">
                    <input
                      type="checkbox"
                      checked={isAssigned}
                      disabled={togglingDocId === doc.id}
                      onChange={(e) => handleToggleDocument(doc.id, e.target.checked)}
                    />
                    {bilingualField(doc.name_kk, doc.name_ru, i18n.language)}
                  </label>
                </li>
              )
            })}
          </ul>
        </Card>
      )}
    </div>
  )
}
