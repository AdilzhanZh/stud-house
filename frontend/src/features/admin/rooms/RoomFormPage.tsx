import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card } from '../../../components/Card'
import { Input } from '../../../components/Input'
import { Select } from '../../../components/Select'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { Maximize2 } from 'lucide-react'
import { ImageLightbox } from '../../../components/ImageLightbox'
import { extractErrorMessage } from '../../../api/client'
import { uploadFile } from '../../../api/uploadApi'
import { getRoom, createRoom, updateRoom, updateRoomRestrictions } from '../../../api/roomApi'
import { createFloor, listDormitoryFloors } from '../../../api/hierarchyApi'
import { floorLabel } from '../../../utils/roomLocation'
import type { Floor } from '../../../types/hierarchy'
import type { AcademicDegree, Gender } from '../../../types/rooms'

const ALL_COURSES = [1, 2, 3, 4, 5, 6]
const ALL_DEGREES: AcademicDegree[] = ['bachelor', 'master', 'doctorate']

const TEXTAREA_CLASS =
  'w-full rounded-lg border border-sand-100/15 bg-navy-900 px-4 py-3 text-sm text-sand-100 outline-none transition-colors placeholder:text-sand-400/50 focus:border-turquoise-400 focus:ring-4 focus:ring-turquoise-400/15'

