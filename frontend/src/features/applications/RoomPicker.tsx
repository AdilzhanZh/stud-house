import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FloorCorridorMap } from '../../components/FloorCorridorMap'
import { listRoomAvailability } from '../../api/roomApi'
import type { RoomAvailability } from '../../types/rooms'
import type { Gender } from '../../types'
import { groupRoomsByFloor, roomLabel } from '../../utils/roomLocation'

interface RoomPickerProps {
  dormitoryId: string
  studentGender: Gender | null
  roomId: string
  onSelectRoom: (roomId: string) => void
}

// The gender-filtered floor/room picker shared by the application wizard's
// step 1 (a fresh application) and the "fix and resubmit" screen (a
// needs_correction application re-picking after its previous hold was
// released — see ApplicationDetailPage). Sourced from listRoomAvailability
// instead of a per-room residents fetch, and treats a room as full once
// resident_count + held_count reaches capacity, not just resident_count —
// a "held" room is one another pending applicant already has as their
// current pick (see the backend's RoomService.CheckHoldable).
export function RoomPicker({ dormitoryId, studentGender, roomId, onSelectRoom }: RoomPickerProps) {
  const { t } = useTranslation()
  const [rooms, setRooms] = useState<RoomAvailability[]>([])
  const [selectedFloor, setSelectedFloor] = useState<string | null>(null)
  const [blockedNotice, setBlockedNotice] = useState<string | null>(null)

  useEffect(() => {
    onSelectRoom('')
    if (!dormitoryId) {
      setRooms([])
      return
    }
    listRoomAvailability(dormitoryId)
      .then(setRooms)
      .catch(() => setRooms([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dormitoryId])

  useEffect(() => {
    if (!blockedNotice) return
    const timer = setTimeout(() => setBlockedNotice(null), 4000)
    return () => clearTimeout(timer)
  }, [blockedNotice])

  // A student may only pick a room whose gender restriction is either unset
  // (a shared/mixed room) or matches their own gender — a manager can still
  // assign a different room later regardless of this preference. Rooms that
  // fail this stay visible (so the applicant can see the full floor) but are
  // rendered as blocked/unselectable in FloorCorridorMap.
  const isEligible = (r: RoomAvailability) =>
    r.restrictions.gender === null || r.restrictions.gender === studentGender
  // Floor tabs; with several buildings each tab is one building's floor.
  const floorGroups = groupRoomsByFloor(rooms, t)
  const activeFloor =
    selectedFloor && floorGroups.some((g) => g.key === selectedFloor) ? selectedFloor : floorGroups[0]?.key
  const activeFloorRooms = floorGroups.find((g) => g.key === activeFloor)?.rooms ?? []
  const selectedRoom = rooms.find((r) => r.id === roomId && isEligible(r)) ?? null

  if (!dormitoryId || floorGroups.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      <label className="text-sm font-medium text-sand-200">{t('wizard.roomLabel')}</label>
      {floorGroups.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {floorGroups.map((group) => (
            <button
              key={group.key}
              type="button"
              onClick={() => setSelectedFloor(group.key)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                group.key === activeFloor
                  ? 'bg-turquoise-500 text-on-accent'
                  : 'bg-navy-800 text-sand-300 hover:bg-navy-700'
              }`}
            >
              {group.label}
            </button>
          ))}
        </div>
      )}
      <FloorCorridorMap
        rooms={activeFloorRooms.map((r) => ({
          id: r.id,
          room_number: r.room_number,
          capacity: r.capacity,
          residentCount: r.resident_count + r.held_count,
          blocked: !isEligible(r),
        }))}
        selectedRoomId={roomId}
        onSelectRoom={(id) => onSelectRoom(roomId === id ? '' : id)}
        onBlockedRoom={(room) =>
          setBlockedNotice(t('wizard.roomGenderMismatch', { room: room.room_number }))
        }
        disableFull
      />
      {blockedNotice ? (
        <p className="text-xs font-medium text-clay-400">{blockedNotice}</p>
      ) : (
        <p className="text-xs text-sand-300">
          {selectedRoom
            ? t('wizard.roomSelected', {
                room: roomLabel(selectedRoom),
                occupied: selectedRoom.resident_count + selectedRoom.held_count,
                capacity: selectedRoom.capacity,
              })
            : t('wizard.roomNotSelected')}
        </p>
      )}
    </div>
  )
}
