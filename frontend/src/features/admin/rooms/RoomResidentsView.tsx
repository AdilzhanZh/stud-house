import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Select } from '../../../components/Select'
import { Alert } from '../../../components/Alert'
import { extractErrorMessage } from '../../../api/client'
import { addResident, getRoom, listRoomResidents } from '../../../api/roomApi'
import { listUsers } from '../../../api/adminUserApi'
import { listApplications } from '../../../api/applicationAdminApi'
import type { Room, RoomResident } from '../../../types/rooms'
import type { Application } from '../../../types/applications'

export function RoomResidentsView() {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()

  const [room, setRoom] = useState<Room | null>(null)
  const [residents, setResidents] = useState<RoomResident[] | null>(null)
  const [namesById, setNamesById] = useState<Record<string, string>>({})
  const [settledApplications, setSettledApplications] = useState<Application[]>([])
  const [error, setError] = useState<string | null>(null)

  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [assignError, setAssignError] = useState<string | null>(null)
  const [isAssigning, setIsAssigning] = useState(false)

  function load() {
    if (!roomId) return
    Promise.all([
      getRoom(roomId),
      listRoomResidents(roomId),
      listUsers('student'),
      listApplications('settled'),
    ])
      .then(([r, residentList, students, settled]) => {
        setRoom(r)
        setResidents(residentList)
        setNamesById(Object.fromEntries(students.map((s) => [s.id, s.full_name])))
        setSettledApplications(settled.filter((a) => a.dormitory_id === r.dormitory_id))
      })
      .catch((err) => setError(extractErrorMessage(err, 'Жүктеу сәтсіз аяқталды')))
  }

  useEffect(load, [roomId])

  async function handleAssign() {
    if (!roomId || !selectedStudentId) return
    setAssignError(null)
    setIsAssigning(true)
    try {
      await addResident(roomId, selectedStudentId)
      setSelectedStudentId('')
      load()
    } catch (err) {
      setAssignError(extractErrorMessage(err, 'Тұрғынды қосу сәтсіз аяқталды'))
    } finally {
      setIsAssigning(false)
    }
  }

  if (error) return <Alert variant="error" message={error} />
  if (!room || !residents) return <p className="text-sm text-sand-300">Жүктелуде...</p>

  const residentStudentIds = new Set(residents.map((r) => r.student_id))
  const eligibleApplications = settledApplications.filter(
    (a) => !residentStudentIds.has(a.student_id),
  )

  return (
    <div className="flex flex-col gap-6">
      <Button
        variant="secondary"
        className="self-start"
        onClick={() => navigate(`/admin/dormitories/${room.dormitory_id}`)}
      >
        ← Артқа
      </Button>

      <Card title={`Бөлме ${room.room_number} — тұрғындар`}>
        {residents.length === 0 && <p className="text-sm text-sand-300">Тұрғын жоқ</p>}
        <ul className="flex flex-col gap-2">
          {residents.map((r) => (
            <li key={r.id} className="flex justify-between text-sm">
              <span className="text-sand-100">{namesById[r.student_id] ?? r.student_id}</span>
              <span className="text-sand-300">
                {new Date(r.moved_in_at).toLocaleDateString('kk-KZ')}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Тұрғын қосу">
        {assignError && <Alert variant="error" message={assignError} />}
        {eligibleApplications.length === 0 ? (
          <p className="text-sm text-sand-300">
            Осы жатақханада бөлмеге орналастыруды күтіп тұрған студент жоқ
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <Select
              label="Студент"
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
            >
              <option value="">Таңдаңыз</option>
              {eligibleApplications.map((a) => (
                <option key={a.id} value={a.student_id}>
                  {namesById[a.student_id] ?? a.student_id}
                  {a.preferred_room_id === room.id ? ' (осы бөлмені қалаған)' : ''}
                </option>
              ))}
            </Select>
            <Button
              onClick={handleAssign}
              isLoading={isAssigning}
              disabled={!selectedStudentId}
              className="self-start"
            >
              Қосу
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}