function OptionalTextarea({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-sand-200">
        {label}
        <span className="ml-1 text-xs font-normal text-sand-400">{t('admin.common.optional')}</span>
      </label>
      <textarea
        id={id}
        rows={3}
        className={TEXTAREA_CLASS}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

export function RoomFormPage() {
  const { t } = useTranslation()
  const { dormitoryId, roomId } = useParams<{ dormitoryId?: string; roomId?: string }>()
  const isEdit = Boolean(roomId)
  const navigate = useNavigate()

  const [roomNumber, setRoomNumber] = useState('')
  const [searchParams] = useSearchParams()
  // ?floor=<floorId> preselects the floor the manager came from.
  const [floorId, setFloorId] = useState(searchParams.get('floor') ?? '')
  const [floors, setFloors] = useState<Floor[]>([])
  const [newFloorNumber, setNewFloorNumber] = useState('')
  const [newFloorError, setNewFloorError] = useState<string | null>(null)
  const [isAddingFloor, setIsAddingFloor] = useState(false)
  const [capacity, setCapacity] = useState('')
  const [gender, setGender] = useState<Gender | 'shared' | ''>('')
  const [courses, setCourses] = useState<number[]>([])
  const [degrees, setDegrees] = useState<AcademicDegree[]>([])
  const [area, setArea] = useState('')
  const [equipment, setEquipment] = useState('')
  const [sanitary, setSanitary] = useState('')
  const [accessible, setAccessible] = useState<'' | 'yes' | 'no'>('')
  const [accessibilityNotes, setAccessibilityNotes] = useState('')
  const [photoUrls, setPhotoUrls] = useState<string[]>([])
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [ownerDormitoryId, setOwnerDormitoryId] = useState<string | null>(dormitoryId ?? null)

  useEffect(() => {
    if (!roomId) return
    getRoom(roomId)
      .then((room) => {
        setRoomNumber(room.room_number)
        setFloorId(room.floor_id)
        setCapacity(String(room.capacity))
        setGender(room.restrictions.gender ?? 'shared')
        setCourses(room.restrictions.courses ?? [])
        setDegrees(room.restrictions.degrees ?? [])
        setArea(room.area_sq_m != null ? String(room.area_sq_m) : '')
        setEquipment(room.equipment ?? '')
        setSanitary(room.sanitary_conditions ?? '')
        setAccessible(room.is_accessible == null ? '' : room.is_accessible ? 'yes' : 'no')
        setAccessibilityNotes(room.accessibility_notes ?? '')
        setPhotoUrls(room.photo_urls ?? [])
        setOwnerDormitoryId(room.dormitory_id)
      })
      .catch((err) => setLoadError(extractErrorMessage(err, t('admin.common.loadError'))))
  }, [roomId])

  function loadFloors(dormId: string) {
    listDormitoryFloors(dormId)
      .then(setFloors)
      .catch((err) => setLoadError(extractErrorMessage(err, t('admin.common.loadError'))))
  }

  useEffect(() => {
    if (ownerDormitoryId) loadFloors(ownerDormitoryId)
  }, [ownerDormitoryId])

  async function handleAddFloor() {
    const number = Number(newFloorNumber)
    if (!ownerDormitoryId || newFloorNumber.trim() === '' || !Number.isInteger(number)) return
    setNewFloorError(null)
    setIsAddingFloor(true)
    try {
      const created = await createFloor(ownerDormitoryId, { number, name: null })
      setFloors((prev) => [...prev, created])
      setFloorId(created.id)
      setNewFloorNumber('')
    } catch (err) {
      setNewFloorError(extractErrorMessage(err, t('admin.rooms.saveFailedGeneric')))
    } finally {
      setIsAddingFloor(false)
    }
  }

  function toggleCourse(course: number) {
    setCourses((prev) =>
      prev.includes(course) ? prev.filter((c) => c !== course) : [...prev, course].sort(),
    )
  }

  function toggleDegree(degree: AcademicDegree) {
    setDegrees((prev) =>
      prev.includes(degree) ? prev.filter((d) => d !== degree) : [...prev, degree],
    )
  }

  async function handlePhotoFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setPhotoError(null)
    setIsUploadingPhoto(true)
    try {
      const uploaded: string[] = []
      for (const file of Array.from(files)) {
        uploaded.push(await uploadFile(file))
      }
      setPhotoUrls((prev) => [...prev, ...uploaded])
    } catch (err) {
      setPhotoError(extractErrorMessage(err, t('admin.dormitories.addImageFailed')))
    } finally {
      setIsUploadingPhoto(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    const capacityNum = Number(capacity || 0)
    if (capacityNum <= 0) {
      setSubmitError(t('admin.rooms.capacityPositiveError'))
      return
    }
    const areaNum = area.trim() ? Number(area.replace(',', '.')) : null
    if (areaNum != null && !(areaNum > 0)) {
      setSubmitError(t('admin.rooms.areaPositiveError'))
      return
    }
    setIsSubmitting(true)
    const payload = {
      room_number: roomNumber,
      capacity: capacityNum,
      floor_id: floorId,
      category: 'general',
      area_sq_m: areaNum,
      equipment: equipment.trim() || null,
      sanitary_conditions: sanitary.trim() || null,
      is_accessible: accessible === '' ? null : accessible === 'yes',
      accessibility_notes: accessibilityNotes.trim() || null,
      photo_urls: photoUrls,
    }
    try {
      const room = isEdit && roomId ? await updateRoom(roomId, payload) : await createRoom(dormitoryId!, payload)
      await updateRoomRestrictions(room.id, {
        gender: gender === 'shared' ? null : gender || null,
        courses,
        degrees,
        benefit_ids: room.restrictions?.benefit_ids ?? [],
      })
      navigate(`/admin/dormitories/${ownerDormitoryId ?? dormitoryId}`)
    } catch (err) {
      setSubmitError(extractErrorMessage(err, t('admin.common.saveFailed')))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loadError) return <Alert variant="error" message={loadError} />

  return (
    <div className="flex flex-col gap-6">
      <Button
        variant="secondary"
        className="self-start"
        onClick={() => navigate(`/admin/dormitories/${ownerDormitoryId ?? dormitoryId}`)}
      >
        ← {t('admin.common.back')}
      </Button>

      <Card title={isEdit ? t('admin.rooms.editTitle') : t('admin.rooms.newTitle')}>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        {submitError && <Alert variant="error" message={submitError} />}
        <Input
          label={t('admin.dormitories.roomNumber')}
          value={roomNumber}
          onChange={(e) => setRoomNumber(e.target.value)}
          required
        />
        <Input
          label={t('admin.rooms.capacityLabel')}
          type="number"
          min={0}
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          required
        />
        <Select
          label={t('admin.rooms.floorLabel')}
          value={floorId}
          onChange={(e) => setFloorId(e.target.value)}
          required
        >
          <option value="" disabled>
            {t('admin.common.select')}
          </option>
          {floors.map((f) => (
            <option key={f.id} value={f.id}>
              {floorLabel(f, t)}
            </option>
          ))}
        </Select>
        <div className="-mt-1 flex flex-col gap-2 rounded-lg bg-navy-950/40 p-3">
          <span className="text-xs font-medium text-sand-300">{t('admin.rooms.newFloorInline')}</span>
          {newFloorError && <Alert variant="error" message={newFloorError} />}
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-32">
              <Input
                label={t('admin.rooms.floorNumber')}
                type="number"
                value={newFloorNumber}
                onChange={(e) => setNewFloorNumber(e.target.value)}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={handleAddFloor}
              isLoading={isAddingFloor}
              disabled={newFloorNumber.trim() === '' || !ownerDormitoryId}
            >
              {t('admin.rooms.addFloor')}
            </Button>
          </div>
        </div>
        <Select
          label={t('admin.rooms.genderRestriction')}
          value={gender}
          onChange={(e) => setGender(e.target.value as Gender | 'shared' | '')}
          required
        >
          <option value="" disabled>
            {t('admin.common.select')}
          </option>
          <option value="shared">{t('admin.rooms.sharedGender')}</option>
          <option value="male">{t('admin.dormitories.male')}</option>
          <option value="female">{t('admin.dormitories.female')}</option>
        </Select>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-sand-200">
            {t('admin.rooms.courseRestriction')}
            <span className="ml-1 text-xs font-normal text-sand-400">{t('admin.common.optional')}</span>
          </span>
          <div className="flex flex-wrap gap-3">
            {ALL_COURSES.map((course) => (
              <label key={course} className="flex items-center gap-1.5 text-sm text-sand-200">
                <input
                  type="checkbox"
                  checked={courses.includes(course)}
                  onChange={() => toggleCourse(course)}
                />
                {course}
              </label>
            ))}
          </div>
          <p className="text-xs text-sand-300">{t('admin.rooms.noCourseSelectedHint')}</p>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-sand-200">
            {t('admin.rooms.degreeRestriction')}
            <span className="ml-1 text-xs font-normal text-sand-400">{t('admin.common.optional')}</span>
          </span>
          <div className="flex flex-wrap gap-3">
            {ALL_DEGREES.map((degree) => (
              <label key={degree} className="flex items-center gap-1.5 text-sm text-sand-200">
                <input
                  type="checkbox"
                  checked={degrees.includes(degree)}
                  onChange={() => toggleDegree(degree)}
                />
                {t(`auth.${degree}`)}
              </label>
            ))}
          </div>
          <p className="text-xs text-sand-300">{t('admin.rooms.noDegreeSelectedHint')}</p>
        </div>

        <div className="mt-2 border-t border-sand-100/10 pt-4">
          <h3 className="text-sm font-semibold text-sand-100">{t('admin.rooms.detailsTitle')}</h3>
          <p className="text-xs text-sand-300">{t('admin.rooms.detailsHint')}</p>
        </div>
        <Input
          label={t('admin.rooms.areaLabel')}
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          value={area}
          onChange={(e) => setArea(e.target.value)}
        />
        <OptionalTextarea
          id="room-equipment"
          label={t('admin.rooms.equipmentLabel')}
          placeholder={t('admin.rooms.equipmentPlaceholder')}
          value={equipment}
          onChange={setEquipment}
        />
        <OptionalTextarea
          id="room-sanitary"
          label={t('admin.rooms.sanitaryLabel')}
          placeholder={t('admin.rooms.sanitaryPlaceholder')}
          value={sanitary}
          onChange={setSanitary}
        />
        <Select
          label={t('admin.rooms.accessibleLabel')}
          value={accessible}
          onChange={(e) => setAccessible(e.target.value as '' | 'yes' | 'no')}
        >
          <option value="">{t('admin.rooms.notSpecified')}</option>
          <option value="yes">{t('admin.rooms.accessibleYes')}</option>
          <option value="no">{t('admin.rooms.accessibleNo')}</option>
        </Select>
        <OptionalTextarea
          id="room-accessibility-notes"
          label={t('admin.rooms.accessibilityNotesLabel')}
          placeholder={t('admin.rooms.accessibilityNotesPlaceholder')}
          value={accessibilityNotes}
          onChange={setAccessibilityNotes}
        />
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-sand-200">
            {t('admin.rooms.photosLabel')}
            <span className="ml-1 text-xs font-normal text-sand-400">{t('admin.common.optional')}</span>
          </span>
          {photoError && <Alert variant="error" message={photoError} />}
          {photoUrls.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {photoUrls.map((url, i) => (
                <div key={url} className="group relative h-24 overflow-hidden rounded-lg">
                  <img
                    src={url}
                    alt=""
                    className="h-full w-full cursor-pointer object-cover"
                    onClick={() => setLightboxIndex(i)}
                  />
                  <button
                    type="button"
                    onClick={() => setLightboxIndex(i)}
                    aria-label={t('dorm.viewInFull')}
                    className="absolute top-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-navy-950/60 text-sand-100 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 hover:bg-navy-950/80"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhotoUrls((prev) => prev.filter((u) => u !== url))}
                    className="absolute bottom-1.5 right-1.5 rounded-full bg-navy-950/60 px-2 py-1 text-xs font-semibold text-clay-400 backdrop-blur-sm hover:bg-navy-950/80"
                  >
                    {t('common.delete')}
                  </button>
                </div>
              ))}
            </div>
          )}
          {lightboxIndex != null && (
            <ImageLightbox
              imageUrls={photoUrls}
              initialIndex={lightboxIndex}
              alt={t('admin.rooms.photosLabel')}
              onClose={() => setLightboxIndex(null)}
            />
          )}
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={isUploadingPhoto}
            onChange={(e) => {
              void handlePhotoFiles(e.target.files)
              e.target.value = ''
            }}
            className="rounded-lg border border-navy-700 bg-navy-950 px-3.5 py-2.5 text-sand-100 text-sm outline-none file:mr-3 file:rounded-lg file:border-0 file:bg-turquoise-500/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-turquoise-400 hover:file:bg-turquoise-500/15 focus:border-turquoise-400 focus:ring-4 focus:ring-turquoise-400/15"
          />
          {isUploadingPhoto && <p className="text-xs text-sand-300">{t('admin.rooms.uploadingPhotos')}</p>}
        </div>
        <Button type="submit" isLoading={isSubmitting} disabled={isUploadingPhoto} className="self-start">
          {t('admin.common.save')}
        </Button>
      </form>
      </Card>
    </div>
  )
}
