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
  const [capacity, setCapacity] = useState('')
  const [gender, setGender] = useState<Gender | ''>('')
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
        setCapacity(String(room.capacity))
        setGender(room.restrictions.gender ?? '')
        setCourses(room.restrictions.courses)
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
    setIsSubmitting(true)
    const payload = { room_number: roomNumber, capacity: Number(capacity) }
    try {
      const room = isEdit && roomId ? await updateRoom(roomId, payload) : await createRoom(dormitoryId!, payload)
      await updateRoomRestrictions(room.id, {
        gender: gender || null,
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
          label="Сыйымдылық"
          type="number"
          min={1}
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          required
        />
        <Select
          label="Жынысы бойынша шектеу"
          value={gender}
          onChange={(e) => setGender(e.target.value as Gender | '')}
        >
          <option value="">Кез келген</option>
          <option value="male">Ер</option>
          <option value="female">Әйел</option>
        </Select>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700">Курс бойынша шектеу</span>
          <div className="flex flex-wrap gap-3">
            {ALL_COURSES.map((course) => (
              <label key={course} className="flex items-center gap-1.5 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={courses.includes(course)}
                  onChange={() => toggleCourse(course)}
                />
                {course}
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-500">Ешқайсысы таңдалмаса — шектеу жоқ</p>
        </div>
        <Button type="submit" isLoading={isSubmitting} className="self-start">
          Сақтау
        </Button>
      </form>
    </Card>
  )
}
