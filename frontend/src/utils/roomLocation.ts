import type { TFunction } from 'i18next'

// How to show a room to people.
export function roomLabel(room: { room_number: string }): string {
  return room.room_number
}

// How to show a floor: its own name if it has one, else "Floor N", else
// "Floor not specified" for the placeholder floor.
export function floorLabel(floor: { number: number | null; name?: string | null }, t: TFunction): string {
  if (floor.name) return floor.name
  return floor.number != null ? t('wizard.floorLabel', { floor: floor.number }) : t('wizard.floorNotSpecified')
}

interface LocatedRoom {
  floor_id: string
  floor: number | null
  floor_name?: string | null
}

export interface FloorGroup<R> {
  key: string
  label: string
  rooms: R[]
}

// Groups rooms into floor tabs, in the order rooms arrive (the server lists
// them floor by floor).
export function groupRoomsByFloor<R extends LocatedRoom>(rooms: R[], t: TFunction): FloorGroup<R>[] {
  const groups = new Map<string, FloorGroup<R>>()
  for (const room of rooms) {
    let group = groups.get(room.floor_id)
    if (!group) {
      group = { key: room.floor_id, label: floorLabel({ number: room.floor, name: room.floor_name }, t), rooms: [] }
      groups.set(room.floor_id, group)
    }
    group.rooms.push(room)
  }
  return [...groups.values()]
}
