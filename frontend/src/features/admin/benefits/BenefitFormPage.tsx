import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
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
import type { BenefitRequiredDocument } from '../../../types/benefits'
import type { RequiredDocument } from '../../../types/documents'

export function BenefitFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
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
        setName(b.name)
        setDescription(b.description)
        setPriority(String(b.priority))
      })
      .catch((err) => setLoadError(extractErrorMessage(err, 'Жүктеу сәтсіз аяқталды')))
    loadChildren(id)
  }, [id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    setIsSubmitting(true)
    try {
      const payload = { name, description, priority: Number(priority) }
      if (isEdit && id) {
        await updateBenefit(id, payload)
        navigate('/admin/documents')
      } else {
        const created = await createBenefit(payload)
        navigate(`/admin/benefits/${created.id}/edit`, { replace: true })
      }
    } catch (err) {
      setSubmitError(extractErrorMessage(err, 'Сақтау сәтсіз аяқталды'))
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
      setDocumentError(extractErrorMessage(err, 'Құжатты сақтау сәтсіз аяқталды'))
    } finally {
      setTogglingDocId(null)
    }
  }

  if (loadError) return <Alert variant="error" message={loadError} />

  return (
    <div className="flex flex-col gap-6">
      <Button variant="secondary" className="self-start" onClick={() => navigate('/admin/documents')}>
        ← Артқа
      </Button>

      <Card title={isEdit ? 'Льготаны өзгерту' : 'Жаңа льгота'}>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          {submitError && <Alert variant="error" message={submitError} />}
          <Input label="Атауы" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input
            label="Сипаттамасы"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Input
            label="Приоритет салмағы (1 – 10, 10 ең жоғарғы)"
            type="number"
            min={1}
            max={10}
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            required
          />
          <Button type="submit" isLoading={isSubmitting} className="self-start">
            Сақтау
          </Button>
        </form>
      </Card>

      {isEdit && id && (
        <Card title="Қажетті құжаттар">
          {documentError && <Alert variant="error" message={documentError} />}
          {catalog.length === 0 && (
            <p className="text-sm text-sand-300/60">
              Каталогта құжат жоқ — алдымен "Құжаттар" бетінен құжат қосыңыз.
            </p>
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
                    {doc.name}
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
