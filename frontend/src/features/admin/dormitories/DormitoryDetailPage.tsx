import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { extractErrorMessage } from '../../../api/client'
import { getDormitory, getDormitoryCapacity } from '../../../api/dormitoryApi'
import { listRoomResidents, listRoomsByDormitory } from '../../../api/roomApi'
import type { Dormitory, DormitoryCapacity } from '../../../types/dormitories'
import type { Room } from '../../../types/rooms'

interface RoomRow extends Room {
  residentCount: number
}

function restrictionsSummary(room: Room): string {
  const parts: string[] = []
  if (room.restrictions.gender) {
    parts.push(room.restrictions.gender === 'male' ? 'Ер' : 'Әйел')
  }
  if (room.restrictions.courses.length > 0) {
    parts.push(`${room.restrictions.courses.join(',')} курс`)
  }
  if (room.restrictions.benefit_ids.length > 0) {
    parts.push(`${room.restrictions.benefit_ids.length} льгота`)
  }
  return parts.length > 0 ? parts.join(', ') : 'Шектеусіз'
}

export function DormitoryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [dormitory, setDormitory] = useState<Dormitory | null>(null)
  const [capacity, setCapacity] = useState<DormitoryCapacity | null>(null)
  const [rooms, setRooms] = useState<RoomRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    Promise.all([getDormitory(id), getDormitoryCapacity(id), listRoomsByDormitory(id)])
      .then(async ([d, cap, roomList]) => {
        setDormitory(d)
        setCapacity(cap)
        const withResidents = await Promise.all(
          roomList.map(async (r) => {
            const residents = await listRoomResidents(r.id).catch(() => [])
            return { ...r, residentCount: residents.length }
          }),
        )
        setRooms(withResidents)
      })
      .catch((err) => setError(extractErrorMessage(err, 'Жүктеу сәтсіз аяқталды')))
  }, [id])

  if (error) return <Alert variant="error" message={error} />
  if (!dormitory || !capacity || !rooms) return <p className="text-sm text-gray-500">Жүктелуде...</p>

  const percent = capacity.total_capacity > 0
    ? Math.min(100, Math.round((capacity.allocated_beds / capacity.total_capacity) * 100))
    : 0

  return (
    <div className="flex flex-col gap-6">
      <Card title={dormitory.name}>
        <p className="text-sm text-gray-500">{dormitory.address}</p>
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-sm text-gray-600">
            <span>Сыйымдылық</span>
            <span>
              {capacity.allocated_beds}/{capacity.total_capacity}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-200">
            <div
              className="h-2 rounded-full bg-indigo-600"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Бөлмелер</h2>
        <Button onClick={() => navigate(`/admin/dormitories/${id}/rooms/new`)}>Жаңа бөлме</Button>
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Бөлме №</th>
              <th className="px-4 py-3">Сыйымдылық</th>
              <th className="px-4 py-3">Тұрғындар</th>
              <th className="px-4 py-3">Шектеулер</th>
              <th className="px-4 py-3">Әрекеттер</th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((room) => (
              <tr key={room.id} className="border-b border-gray-100 last:border-0">
                <td className="px-4 py-3 font-medium text-gray-900">{room.room_number}</td>
                <td className="px-4 py-3 text-gray-600">{room.capacity}</td>
                <td className="px-4 py-3 text-gray-600">{room.residentCount}</td>
                <td className="px-4 py-3 text-gray-600">{restrictionsSummary(room)}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-3">
                    <button
                      className="text-indigo-600 hover:underline"
                      onClick={() => navigate(`/admin/rooms/${room.id}/edit`)}
                    >
                      Өзгерту
                    </button>
                    <button
                      className="text-indigo-600 hover:underline"
                      onClick={() => navigate(`/admin/rooms/${room.id}/residents`)}
                    >
                      Тұрғындар
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rooms.length === 0 && (
              <tr>
                <td className="px-4 py-3 text-gray-500" colSpan={5}>
                  Бөлме жоқ
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
