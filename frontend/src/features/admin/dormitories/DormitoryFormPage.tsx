import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
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
import { uploadFile } from '../../../api/uploadApi'
import type { DormitoryImage, DormitoryRequiredDocument, DormitoryType } from '../../../types/dormitories'
import type { RequiredDocument } from '../../../types/documents'

export function DormitoryFormPage() {
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
      })
      .catch((err) => setLoadError(extractErrorMessage(err, 'Жүктеу сәтсіз аяқталды')))
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
      setSubmitError(extractErrorMessage(err, 'Сақтау сәтсіз аяқталды'))
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
      setImageError(extractErrorMessage(err, 'Сурет қосу сәтсіз аяқталды'))
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
      setImageError(extractErrorMessage(err, 'Суретті өшіру сәтсіз аяқталды'))
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
      setDocumentError(extractErrorMessage(err, 'Құжатты сақтау сәтсіз аяқталды'))
    } finally {
      setTogglingDocId(null)
    }
  }

  if (loadError) return <Alert variant="error" message={loadError} />

  return (
    <div className="flex flex-col gap-6">
      <Button variant="secondary" className="self-start" onClick={() => navigate('/admin/dormitories')}>
        ← Артқа
      </Button>

      <Card title={isEdit ? 'Жатақхананы өзгерту' : 'Жаңа жатақхана'}>
        <form id="dormitory-form" className="flex flex-col gap-4" onSubmit={handleSubmit}>
          {submitError && <Alert variant="error" message={submitError} />}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Атауы" value={name} onChange={(e) => setName(e.target.value)} required />
            <Input
              label="Мекен-жайы"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Байланыс телефоны"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^0-9+()\s-]/g, ''))}
            />
            <Select
              label="Жатақхана түрі"
              value={dormType}
              onChange={(e) => setDormType(e.target.value as DormitoryType | '')}
              required
            >
              <option value="">Таңдаңыз</option>
              <option value="sectional">Секциялық (Sectional)</option>
              <option value="corridor">Дәліздік (Corridor)</option>
              <option value="block">Блоктық (Block)</option>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input
              label="Қабат саны"
              type="number"
              min={0}
              value={floorCount}
              onChange={(e) => setFloorCount(e.target.value)}
              required
            />
            <Input
              label="Жалпы бөлме саны"
              type="number"
              min={0}
              value={totalRoomsTarget}
              onChange={(e) => setTotalRoomsTarget(e.target.value)}
              required
            />
            <Input
              label="Жалпы орын саны"
              type="number"
              min={0}
              value={totalCapacity}
              onChange={(e) => setTotalCapacity(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input
              label="Ерлерге арналған бөлме саны"
              type="number"
              min={0}
              value={roomsMale}
              onChange={(e) => setRoomsMale(e.target.value)}
              required
            />
            <Input
              label="Қыздарға арналған бөлме саны"
              type="number"
              min={0}
              value={roomsFemale}
              onChange={(e) => setRoomsFemale(e.target.value)}
              required
            />
            <Input
              label="Ортақ бөлме саны"
              type="number"
              min={0}
              value={roomsMixed}
              onChange={(e) => setRoomsMixed(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Айлық жалдау ақысы (T)"
              type="number"
              min={0}
              value={monthlyPayment}
              onChange={(e) => setMonthlyPayment(e.target.value)}
            />
            <Input
              label="Жылдық жалдау ақысы (T)"
              type="number"
              min={0}
              value={yearlyPayment}
              onChange={(e) => setYearlyPayment(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Салынған жылы"
              type="date"
              value={builtYear}
              onChange={(e) => setBuiltYear(e.target.value)}
            />
            <Input
              label="Пайдалануға берілген жылы"
              type="date"
              value={commissionedYear}
              onChange={(e) => setCommissionedYear(e.target.value)}
            />
          </div>

          <Input
            label="Меншік нысаны (Ownership Form)"
            value={ownershipForm}
            onChange={(e) => setOwnershipForm(e.target.value)}
            placeholder="мысалы: university"
          />

        </form>
      </Card>

      {isEdit && id && (
        <Card title="Суреттер">
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
                  Өшіру
                </button>
              </li>
            ))}
            {images.length === 0 && <p className="text-sm text-sand-300/60">Сурет қосылмаған</p>}
          </ul>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-sand-200">
              Сурет
              {images.length === 0 ? (
                <span className="text-clay-400"> *</span>
              ) : (
                <span className="ml-1 text-xs font-normal text-sand-400">(міндетті емес)</span>
              )}
            </label>
            <div className="flex gap-2">
              <input
                type="file"
                accept="image/*"
                required={images.length === 0}
                onChange={(e) => setNewImageFile(e.target.files?.[0] ?? null)}
                className="flex-1 rounded-md border border-sand-100/15 bg-navy-950/60 px-3 py-2 text-sand-100 text-sm outline-none file:mr-3 file:rounded-md file:border-0 file:bg-turquoise-500/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-turquoise-300 hover:file:bg-turquoise-500/15 focus:border-turquoise-400 focus:ring-2 focus:ring-turquoise-400/30"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={handleAddImage}
                isLoading={isUploadingImage}
                disabled={!newImageFile}
              >
                Қосу
              </Button>
            </div>
          </div>
        </Card>
      )}

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

      <Button type="submit" form="dormitory-form" isLoading={isSubmitting} className="self-start">
        Сақтау
      </Button>
    </div>
  )
}
