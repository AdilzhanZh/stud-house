import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card } from '../../../components/Card'
import { Input } from '../../../components/Input'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { extractErrorMessage } from '../../../api/client'
import {
  addBenefitField,
  addBenefitRequiredDocument,
  createBenefit,
  deleteBenefitField,
  deleteBenefitRequiredDocument,
  getBenefit,
  listBenefitFields,
  listBenefitRequiredDocuments,
  updateBenefit,
} from '../../../api/benefitApi'
import type { BenefitField, BenefitRequiredDocument } from '../../../types/benefits'

const FIELD_TYPES = ['text', 'number', 'date', 'file']

export function BenefitFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [fields, setFields] = useState<BenefitField[]>([])
  const [newFieldName, setNewFieldName] = useState('')
  const [newFieldType, setNewFieldType] = useState(FIELD_TYPES[0])
  const [fieldError, setFieldError] = useState<string | null>(null)

  const [documents, setDocuments] = useState<BenefitRequiredDocument[]>([])
  const [newDocumentName, setNewDocumentName] = useState('')
  const [documentError, setDocumentError] = useState<string | null>(null)

  function loadChildren(benefitId: string) {
    listBenefitFields(benefitId).then(setFields).catch(() => {})
    listBenefitRequiredDocuments(benefitId).then(setDocuments).catch(() => {})
  }

  useEffect(() => {
    if (!id) return
    getBenefit(id)
      .then((b) => {
        setName(b.name)
        setDescription(b.description)
      })
      .catch((err) => setLoadError(extractErrorMessage(err, 'Жүктеу сәтсіз аяқталды')))
    loadChildren(id)
  }, [id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    setIsSubmitting(true)
    try {
      if (isEdit && id) {
        await updateBenefit(id, { name, description })
        navigate('/admin/benefits')
      } else {
        const created = await createBenefit({ name, description })
        navigate(`/admin/benefits/${created.id}/edit`, { replace: true })
      }
    } catch (err) {
      setSubmitError(extractErrorMessage(err, 'Сақтау сәтсіз аяқталды'))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleAddField() {
    if (!id || !newFieldName.trim()) return
    setFieldError(null)
    try {
      await addBenefitField(id, newFieldName.trim(), newFieldType)
      setNewFieldName('')
      loadChildren(id)
    } catch (err) {
      setFieldError(extractErrorMessage(err, 'Өріс қосу сәтсіз аяқталды'))
    }
  }

  async function handleDeleteField(fieldId: string) {
    if (!id) return
    try {
      await deleteBenefitField(fieldId)
      loadChildren(id)
    } catch (err) {
      setFieldError(extractErrorMessage(err, 'Өрісті өшіру сәтсіз аяқталды'))
    }
  }

  async function handleAddDocument() {
    if (!id || !newDocumentName.trim()) return
    setDocumentError(null)
    try {
      await addBenefitRequiredDocument(id, newDocumentName.trim())
      setNewDocumentName('')
      loadChildren(id)
    } catch (err) {
      setDocumentError(extractErrorMessage(err, 'Құжат қосу сәтсіз аяқталды'))
    }
  }

  async function handleDeleteDocument(documentId: string) {
    if (!id) return
    try {
      await deleteBenefitRequiredDocument(documentId)
      loadChildren(id)
    } catch (err) {
      setDocumentError(extractErrorMessage(err, 'Құжатты өшіру сәтсіз аяқталды'))
    }
  }

  if (loadError) return <Alert variant="error" message={loadError} />

  return (
    <div className="flex flex-col gap-6">
      <Card title={isEdit ? 'Льготаны өзгерту' : 'Жаңа льгота'}>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          {submitError && <Alert variant="error" message={submitError} />}
          <Input label="Атауы" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input
            label="Сипаттамасы"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Button type="submit" isLoading={isSubmitting} className="self-start">
            Сақтау
          </Button>
        </form>
      </Card>

      {isEdit && id && (
        <>
          <Card title="Қажетті өрістер">
            {fieldError && <Alert variant="error" message={fieldError} />}
            <ul className="mb-4 flex flex-col gap-2">
              {fields.map((f) => (
                <li key={f.id} className="flex items-center justify-between text-sm">
                  <span>
                    {f.field_name} <span className="text-gray-400">({f.field_type})</span>
                  </span>
                  <button
                    type="button"
                    className="text-red-600 hover:underline"
                    onClick={() => handleDeleteField(f.id)}
                  >
                    Өшіру
                  </button>
                </li>
              ))}
              {fields.length === 0 && <p className="text-sm text-gray-500">Өріс қосылмаған</p>}
            </ul>
            <div className="flex gap-2">
              <input
                placeholder="Өріс атауы"
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
                value={newFieldName}
                onChange={(e) => setNewFieldName(e.target.value)}
              />
              <select
                className="w-32 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
                value={newFieldType}
                onChange={(e) => setNewFieldType(e.target.value)}
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <Button type="button" variant="secondary" onClick={handleAddField}>
                Қосу
              </Button>
            </div>
          </Card>

          <Card title="Қажетті құжаттар">
            {documentError && <Alert variant="error" message={documentError} />}
            <ul className="mb-4 flex flex-col gap-2">
              {documents.map((d) => (
                <li key={d.id} className="flex items-center justify-between text-sm">
                  <span>{d.document_name}</span>
                  <button
                    type="button"
                    className="text-red-600 hover:underline"
                    onClick={() => handleDeleteDocument(d.id)}
                  >
                    Өшіру
                  </button>
                </li>
              ))}
              {documents.length === 0 && <p className="text-sm text-gray-500">Құжат қосылмаған</p>}
            </ul>
            <div className="flex gap-2">
              <input
                placeholder="Құжат атауы"
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
                value={newDocumentName}
                onChange={(e) => setNewDocumentName(e.target.value)}
              />
              <Button type="button" variant="secondary" onClick={handleAddDocument}>
                Қосу
              </Button>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
