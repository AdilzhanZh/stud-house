import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { DeleteIconButton } from '../../../components/DeleteIconButton'
import { extractErrorMessage } from '../../../api/client'
import {
  createRequiredDocument,
  deleteRequiredDocument,
  listRequiredDocuments,
} from '../../../api/documentApi'
import { deleteBenefit, listBenefits } from '../../../api/benefitApi'
import type { RequiredDocument } from '../../../types/documents'
import type { Benefit } from '../../../types/benefits'

export function DocumentListPage() {
  const navigate = useNavigate()

  const [documents, setDocuments] = useState<RequiredDocument[] | null>(null)
  const [newDocumentName, setNewDocumentName] = useState('')
  const [documentError, setDocumentError] = useState<string | null>(null)
  const [deleteDocTarget, setDeleteDocTarget] = useState<RequiredDocument | null>(null)
  const [isDeletingDoc, setIsDeletingDoc] = useState(false)

  const [benefits, setBenefits] = useState<Benefit[] | null>(null)
  const [benefitError, setBenefitError] = useState<string | null>(null)
  const [deleteBenefitTarget, setDeleteBenefitTarget] = useState<Benefit | null>(null)
  const [isDeletingBenefit, setIsDeletingBenefit] = useState(false)

  function loadDocuments() {
    listRequiredDocuments()
      .then(setDocuments)
      .catch((err) => setDocumentError(extractErrorMessage(err, 'Құжаттарды жүктеу сәтсіз аяқталды')))
  }

  function loadBenefits() {
    listBenefits()
      .then(setBenefits)
      .catch((err) => setBenefitError(extractErrorMessage(err, 'Льготаларды жүктеу сәтсіз аяқталды')))
  }

  useEffect(() => {
    loadDocuments()
    loadBenefits()
  }, [])

  async function handleAddDocument() {
    if (!newDocumentName.trim()) return
    setDocumentError(null)
    try {
      await createRequiredDocument(newDocumentName.trim())
      setNewDocumentName('')
      loadDocuments()
    } catch (err) {
      setDocumentError(extractErrorMessage(err, 'Құжат қосу сәтсіз аяқталды'))
    }
  }

  async function handleDeleteDocument() {
    if (!deleteDocTarget) return
    setDocumentError(null)
    setIsDeletingDoc(true)
    try {
      await deleteRequiredDocument(deleteDocTarget.id)
      setDeleteDocTarget(null)
      loadDocuments()
    } catch (err) {
      setDocumentError(extractErrorMessage(err, 'Құжатты өшіру сәтсіз аяқталды'))
    } finally {
      setIsDeletingDoc(false)
    }
  }

  async function handleDeleteBenefit() {
    if (!deleteBenefitTarget) return
    setBenefitError(null)
    setIsDeletingBenefit(true)
    try {
      await deleteBenefit(deleteBenefitTarget.id)
      setDeleteBenefitTarget(null)
      loadBenefits()
    } catch (err) {
      setBenefitError(extractErrorMessage(err, 'Льготаны өшіру сәтсіз аяқталды'))
    } finally {
      setIsDeletingBenefit(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-2xl text-sand-100">Құжаттар</h1>

      <Card title="Құжаттар каталогы">
        {documentError && <Alert variant="error" message={documentError} />}
        <ul className="mb-4 flex flex-col gap-2">
          {documents?.map((d) => (
            <li key={d.id} className="flex items-center justify-between text-sm">
              <span className="text-sand-100">{d.name}</span>
              <DeleteIconButton onClick={() => setDeleteDocTarget(d)} />
            </li>
          ))}
          {documents && documents.length === 0 && (
            <p className="text-sm text-sand-300/60">Құжат қосылмаған</p>
          )}
          {!documents && !documentError && <p className="text-sm text-sand-300/60">Жүктелуде...</p>}
        </ul>
        <div className="flex gap-2">
          <input
            placeholder="Құжат атауы"
            className="flex-1 rounded-md border border-sand-100/15 bg-navy-950/60 px-3 py-2 text-sand-100 text-sm outline-none focus:border-turquoise-400 focus:ring-2 focus:ring-turquoise-400/30"
            value={newDocumentName}
            onChange={(e) => setNewDocumentName(e.target.value)}
          />
          <Button type="button" variant="secondary" onClick={handleAddDocument}>
            Қосу
          </Button>
        </div>
      </Card>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg text-sand-100">Льготалар</h2>
          <Button onClick={() => navigate('/admin/benefits/new')}>Жаңа льгота</Button>
        </div>

        {benefitError && <Alert variant="error" message={benefitError} />}
        {!benefitError && !benefits && <p className="text-sm text-sand-300/60">Жүктелуде...</p>}

        <div className="flex flex-col gap-3">
          {benefits?.map((b) => (
            <Card key={b.id} className="flex items-center justify-between gap-4">
              <div className="flex flex-1 cursor-pointer items-center gap-3" onClick={() => navigate(`/admin/benefits/${b.id}/edit`)}>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-turquoise-500/10 px-2.5 py-1 text-xs font-medium text-turquoise-300 ring-1 ring-inset ring-turquoise-400/20">
                  <span className="font-mono text-sm font-semibold">{b.priority}</span>
                  <span className="text-turquoise-300/70">приоритет</span>
                </span>
                <div>
                  <p className="font-medium text-sand-100">{b.name}</p>
                  <p className="text-sm text-sand-300/60">{b.description}</p>
                </div>
              </div>
              <DeleteIconButton onClick={() => setDeleteBenefitTarget(b)} />
            </Card>
          ))}
          {benefits && benefits.length === 0 && (
            <p className="text-sm text-sand-300/60">Льгота жоқ</p>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={deleteDocTarget != null}
        title="Құжатты өшіру"
        message={`"${deleteDocTarget?.name}" құжатын өшіргіңіз келе ме? Бұл әрекетті қайтару мүмкін емес.`}
        danger
        isLoading={isDeletingDoc}
        onConfirm={handleDeleteDocument}
        onCancel={() => setDeleteDocTarget(null)}
      />

      <ConfirmDialog
        open={deleteBenefitTarget != null}
        title="Льготаны өшіру"
        message={`"${deleteBenefitTarget?.name}" льготасын өшіргіңіз келе ме? Бұл әрекетті қайтару мүмкін емес.`}
        danger
        isLoading={isDeletingBenefit}
        onConfirm={handleDeleteBenefit}
        onCancel={() => setDeleteBenefitTarget(null)}
      />
    </div>
  )
}
