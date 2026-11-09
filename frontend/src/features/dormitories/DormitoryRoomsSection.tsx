import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Accessibility, BedDouble, Maximize2, Ruler } from 'lucide-react'
import { Card } from '../../components/Card'
import { ImageLightbox } from '../../components/ImageLightbox'
import { listRoomAvailability } from '../../api/roomApi'
import type { RoomAvailability } from '../../types/rooms'

// Public list of a dormitory's rooms with their (optional) details. It only
// ever shows seat counts — never who lives in a room.
export function DormitoryRoomsSection({ dormitoryId }: { dormitoryId: string }) {
  const { t } = useTranslation()
  const [rooms, setRooms] = useState<RoomAvailability[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    listRoomAvailability(dormitoryId)
      .then(setRooms)
      .catch(() => setFailed(true))
  }, [dormitoryId])

  const byFloor = useMemo(() => {
    const groups = new Map<number | null, RoomAvailability[]>()
    for (const room of rooms ?? []) {
      const list = groups.get(room.floor) ?? []
      list.push(room)
      groups.set(room.floor, list)
    }
    return [...groups.entries()].sort(([a], [b]) => (a ?? Infinity) - (b ?? Infinity))
  }, [rooms])

  // Which floor's rooms are shown; defaults to the lowest floor, and falls
  // back to it if the chosen floor disappears after a reload.
  const [selectedFloor, setSelectedFloor] = useState<number | null | undefined>(undefined)
  const activeGroup = byFloor.find(([floor]) => floor === selectedFloor) ?? byFloor[0]

  if (failed) return null

  return (
    <Card>
      <p className="mb-3 text-[15px] font-bold text-sand-100">{t('dorm.rooms.title')}</p>
      {rooms == null && <p className="text-sm text-sand-300">{t('dorm.loading')}</p>}
      {rooms != null && rooms.length === 0 && <p className="text-sm text-sand-300">{t('dorm.rooms.empty')}</p>}

      {byFloor.length > 0 && (
        <div role="tablist" aria-label={t('dorm.rooms.floorTabs')} className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
          {byFloor.map(([floor, list]) => {
            const active = activeGroup?.[0] === floor
            const free = list.reduce((sum, r) => sum + Math.max(0, r.capacity - r.resident_count - r.held_count), 0)
            return (
              <button
                key={floor ?? 'none'}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelectedFloor(floor)}
                className={`flex shrink-0 flex-col items-start rounded-xl border px-3.5 py-2 text-left transition-colors ${
                  active
                    ? 'border-turquoise-400 bg-turquoise-500/10 text-turquoise-400'
                    : 'border-sand-100/15 text-sand-200 hover:border-sand-100/30 hover:text-sand-100'
                }`}
              >
                <span className="text-sm font-semibold whitespace-nowrap">
                  {floor != null ? t('wizard.floorLabel', { floor }) : t('wizard.floorNotSpecified')}
                </span>
                <span className={`text-[11px] whitespace-nowrap ${active ? 'text-turquoise-400/80' : 'text-sand-300'}`}>
                  {t('dorm.rooms.floorSummary', { rooms: list.length, free })}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {activeGroup && (
        <div role="tabpanel" className="grid grid-cols-1 items-start gap-3 md:grid-cols-2">
          {activeGroup[1].map((room) => (
            <RoomCard key={room.id} room={room} />
          ))}
        </div>
      )}
    </Card>
  )
}

function RoomCard({ room }: { room: RoomAvailability }) {
  const { t } = useTranslation()
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const free = Math.max(0, room.capacity - room.resident_count - room.held_count)
  const photos = room.photo_urls ?? []
  const gender = room.restrictions?.gender

  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-sand-100/10 bg-navy-950/40 p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-bold text-sand-100">{t('dorm.rooms.roomNumber', { room: room.room_number })}</p>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-sand-300">
            <span className="inline-flex items-center gap-1">
              <BedDouble className="h-3.5 w-3.5" />
              {t('dorm.rooms.seats', { count: room.capacity })}
            </span>
            {room.area_sq_m != null && (
              <span className="inline-flex items-center gap-1">
                <Ruler className="h-3.5 w-3.5" />
                {t('dorm.rooms.area', { area: room.area_sq_m })}
              </span>
            )}
            {gender && <span>{gender === 'male' ? t('dorm.rooms.maleOnly') : t('dorm.rooms.femaleOnly')}</span>}
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${
            free > 0 ? 'bg-turquoise-500/10 text-turquoise-400' : 'bg-navy-800 text-sand-300'
          }`}
        >
          {free > 0 ? t('dorm.vacancyCount', { count: free }) : t('dorm.noVacancy')}
        </span>
      </div>

      {photos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {photos.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => setLightboxIndex(i)}
              aria-label={t('dorm.viewInFull')}
              className="group relative h-20 w-28 shrink-0 overflow-hidden rounded-lg"
            >
              <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
              <span className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-navy-950/60 text-sand-100 opacity-0 transition-opacity group-hover:opacity-100">
                <Maximize2 className="h-3 w-3" />
              </span>
            </button>
          ))}
        </div>
      )}
      {lightboxIndex != null && (
        <ImageLightbox
          imageUrls={photos}
          initialIndex={lightboxIndex}
          alt={t('dorm.rooms.roomNumber', { room: room.room_number })}
          onClose={() => setLightboxIndex(null)}
        />
      )}

      <dl className="flex flex-col gap-1.5 text-sm">
        {room.equipment && <Detail label={t('admin.rooms.equipmentLabel')} value={room.equipment} />}
        {room.sanitary_conditions && <Detail label={t('admin.rooms.sanitaryLabel')} value={room.sanitary_conditions} />}
        {room.is_accessible != null && (
          <div className="flex items-start gap-1.5">
            <Accessibility className="mt-0.5 h-4 w-4 shrink-0 text-sand-300" />
            <span className="text-sand-200">
              {room.is_accessible ? t('dorm.rooms.accessible') : t('dorm.rooms.notAccessible')}
              {room.accessibility_notes && <span className="text-sand-300"> — {room.accessibility_notes}</span>}
            </span>
          </div>
        )}
        {room.is_accessible == null && room.accessibility_notes && (
          <Detail label={t('admin.rooms.accessibilityNotesLabel')} value={room.accessibility_notes} />
        )}
      </dl>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-sand-300">{label}</dt>
      <dd className="whitespace-pre-line text-sand-200">{value}</dd>
    </div>
  )
}
