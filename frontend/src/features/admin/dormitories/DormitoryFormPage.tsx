import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card } from '../../../components/Card'
import { Input } from '../../../components/Input'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { extractErrorMessage } from '../../../api/client'
import {
  addDormitoryImage,
  createDormitory,
  deleteDormitoryImage,
  getDormitory,
  listDormitoryImages,
  updateDormitory,
} from '../../../api/dormitoryApi'
import type { DormitoryImage } from '../../../types/dormitories'

export function DormitoryFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [totalCapacity, setTotalCapacity] = useState('')
  const [qrUrl, setQrUrl] = useState('')

  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [images, setImages] = useState<DormitoryImage[]>([])
  const [newImageUrl, setNewImageUrl] = useState('')
  const [imageError, setImageError] = useState<string | null>(null)

  function loadImages(dormitoryId: string) {
    listDormitoryImages(dormitoryId).then(setImages).catch(() => {})
  }

  useEffect(() => {
    if (!id) return
    getDormitory(id)
      .then((d) => {
        setName(d.name)
        setAddress(d.address)
        setTotalCapacity(String(d.total_capacity))
        setQrUrl(d.payment_qr_code_url ?? '')
      })
      .catch((err) => setLoadError(extractErrorMessage(err, 'Жүктеу сәтсіз аяқталды')))
    loadImages(id)
  }, [id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    setIsSubmitting(true)
    const payload = {
      name,
      address,
      total_capacity: Number(totalCapacity),
      payment_qr_code_url: qrUrl.trim() || null,
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
    if (!id || !newImageUrl.trim()) return
    setImageError(null)
    try {
      await addDormitoryImage(id, newImageUrl.trim())
      setNewImageUrl('')
      loadImages(id)
    } catch (err) {
      setImageError(extractErrorMessage(err, 'Сурет қосу сәтсіз аяқталды'))
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

  if (loadError) return <Alert variant="error" message={loadError} />

  return (
    <div className="flex flex-col gap-6">
      <Card title={isEdit ? 'Жатақхананы өзгерту' : 'Жаңа жатақхана'}>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          {submitError && <Alert variant="error" message={submitError} />}
          <Input label="Атауы" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input
            label="Мекенжайы"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
          />
          <Input
            label="Жалпы сыйымдылық"
            type="number"
            min={0}
            value={totalCapacity}
            onChange={(e) => setTotalCapacity(e.target.value)}
            required
          />
          <Input
            label="Төлем QR-код URL-і"
            type="url"
            value={qrUrl}
            onChange={(e) => setQrUrl(e.target.value)}
          />
          <Button type="submit" isLoading={isSubmitting} className="self-start">
            Сақтау
          </Button>
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
                  className="truncate text-indigo-600 hover:underline"
                >
                  {img.image_url}
                </a>
                <button
                  type="button"
                  className="text-red-600 hover:underline"
                  onClick={() => handleDeleteImage(img.id)}
                >
                  Өшіру
                </button>
              </li>
            ))}
            {images.length === 0 && <p className="text-sm text-gray-500">Сурет қосылмаған</p>}
          </ul>
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="Сурет URL-і"
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
              value={newImageUrl}
              onChange={(e) => setNewImageUrl(e.target.value)}
            />
            <Button type="button" variant="secondary" onClick={handleAddImage}>
              URL қос
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
