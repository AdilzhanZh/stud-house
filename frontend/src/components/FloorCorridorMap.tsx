import { useTranslation } from 'react-i18next'
import { Star } from 'lucide-react'

interface CorridorRoom {
  id: string
  room_number: string
  capacity: number
  residentCount: number
  // Shows a small corner dot without disabling the tile — e.g. the admin
  // assignment grid uses this for a room whose gender restriction doesn't
  // match the applicant: still visible and clickable (so it can be
  // inspected/fixed), just flagged as needing attention before it can be
  // picked.
  warning?: boolean
  // Marks the applicant's own pick from their application (preferred_room_id)
  // directly on the tile, so it's visible while browsing the map — not only
  // once a manager has actually selected/confirmed a room.
  preferred?: boolean
  // The room stays visible (so the applicant can see it exists) but can't be
  // picked because it fails a hard restriction, e.g. a gender-restricted
  // room that doesn't match the applicant. Clicking it doesn't select it —
  // it reports back via onBlockedRoom instead, so the caller can explain why.
  blocked?: boolean
}

interface FloorCorridorMapProps {
  rooms: CorridorRoom[]
  onSelectRoom?: (roomId: string) => void
  selectedRoomId?: string
  // When set, a room at/over capacity stays visible (still shows its
  // occupancy) but can't be clicked — used by the student-facing room
  // picker so a full room can't be picked, while the admin's manage-room
  // map (which navigates to a room's resident list regardless of how full
  // it is) leaves this off.
  disableFull?: boolean
  // Called instead of onSelectRoom when a `blocked` tile is clicked.
  onBlockedRoom?: (room: CorridorRoom) => void
}

function occupancyClasses(residentCount: number, capacity: number): string {
  if (residentCount >= capacity) return 'bg-clay-500/10 ring-clay-500/30 text-clay-400'
  if (residentCount > 0) return 'bg-amber-500/10 ring-amber-400/30 text-amber-400'
  return 'bg-mint-500/10 ring-mint-500/30 text-mint-400'
}

function RoomTile({
  room,
  onSelectRoom,
  onBlockedRoom,
  selected,
  disableFull,
}: {
  room?: CorridorRoom
  onSelectRoom?: (roomId: string) => void
  onBlockedRoom?: (room: CorridorRoom) => void
  selected?: boolean
  disableFull?: boolean
}) {
  const { t } = useTranslation()
  if (!room) return <div className="h-11 w-11 shrink-0" />
  const isFull = room.residentCount >= room.capacity
  const disabled = disableFull && isFull && !room.blocked
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => (room.blocked ? onBlockedRoom?.(room) : onSelectRoom?.(room.id))}
      title={t('admin.dormitories.roomTileTitle', {
        room: room.room_number,
        occupied: room.residentCount,
        capacity: room.capacity,
      })}
      className={`relative flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg ring-1 ring-inset transition-colors ${
        room.blocked
          ? 'cursor-not-allowed opacity-40 grayscale hover:brightness-100'
          : disabled
            ? 'cursor-not-allowed opacity-60'
            : 'hover:brightness-110'
      } ${occupancyClasses(room.residentCount, room.capacity)} ${
        selected ? 'ring-2 ring-turquoise-400' : ''
      }`}
    >
      {room.warning && (
        <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-amber-400" />
      )}
      {room.preferred && (
        <Star className="absolute top-0.5 left-0.5 h-3 w-3 fill-turquoise-400 text-turquoise-400" />
      )}
      <span className="text-xs font-semibold leading-none">{room.room_number}</span>
      <span className="mt-1 text-[10px] leading-none opacity-80">
        {room.residentCount}/{room.capacity}
      </span>
    </button>
  )
}

// Mirrors a real dormitory corridor: even-numbered rooms line one side of the
// hallway, odd-numbered rooms the other, laid out as paired columns.
export function FloorCorridorMap({
  rooms,
  onSelectRoom,
  selectedRoomId,
  disableFull,
  onBlockedRoom,
}: FloorCorridorMapProps) {
  const numbered = rooms
    .map((room) => ({ room, num: parseInt(room.room_number, 10) }))
    .filter((x) => !Number.isNaN(x.num))
    .sort((a, b) => a.num - b.num)

  if (numbered.length === 0) return null

  const evens = numbered.filter((x) => x.num % 2 === 0).map((x) => x.room)
  const odds = numbered.filter((x) => x.num % 2 !== 0).map((x) => x.room)
  const columns = Math.max(evens.length, odds.length)

  return (
    <div className="flex items-center gap-2 overflow-x-auto rounded-2xl border border-sand-100/15 bg-navy-950/40 p-3">
      {Array.from({ length: columns }).map((_, i) => (
        <div
          key={i}
          className={`flex shrink-0 flex-col gap-2 ${
            i % 2 === 1 && i !== columns - 1 ? 'border-r border-sand-100/10 pr-2' : ''
          }`}
        >
          <RoomTile
            room={evens[i]}
            onSelectRoom={onSelectRoom}
            onBlockedRoom={onBlockedRoom}
            selected={evens[i]?.id === selectedRoomId}
            disableFull={disableFull}
          />
          <RoomTile
            room={odds[i]}
            onSelectRoom={onSelectRoom}
            onBlockedRoom={onBlockedRoom}
            selected={odds[i]?.id === selectedRoomId}
            disableFull={disableFull}
          />
        </div>
      ))}
    </div>
  )
}
