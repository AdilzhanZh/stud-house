import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { ChevronLeft } from 'lucide-react'
import { Card } from '../../../components/Card'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { FloorCorridorMap } from '../../../components/FloorCorridorMap'
import { extractErrorMessage } from '../../../api/client'
import { getDormitory, getDormitoryCapacity } from '../../../api/dormitoryApi'
import { listRoomResidents, listRoomsByDormitory } from '../../../api/roomApi'
import { adminCellClass, adminPageHeading, adminRowClass, adminTableWrapClass, adminTheadClass } from '../adminTable'
import type { Dormitory, DormitoryCapacity } from '../../../types/dormitories'
import type { Room } from '../../../types/rooms'

interface RoomRow extends Room {
  residentCount: number
}

function restrictionsSummary(room: Room, t: TFunction): string {
  const parts: string[] = []
  if (room.restrictions.gender) {
    parts.push(room.restrictions.gender === 'male' ? t('admin.dormitories.male') : t('admin.dormitories.female'))
  }
  if ((room.restrictions.courses ?? []).length > 0) {
    parts.push(t('admin.dormitories.coursesRestriction', { courses: room.restrictions.courses.join(',') }))
  }
  if ((room.restrictions.benefit_ids ?? []).length > 0) {
    parts.push(t('admin.dormitories.benefitsRestriction', { count: room.restrictions.benefit_ids.length }))
  }
  return parts.length > 0 ? parts.join(', ') : t('admin.dormitories.unrestricted')
}

export function DormitoryDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [dormitory, setDormitory] = useState<Dormitory | null>(null)
  const [capacity, setCapacity] = useState<DormitoryCapacity | null>(null)
  const [rooms, setRooms] = useState<RoomRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedFloor, setSelectedFloor] = useState<string | null>(null)

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
      .catch((err) => setError(extractErrorMessage(err, t('admin.common.loadError'))))
  }, [id])

  if (error) return <Alert variant="error" message={error} />
  if (!dormitory || !capacity || !rooms) return <p className="text-sm text-sand-300">{t('admin.common.loading')}</p>

  const floorGroups = Object.entries(
    rooms.reduce<Record<number, RoomRow[]>>((byFloor, room) => {
      if (room.floor == null) return byFloor
      byFloor[room.floor] = [...(byFloor[room.floor] ?? []), room]
      return byFloor
    }, {}),
  ).sort(([a], [b]) => Number(a) - Number(b))

  const activeFloor = selectedFloor && floorGroups.some(([floor]) => floor === selectedFloor)
    ? selectedFloor
    : floorGroups[0]?.[0]
  const activeFloorRooms = floorGroups.find(([floor]) => floor === activeFloor)?.[1] ?? []

  const bedsPercent = capacity.total_capacity > 0
    ? Math.min(100, Math.round((capacity.allocated_beds / capacity.total_capacity) * 100))
    : 0
  const roomsPercent = capacity.total_rooms_target && capacity.total_rooms_target > 0
    ? Math.min(100, Math.round((capacity.rooms_created / capacity.total_rooms_target) * 100))
    : 0

  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={() => navigate('/admin/dormitories')}
        className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-sand-300 hover:text-sand-100"
      >
        <ChevronLeft className="h-4 w-4" /> {t('admin.layout.dormitories')}
      </button>
      <h1 className={adminPageHeading}>{dormitory.name} · {t('admin.dormitories.roomsWord')}</h1>

      <Card>
        <p className="text-sm text-sand-300">{dormitory.address}</p>
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-sm text-sand-300">
            <span>{t('admin.dormitories.bedsProgress')}</span>
            <span>
              {capacity.total_capacity}/{capacity.allocated_beds}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-navy-700">
            <div
              className="h-2 rounded-full bg-turquoise-500"
              style={{ width: `${bedsPercent}%` }}
            />
          </div>
        </div>
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-sm text-sand-300">
            <span>{t('admin.dormitories.roomsProgress')}</span>
            <span>
              {capacity.total_rooms_target ?? '—'}/{capacity.rooms_created}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-navy-700">
            <div
              className="h-2 rounded-full bg-turquoise-500"
              style={{ width: `${roomsPercent}%` }}
            />
          </div>
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg text-sand-100">{t('admin.dormitories.roomsWord')}</h2>
        <Button onClick={() => navigate(`/admin/dormitories/${id}/rooms/new`)}>{t('admin.dormitories.newRoom')}</Button>
      </div>

      {floorGroups.length > 0 && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {floorGroups.map(([floor]) => (
              <button
                key={floor}
                type="button"
                onClick={() => setSelectedFloor(floor)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  floor === activeFloor
                    ? 'bg-turquoise-500 text-navy-950'
                    : 'bg-navy-800 text-sand-300 hover:bg-navy-700'
                }`}
              >
                {t('admin.dormitories.floorLabel', { floor })}
              </button>
            ))}
          </div>
          <FloorCorridorMap
            rooms={activeFloorRooms}
            onSelectRoom={(roomId) => navigate(`/admin/rooms/${roomId}/residents`)}
          />
          <div className="flex flex-wrap gap-4 text-xs text-sand-300">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded ring-1 ring-inset ring-mint-500/30 bg-mint-500/10" /> {t('admin.dormitories.free')}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded ring-1 ring-inset ring-amber-400/30 bg-amber-500/10" /> {t('admin.dormitories.partiallyFull')}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded ring-1 ring-inset ring-clay-500/30 bg-clay-500/10" /> {t('admin.dormitories.full')}
            </span>
          </div>
        </div>
      )}

      <Card className={adminTableWrapClass}>
        <table className="w-full text-left text-sm">
          <thead className={adminTheadClass}>
            <tr>
              <th className={adminCellClass}>{t('admin.dormitories.roomNumber')}</th>
              <th className={adminCellClass}>{t('admin.dormitories.floor')}</th>
              <th className={adminCellClass}>{t('admin.dormitories.capacity')}</th>
              <th className={adminCellClass}>{t('admin.layout.residents')}</th>
              <th className={adminCellClass}>{t('admin.dormitories.restrictions')}</th>
              <th className={adminCellClass}>{t('admin.dormitories.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {activeFloorRooms.map((room) => (
              <tr key={room.id} className={adminRowClass}>
                <td className={`${adminCellClass} font-semibold text-sand-100`}>{room.room_number}</td>
                <td className={`${adminCellClass} text-sand-300`}>{room.floor ?? '—'}</td>
                <td className={`${adminCellClass} text-sand-300`}>{room.capacity}</td>
                <td className={`${adminCellClass} text-sand-300`}>{room.residentCount}</td>
                <td className={`${adminCellClass} text-sand-300`}>{restrictionsSummary(room, t)}</td>
                <td className={adminCellClass}>
                  <div className="flex gap-3">
                    <button
                      className="font-semibold text-turquoise-400 hover:text-turquoise-300"
                      onClick={() => navigate(`/admin/rooms/${room.id}/edit`)}
                    >
                      {t('admin.common.edit')}
                    </button>
                    <button
                      className="font-semibold text-turquoise-400 hover:text-turquoise-300"
                      onClick={() => navigate(`/admin/rooms/${room.id}/residents`)}
                    >
                      {t('admin.layout.residents')}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {activeFloorRooms.length === 0 && (
              <tr>
                <td className={`${adminCellClass} text-sand-300`} colSpan={6}>
                  {t('admin.dormitories.noRooms')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
