import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card } from '../../../components/Card'
import { Input } from '../../../components/Input'
import { Select } from '../../../components/Select'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { extractErrorMessage } from '../../../api/client'
import { getRoom, createRoom, updateRoom, updateRoomRestrictions } from '../../../api/roomApi'
import type { Gender } from '../../../types/rooms'

const ALL_COURSES = [1, 2, 3, 4, 5, 6]

export function RoomFormPage() {
  const { t } = useTranslation()
  const { dormitoryId, roomId } = useParams<{ dormitoryId?: string; roomId?: string }>()
  const isEdit = Boolean(roomId)
  const navigate = useNavigate()

  const [roomNumber, setRoomNumber] = useState('')
  const [floor, setFloor] = useState('')
  const [capacity, setCapacity] = useState('')
  const [gender, setGender] = useState<Gender | 'any' | ''>('')
  const [courses, setCourses] = useState<number[]>([])

  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [ownerDormitoryId, setOwnerDormitoryId] = useState<string | null>(dormitoryId ?? null)

  useEffect(() => {
    if (!roomId) return
    getRoom(roomId)
      .then((room) => {
        setRoomNumber(room.room_number)
        setFloor(room.floor != null ? String(room.floor) : '')
        setCapacity(String(room.capacity))
        setGender(room.restrictions.gender ?? 'any')
        setCourses(room.restrictions.courses ?? [])
        setOwnerDormitoryId(room.dormitory_id)
      })
      .catch((err) => setLoadError(extractErrorMessage(err, t('admin.common.loadError'))))
  }, [roomId])

  function toggleCourse(course: number) {
    setCourses((prev) =>
      prev.includes(course) ? prev.filter((c) => c !== course) : [...prev, course].sort(),
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    const capacityNum = Number(capacity || 0)
    if (capacityNum <= 0) {
      setSubmitError(t('admin.rooms.capacityPositiveError'))
      return
    }
    setIsSubmitting(true)
    const payload = {
      room_number: roomNumber,
      capacity: capacityNum,
      floor: floor ? Number(floor) : null,
      category: 'general',
    }
    try {
      const room = isEdit && roomId ? await updateRoom(roomId, payload) : await createRoom(dormitoryId!, payload)
      await updateRoomRestrictions(room.id, {
        gender: gender === 'any' ? null : gender || null,
        courses,
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
        <Input
          label={t('admin.rooms.floorLabel')}
          type="number"
          min={0}
          value={floor}
          onChange={(e) => setFloor(e.target.value)}
          required
        />
        <Select
          label={t('admin.rooms.genderRestriction')}
          value={gender}
          onChange={(e) => setGender(e.target.value as Gender | 'any' | '')}
          required
        >
          <option value="" disabled>
            {t('admin.common.select')}
          </option>
          <option value="any">{t('admin.rooms.anyGender')}</option>
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
        <Button type="submit" isLoading={isSubmitting} className="self-start">
          {t('admin.common.save')}
        </Button>
      </form>
      </Card>
    </div>
  )
}
