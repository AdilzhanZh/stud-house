import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card } from '../../../components/Card'
import { Input } from '../../../components/Input'
import { Select } from '../../../components/Select'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { extractErrorMessage } from '../../../api/client'
import {
  addDormitoryImage,
  addDormitoryRequiredDocument,
  createDormitory,
  deleteDormitoryImage,
  deleteDormitoryRequiredDocument,
  getDormitory,
  listDormitoryImages,
  listDormitoryRequiredDocuments,
  updateDormitory,
} from '../../../api/dormitoryApi'
import { listRequiredDocuments } from '../../../api/documentApi'
import { listReportTemplates } from '../../../api/reportTemplateApi'
import { uploadFile } from '../../../api/uploadApi'
import type { DormitoryImage, DormitoryRequiredDocument, DormitoryType } from '../../../types/dormitories'
import type { RequiredDocument } from '../../../types/documents'
import type { ReportTemplate } from '../../../types/reports'

export function DormitoryFormPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('+7')
  const [dormType, setDormType] = useState<DormitoryType | ''>('')
  const [floorCount, setFloorCount] = useState('')
  const [totalRoomsTarget, setTotalRoomsTarget] = useState('')
  const [totalCapacity, setTotalCapacity] = useState('')
  const [roomsMale, setRoomsMale] = useState('')
  const [roomsFemale, setRoomsFemale] = useState('')
  const [roomsMixed, setRoomsMixed] = useState('')
  const [monthlyPayment, setMonthlyPayment] = useState('')
  const [yearlyPayment, setYearlyPayment] = useState('')
  const [builtYear, setBuiltYear] = useState('')
  const [commissionedYear, setCommissionedYear] = useState('')
  const [ownershipForm, setOwnershipForm] = useState('')
  const [closedForApplications, setClosedForApplications] = useState(false)
  const [defaultReportTemplateId, setDefaultReportTemplateId] = useState('')
  const [reportTemplates, setReportTemplates] = useState<ReportTemplate[]>([])

  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [images, setImages] = useState<DormitoryImage[]>([])
  const [newImageFile, setNewImageFile] = useState<File | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  const [isUploadingImage, setIsUploadingImage] = useState(false)

  const [catalog, setCatalog] = useState<RequiredDocument[]>([])
  const [assignedDocs, setAssignedDocs] = useState<DormitoryRequiredDocument[]>([])
  const [documentError, setDocumentError] = useState<string | null>(null)
  const [togglingDocId, setTogglingDocId] = useState<string | null>(null)

  function loadImages(dormitoryId: string) {
    listDormitoryImages(dormitoryId).then(setImages).catch(() => {})
  }

  function loadDocuments(dormitoryId: string) {
    listDormitoryRequiredDocuments(dormitoryId).then(setAssignedDocs).catch(() => {})
  }

  useEffect(() => {
    listRequiredDocuments().then(setCatalog).catch(() => {})
    listReportTemplates().then(setReportTemplates).catch(() => {})
    if (!id) return
    getDormitory(id)
      .then((d) => {
        setName(d.name)
        setAddress(d.address)
        setPhone(d.phone ?? '+7')
        setDormType(d.dorm_type ?? '')
        setFloorCount(d.floor_count != null ? String(d.floor_count) : '')
        setTotalRoomsTarget(d.total_rooms_target != null ? String(d.total_rooms_target) : '')
        setTotalCapacity(String(d.total_capacity))
        setRoomsMale(d.rooms_male != null ? String(d.rooms_male) : '')
        setRoomsFemale(d.rooms_female != null ? String(d.rooms_female) : '')
        setRoomsMixed(d.rooms_mixed != null ? String(d.rooms_mixed) : '')
        setMonthlyPayment(d.monthly_payment != null ? String(d.monthly_payment) : '')
        setYearlyPayment(d.yearly_payment != null ? String(d.yearly_payment) : '')
        setBuiltYear(d.built_year?.slice(0, 10) ?? '')
        setCommissionedYear(d.commissioned_year?.slice(0, 10) ?? '')
        setOwnershipForm(d.ownership_form ?? '')
        setClosedForApplications(d.closed_for_applications)
        setDefaultReportTemplateId(d.default_report_template_id ?? '')
      })
      .catch((err) => setLoadError(extractErrorMessage(err, t('admin.common.loadError'))))
    loadImages(id)
    loadDocuments(id)
  }, [id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    setIsSubmitting(true)
    const payload = {
      name,
      address,
      phone: phone.trim() || null,
      dorm_type: dormType || null,
      floor_count: floorCount ? Number(floorCount) : null,
      total_rooms_target: totalRoomsTarget ? Number(totalRoomsTarget) : null,
      total_capacity: Number(totalCapacity),
      rooms_male: roomsMale ? Number(roomsMale) : null,
      rooms_female: roomsFemale ? Number(roomsFemale) : null,
      rooms_mixed: roomsMixed ? Number(roomsMixed) : null,
      monthly_payment: monthlyPayment ? Number(monthlyPayment) : null,
      yearly_payment: yearlyPayment ? Number(yearlyPayment) : null,
      built_year: builtYear || null,
      commissioned_year: commissionedYear || null,
      ownership_form: ownershipForm.trim() || null,
      closed_for_applications: closedForApplications,
      default_report_template_id: defaultReportTemplateId || null,
    }
    try {
      if (isEdit && id) {
        await updateDormitory(id, payload)
        navigate('/admin/dormitories')
      } else {
        const created = await createDormitory(payload)
        navigate(`/admin/dormitories/${created.id}/edit`, { replace: true })
      }
    } catch (err) {
      setSubmitError(extractErrorMessage(err, t('admin.common.saveFailed')))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleAddImage() {
    if (!id || !newImageFile) return
    setImageError(null)
    setIsUploadingImage(true)
    try {
      const imageUrl = await uploadFile(newImageFile)
      await addDormitoryImage(id, imageUrl)
      setNewImageFile(null)
      loadImages(id)
    } catch (err) {
      setImageError(extractErrorMessage(err, t('admin.dormitories.addImageFailed')))
    } finally {
      setIsUploadingImage(false)
    }
  }

  async function handleDeleteImage(imageId: string) {
    if (!id) return
    try {
      await deleteDormitoryImage(id, imageId)
      loadImages(id)
    } catch (err) {
      setImageError(extractErrorMessage(err, t('admin.dormitories.deleteImageFailed')))
    }
  }

  async function handleToggleDocument(documentId: string, checked: boolean) {
    if (!id) return
    setDocumentError(null)
    setTogglingDocId(documentId)
    try {
      if (checked) {
        await addDormitoryRequiredDocument(id, documentId)
      } else {
        const assigned = assignedDocs.find((d) => d.document_id === documentId)
        if (assigned) await deleteDormitoryRequiredDocument(assigned.id)
      }
      loadDocuments(id)
    } catch (err) {
      setDocumentError(extractErrorMessage(err, t('admin.dormitories.saveDocumentFailed')))
    } finally {
      setTogglingDocId(null)
    }
  }

  if (loadError) return <Alert variant="error" message={loadError} />

  return (
    <div className="flex flex-col gap-6">
      <Button variant="secondary" className="self-start" onClick={() => navigate('/admin/dormitories')}>
        ← {t('admin.common.back')}
      </Button>

      <Card title={isEdit ? t('admin.dormitories.editTitle') : t('admin.dormitories.new')}>
        <form id="dormitory-form" className="flex flex-col gap-4" onSubmit={handleSubmit}>
          {submitError && <Alert variant="error" message={submitError} />}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label={t('admin.dormitories.name')} value={name} onChange={(e) => setName(e.target.value)} required />
            <Input
              label={t('admin.dormitories.address')}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label={t('admin.dormitories.contactPhone')}
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^0-9+()\s-]/g, ''))}
            />
            <Select
              label={t('admin.dormitories.type')}
              value={dormType}
              onChange={(e) => setDormType(e.target.value as DormitoryType | '')}
              required
            >
              <option value="">{t('admin.common.select')}</option>
              <option value="sectional">{t('admin.dormitories.typeSectional')}</option>
              <option value="corridor">{t('admin.dormitories.typeCorridor')}</option>
              <option value="block">{t('admin.dormitories.typeBlock')}</option>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input
              label={t('admin.dormitories.floorCount')}
              type="number"
              min={0}
              value={floorCount}
              onChange={(e) => setFloorCount(e.target.value)}
              required
            />
            <Input
              label={t('admin.dormitories.totalRoomsTarget')}
              type="number"
              min={0}
              value={totalRoomsTarget}
              onChange={(e) => setTotalRoomsTarget(e.target.value)}
              required
            />
            <Input
              label={t('admin.dormitories.totalCapacity')}
              type="number"
              min={0}
              value={totalCapacity}
              onChange={(e) => setTotalCapacity(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input
              label={t('admin.dormitories.roomsMale')}
              type="number"
              min={0}
              value={roomsMale}
              onChange={(e) => setRoomsMale(e.target.value)}
              required
            />
            <Input
              label={t('admin.dormitories.roomsFemale')}
              type="number"
              min={0}
              value={roomsFemale}
              onChange={(e) => setRoomsFemale(e.target.value)}
              required
            />
            <Input
              label={t('admin.dormitories.roomsMixed')}
              type="number"
              min={0}
              value={roomsMixed}
              onChange={(e) => setRoomsMixed(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label={t('admin.dormitories.monthlyPayment')}
              type="number"
              min={0}
              value={monthlyPayment}
              onChange={(e) => setMonthlyPayment(e.target.value)}
            />
            <Input
              label={t('admin.dormitories.yearlyPayment')}
              type="number"
              min={0}
              value={yearlyPayment}
              onChange={(e) => setYearlyPayment(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label={t('admin.dormitories.builtYear')}
              type="date"
              value={builtYear}
              onChange={(e) => setBuiltYear(e.target.value)}
            />
            <Input
              label={t('admin.dormitories.commissionedYear')}
              type="date"
              value={commissionedYear}
              onChange={(e) => setCommissionedYear(e.target.value)}
            />
          </div>

          <Input
            label={t('admin.dormitories.ownershipForm')}
            value={ownershipForm}
            onChange={(e) => setOwnershipForm(e.target.value)}
            placeholder={t('admin.dormitories.ownershipFormPlaceholder')}
          />

          <label className="flex cursor-pointer items-start gap-2.5 text-sm text-sand-100">
            <input
              type="checkbox"
              className="mt-0.5 h-4.5 w-4.5 accent-clay-500"
              checked={closedForApplications}
              onChange={(e) => setClosedForApplications(e.target.checked)}
            />
            <span>
              {t('admin.dormitories.closedForApplications')}
              <span className="mt-0.5 block text-xs font-normal text-sand-300">
                {t('admin.dormitories.closedForApplicationsHint')}
              </span>
            </span>
          </label>

          <Select
            label={t('admin.dormitories.defaultTemplate')}
            value={defaultReportTemplateId}
            onChange={(e) => setDefaultReportTemplateId(e.target.value)}
          >
            <option value="">{t('admin.common.none')}</option>
            {reportTemplates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.name}
              </option>
            ))}
          </Select>
        </form>
      </Card>

      {isEdit && id && (
        <Card title={t('admin.dormitories.images')}>
          {imageError && <Alert variant="error" message={imageError} />}
          <ul className="mb-4 flex flex-col gap-2">
            {images.map((img) => (
              <li key={img.id} className="flex items-center justify-between gap-3 text-sm">
                <a
                  href={img.image_url}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-turquoise-400 hover:underline"
                >
                  {img.image_url}
                </a>
                <button
                  type="button"
                  className="text-clay-400 hover:underline"
                  onClick={() => handleDeleteImage(img.id)}
                >
                  {t('common.delete')}
                </button>
              </li>
            ))}
            {images.length === 0 && <p className="text-sm text-sand-300">{t('admin.dormitories.noImages')}</p>}
          </ul>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-sand-200">
              {t('admin.dormitories.image')}
              {images.length === 0 ? (
                <span className="text-clay-400"> *</span>
              ) : (
                <span className="ml-1 text-xs font-normal text-sand-400">{t('admin.common.optional')}</span>
              )}
            </label>
            <div className="flex gap-2">
              <input
                type="file"
                accept="image/*"
                required={images.length === 0}
                onChange={(e) => setNewImageFile(e.target.files?.[0] ?? null)}
                className="flex-1 rounded-[14px] border border-navy-700 bg-navy-950 px-3.5 py-2.5 text-sand-100 text-sm outline-none file:mr-3 file:rounded-lg file:border-0 file:bg-turquoise-500/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-turquoise-400 hover:file:bg-turquoise-500/15 focus:border-turquoise-400 focus:ring-4 focus:ring-turquoise-400/15"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={handleAddImage}
                isLoading={isUploadingImage}
                disabled={!newImageFile}
              >
                {t('admin.common.add')}
              </Button>
            </div>
          </div>
        </Card>
      )}

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
                    {doc.name}
                  </label>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      <Button type="submit" form="dormitory-form" isLoading={isSubmitting} className="self-start">
        {t('admin.common.save')}
      </Button>
    </div>
  )
}
