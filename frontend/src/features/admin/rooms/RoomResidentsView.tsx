import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Card } from '../../../components/Card'
import { Alert } from '../../../components/Alert'
import { extractErrorMessage } from '../../../api/client'
import { getRoom, listRoomResidents } from '../../../api/roomApi'
import { listUsers } from '../../../api/adminUserApi'
import type { Room, RoomResident } from '../../../types/rooms'

export function RoomResidentsView() {
  const { roomId } = useParams<{ roomId: string }>()

  const [room, setRoom] = useState<Room | null>(null)
  const [residents, setResidents] = useState<RoomResident[] | null>(null)
  const [namesById, setNamesById] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!roomId) return
    Promise.all([getRoom(roomId), listRoomResidents(roomId), listUsers('student')])
      .then(([r, residentList, students]) => {
        setRoom(r)
        setResidents(residentList)
        setNamesById(Object.fromEntries(students.map((s) => [s.id, s.full_name])))
      })
      .catch((err) => setError(extractErrorMessage(err, 'Жүктеу сәтсіз аяқталды')))
  }, [roomId])

  if (error) return <Alert variant="error" message={error} />
  if (!room || !residents) return <p className="text-sm text-gray-500">Жүктелуде...</p>

  return (
    <Card title={`Бөлме ${room.room_number} — тұрғындар`}>
      {residents.length === 0 && <p className="text-sm text-gray-500">Тұрғын жоқ</p>}
      <ul className="flex flex-col gap-2">
        {residents.map((r) => (
          <li key={r.id} className="flex justify-between text-sm">
            <span className="text-gray-900">{namesById[r.student_id] ?? r.student_id}</span>
            <span className="text-gray-500">
              {new Date(r.moved_in_at).toLocaleDateString('kk-KZ')}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}
