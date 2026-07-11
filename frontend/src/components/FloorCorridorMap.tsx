interface CorridorRoom {
  id: string
  room_number: string
  capacity: number
  residentCount: number
}

interface FloorCorridorMapProps {
  rooms: CorridorRoom[]
  onSelectRoom?: (roomId: string) => void
  selectedRoomId?: string
}

function occupancyClasses(residentCount: number, capacity: number): string {
  if (residentCount >= capacity) return 'bg-clay-500/10 ring-clay-500/30 text-clay-400'
  if (residentCount > 0) return 'bg-amber-500/10 ring-amber-400/30 text-amber-400'
  return 'bg-mint-500/10 ring-mint-500/30 text-mint-400'
}

function RoomTile({
  room,
  onSelectRoom,
  selected,
}: {
  room?: CorridorRoom
  onSelectRoom?: (roomId: string) => void
  selected?: boolean
}) {
  if (!room) return <div className="h-11 w-11 shrink-0" />
  return (
    <button
      type="button"
      onClick={() => onSelectRoom?.(room.id)}
      title={`Бөлме ${room.room_number}: ${room.residentCount}/${room.capacity} орын`}
      className={`relative flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg ring-1 ring-inset transition-colors hover:brightness-110 ${occupancyClasses(room.residentCount, room.capacity)} ${
        selected ? 'ring-2 ring-turquoise-400' : ''
      }`}
    >
      <span className="text-xs font-semibold leading-none">{room.room_number}</span>
      <span className="mt-1 text-[10px] leading-none opacity-80">
        {room.residentCount}/{room.capacity}
      </span>
    </button>
  )
}

// Mirrors a real dormitory corridor: even-numbered rooms line one side of the
// hallway, odd-numbered rooms the other, laid out as paired columns.
export function FloorCorridorMap({ rooms, onSelectRoom, selectedRoomId }: FloorCorridorMapProps) {
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
            selected={evens[i]?.id === selectedRoomId}
          />
          <RoomTile
            room={odds[i]}
            onSelectRoom={onSelectRoom}
            selected={odds[i]?.id === selectedRoomId}
          />
        </div>
      ))}
    </div>
  )
}
