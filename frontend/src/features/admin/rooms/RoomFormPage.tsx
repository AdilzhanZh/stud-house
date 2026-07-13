import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
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
  const { dormitoryId, roomId } = useParams<{ dormitoryId?: string; roomId?: string }>()
  const isEdit = Boolean(roomId)
  const navigate = useNavigate()

  const [roomNumber, setRoomNumber] = useState('')
  const [floor, setFloor] = useState('')
  const [areaSqM, setAreaSqM] = useState('')
  const [equipment, setEquipment] = useState('')
  const [topBeds, setTopBeds] = useState('')
  const [bottomBeds, setBottomBeds] = useState('')
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
        setAreaSqM(room.area_sq_m != null ? String(room.area_sq_m) : '')
        setEquipment(room.equipment ?? '')
        setTopBeds(String(room.top_beds))
        setBottomBeds(String(room.bottom_beds))
        setGender(room.restrictions.gender ?? 'any')
        setCourses(room.restrictions.courses ?? [])
        setOwnerDormitoryId(room.dormitory_id)
      })
      .catch((err) => setLoadError(extractErrorMessage(err, 'Жүктеу сәтсіз аяқталды')))
  }, [roomId])

  function toggleCourse(course: number) {
    setCourses((prev) =>
      prev.includes(course) ? prev.filter((c) => c !== course) : [...prev, course].sort(),
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    const topBedsNum = Number(topBeds || 0)
    const bottomBedsNum = Number(bottomBeds || 0)
    const capacityNum = topBedsNum + bottomBedsNum
    if (capacityNum <= 0) {
      setSubmitError('Үстіңгі немесе астыңғы орын саны оң сан болуы керек')
      return
    }
    if (courses.length === 0) {
      setSubmitError('Курс бойынша шектеуді таңдаңыз')
      return
    }
    setIsSubmitting(true)
    const payload = {
      room_number: roomNumber,
      capacity: capacityNum,
      floor: floor ? Number(floor) : null,
      category: 'general',
      area_sq_m: areaSqM ? Number(areaSqM) : null,
      equipment: equipment.trim() || null,
      top_beds: topBedsNum,
      bottom_beds: bottomBedsNum,
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
      setSubmitError(extractErrorMessage(err, 'Сақтау сәтсіз аяқталды'))
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
        ← Артқа
      </Button>

      <Card title={isEdit ? 'Бөлмені өзгерту' : 'Жаңа бөлме'}>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        {submitError && <Alert variant="error" message={submitError} />}
        <Input
          label="Бөлме №"
          value={roomNumber}
          onChange={(e) => setRoomNumber(e.target.value)}
          required
        />
        <Input
          label="Үстіңгі орын саны"
          type="number"
          min={0}
          value={topBeds}
          onChange={(e) => setTopBeds(e.target.value)}
          required
        />
        <Input
          label="Астыңғы орын саны"
          type="number"
          min={0}
          value={bottomBeds}
          onChange={(e) => setBottomBeds(e.target.value)}
          required
        />
        <Input
          label="Қабат (Floor)"
          type="number"
          min={0}
          value={floor}
          onChange={(e) => setFloor(e.target.value)}
          required
        />
        <Input
          label="Бөлме ауданы (м²)"
          type="number"
          min={0}
          step="0.1"
          value={areaSqM}
          onChange={(e) => setAreaSqM(e.target.value)}
          required
        />
        <Input
          label="Жабдықталуы (Equipment)"
          value={equipment}
          onChange={(e) => setEquipment(e.target.value)}
          placeholder="мысалы: Кереуеттер, столы, шкаф"
          required
        />
        <Select
          label="Жынысы бойынша шектеу"
          value={gender}
          onChange={(e) => setGender(e.target.value as Gender | 'any' | '')}
          required
        >
          <option value="" disabled>
            Таңдаңыз
          </option>
          <option value="any">Кез келген</option>
          <option value="male">Ер</option>
          <option value="female">Әйел</option>
        </Select>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-sand-200">
            Курс бойынша шектеу
            <span className="text-clay-400"> *</span>
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
          <p className="text-xs text-sand-300">Кемінде біреуін таңдау керек</p>
        </div>
        <Button type="submit" isLoading={isSubmitting} className="self-start">
          Сақтау
        </Button>
      </form>
      </Card>
    </div>
  )
}
