import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { DeleteIconButton } from '../../../components/DeleteIconButton'
import { extractErrorMessage } from '../../../api/client'
import { bilingualField } from '../../../utils/bilingualField'
import {
  createRequiredDocument,
  deleteRequiredDocument,
  listRequiredDocuments,
  setRequiredDocumentValidity,
} from '../../../api/documentApi'
import { deleteBenefit, listBenefits } from '../../../api/benefitApi'
import type { RequiredDocument } from '../../../types/documents'
import type { Benefit } from '../../../types/benefits'

const inputClass =
  'rounded-[14px] border border-navy-700 bg-navy-950 px-3.5 py-2.5 text-sand-100 text-sm outline-none focus:border-turquoise-400 focus:ring-4 focus:ring-turquoise-400/15'

// "" -> null (never expires); anything else must be a positive whole number.
function parseValidity(raw: string): number | null | undefined {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const n = Number(trimmed)
  return Number.isInteger(n) && n > 0 ? n : undefined
}

// Validity period of one catalog entry, saved when the field loses focus.
function ValidityField({ doc, onSaved, onError }: { doc: RequiredDocument; onSaved: () => void; onError: (msg: string) => void }) {
  const { t } = useTranslation()
  const [value, setValue] = useState(doc.validity_days?.toString() ?? '')

  async function save() {
    const parsed = parseValidity(value)
    if (parsed === undefined) {
      onError(t('admin.documents.validityInvalid'))
      return
    }
    if (parsed === doc.validity_days) return
    try {
      await setRequiredDocumentValidity(doc.id, parsed)
      onSaved()
    } catch (err) {
      onError(extractErrorMessage(err, t('admin.documents.validitySaveFailed')))
    }
  }

  return (
    <label className="flex items-center gap-2 text-xs text-sand-300">
      {t('admin.documents.validityLabel')}
      <input
        type="number"
        min={1}
        inputMode="numeric"
        placeholder="∞"
        className={`${inputClass} w-20 !px-2.5 !py-1.5 text-right`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
      />
    </label>
  )
}

export function DocumentListPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()

  const [documents, setDocuments] = useState<RequiredDocument[] | null>(null)
  const [newDocumentNameKk, setNewDocumentNameKk] = useState('')
  const [newDocumentNameRu, setNewDocumentNameRu] = useState('')
  const [newDocumentValidity, setNewDocumentValidity] = useState('')
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
      .catch((err) => setDocumentError(extractErrorMessage(err, t('admin.documents.loadError'))))
  }

  function loadBenefits() {
    listBenefits()
      .then(setBenefits)
      .catch((err) => setBenefitError(extractErrorMessage(err, t('admin.documents.loadBenefitsError'))))
  }

  useEffect(() => {
    loadDocuments()
    loadBenefits()
  }, [])

  async function handleAddDocument() {
    const nameKk = newDocumentNameKk.trim()
    const nameRu = newDocumentNameRu.trim()
    if (!nameKk && !nameRu) return
    const validity = parseValidity(newDocumentValidity)
    if (validity === undefined) {
      setDocumentError(t('admin.documents.validityInvalid'))
      return
    }
    setDocumentError(null)
    try {
      await createRequiredDocument(nameKk, nameRu, validity)
      setNewDocumentNameKk('')
      setNewDocumentNameRu('')
      setNewDocumentValidity('')
      loadDocuments()
    } catch (err) {
      setDocumentError(extractErrorMessage(err, t('admin.documents.addFailed')))
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
      setDocumentError(extractErrorMessage(err, t('admin.documents.deleteFailed')))
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
      setBenefitError(extractErrorMessage(err, t('admin.benefits.deleteFailed')))
    } finally {
      setIsDeletingBenefit(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[23px] font-bold text-sand-100">{t('admin.layout.documents')}</h1>

      <Card title={t('admin.documents.catalogTitle')}>
        {documentError && <Alert variant="error" message={documentError} />}
        <p className="mb-3 text-xs text-sand-300">{t('admin.documents.validityHint')}</p>
        <ul className="mb-4 flex flex-col gap-2">
          {documents?.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
              <span className="flex-1 text-sand-100">{bilingualField(d.name_kk, d.name_ru, i18n.language)}</span>
              <ValidityField doc={d} onSaved={loadDocuments} onError={setDocumentError} />
              <DeleteIconButton onClick={() => setDeleteDocTarget(d)} />
            </li>
          ))}
          {documents && documents.length === 0 && (
            <p className="text-sm text-sand-300">{t('admin.documents.empty')}</p>
          )}
          {!documents && !documentError && <p className="text-sm text-sand-300">{t('admin.common.loading')}</p>}
        </ul>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            placeholder={t('admin.documents.namePlaceholderKk')}
            className="flex-1 rounded-[14px] border border-navy-700 bg-navy-950 px-3.5 py-2.5 text-sand-100 text-sm outline-none focus:border-turquoise-400 focus:ring-4 focus:ring-turquoise-400/15"
            value={newDocumentNameKk}
            onChange={(e) => setNewDocumentNameKk(e.target.value)}
          />
          <input
            placeholder={t('admin.documents.namePlaceholderRu')}
            className="flex-1 rounded-[14px] border border-navy-700 bg-navy-950 px-3.5 py-2.5 text-sand-100 text-sm outline-none focus:border-turquoise-400 focus:ring-4 focus:ring-turquoise-400/15"
            value={newDocumentNameRu}
            onChange={(e) => setNewDocumentNameRu(e.target.value)}
          />
          <input
            type="number"
            min={1}
            inputMode="numeric"
            placeholder={t('admin.documents.validityPlaceholder')}
            className={`${inputClass} sm:w-44`}
            value={newDocumentValidity}
            onChange={(e) => setNewDocumentValidity(e.target.value)}
          />
          <Button type="button" variant="secondary" onClick={handleAddDocument}>
            {t('admin.common.add')}
          </Button>
        </div>
      </Card>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg text-sand-100">{t('admin.benefits.title')}</h2>
          <Button onClick={() => navigate('/admin/benefits/new')}>{t('admin.benefits.newTitle')}</Button>
        </div>

        {benefitError && <Alert variant="error" message={benefitError} />}
        {!benefitError && !benefits && <p className="text-sm text-sand-300">{t('admin.common.loading')}</p>}

        <div className="flex flex-col gap-3">
          {benefits?.map((b) => (
            <Card key={b.id} className="flex items-center justify-between gap-4">
              <div className="flex flex-1 cursor-pointer items-center gap-3" onClick={() => navigate(`/admin/benefits/${b.id}/edit`)}>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-turquoise-500/10 px-2.5 py-1 text-xs font-medium text-turquoise-300 ring-1 ring-inset ring-turquoise-400/20">
                  <span className="font-mono text-sm font-semibold">{b.priority}</span>
                  <span className="text-turquoise-300/70">{t('admin.benefits.priority')}</span>
                </span>
                <div>
                  <p className="font-medium text-sand-100">{bilingualField(b.name_kk, b.name_ru, i18n.language)}</p>
                  <p className="text-sm text-sand-300">
                    {bilingualField(b.description_kk, b.description_ru, i18n.language)}
                  </p>
                </div>
              </div>
              <DeleteIconButton onClick={() => setDeleteBenefitTarget(b)} />
            </Card>
          ))}
          {benefits && benefits.length === 0 && (
            <p className="text-sm text-sand-300">{t('admin.benefits.empty')}</p>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={deleteDocTarget != null}
        title={t('admin.documents.deleteTitle')}
        message={t('admin.documents.deleteConfirm', {
          name: deleteDocTarget && bilingualField(deleteDocTarget.name_kk, deleteDocTarget.name_ru, i18n.language),
        })}
        danger
        isLoading={isDeletingDoc}
        onConfirm={handleDeleteDocument}
        onCancel={() => setDeleteDocTarget(null)}
      />

      <ConfirmDialog
        open={deleteBenefitTarget != null}
        title={t('admin.benefits.deleteTitle')}
        message={t('admin.benefits.deleteConfirm', {
          name:
            deleteBenefitTarget &&
            bilingualField(deleteBenefitTarget.name_kk, deleteBenefitTarget.name_ru, i18n.language),
        })}
        danger
        isLoading={isDeletingBenefit}
        onConfirm={handleDeleteBenefit}
        onCancel={() => setDeleteBenefitTarget(null)}
      />
    </div>
  )
}
