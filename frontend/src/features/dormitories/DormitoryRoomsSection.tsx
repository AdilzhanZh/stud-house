import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Accessibility, BedDouble, Camera, ChevronRight, Maximize2, Ruler, X } from 'lucide-react'
import { Card } from '../../components/Card'
import { ImageLightbox } from '../../components/ImageLightbox'
import { listRoomAvailability } from '../../api/roomApi'
import { roomFreeSeats, type RoomAvailability } from '../../types/rooms'
import { groupRoomsByFloor, roomLabel } from '../../utils/roomLocation'

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

  // Floor tabs in the server's order (building by building, floor by
  // floor); with several buildings each tab is one building's floor.
  const byFloor = useMemo(() => groupRoomsByFloor(rooms ?? [], t), [rooms, t])

  // Which floor's rooms are shown; defaults to the first floor, and falls
  // back to it if the chosen floor disappears after a reload.
  const [selectedFloor, setSelectedFloor] = useState<string | undefined>(undefined)
  const activeGroup = byFloor.find((g) => g.key === selectedFloor) ?? byFloor[0]

  if (failed) return null

  return (
    <Card>
      <p className="mb-3 text-[15px] font-bold text-sand-100">{t('dorm.rooms.title')}</p>
      {rooms == null && <p className="text-sm text-sand-300">{t('dorm.loading')}</p>}
      {rooms != null && rooms.length === 0 && <p className="text-sm text-sand-300">{t('dorm.rooms.empty')}</p>}

      {byFloor.length > 0 && (
        <div role="tablist" aria-label={t('dorm.rooms.floorTabs')} className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
          {byFloor.map(({ key: floor, label, rooms: list }) => {
            const active = activeGroup?.key === floor
            const free = list.reduce((sum, r) => sum + roomFreeSeats(r), 0)
            return (
              <button
                key={floor}
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
                  {label}
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
        <div role="tabpanel" className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {activeGroup.rooms.map((room) => (
            <RoomCard key={room.id} room={room} />
          ))}
        </div>
      )}
    </Card>
  )
}

function freeSeats(room: RoomAvailability) {
  return roomFreeSeats(room)
}

function hasDetails(room: RoomAvailability) {
  return (
    (room.photo_urls?.length ?? 0) > 0 ||
    !!room.equipment ||
    !!room.sanitary_conditions ||
    room.is_accessible != null ||
    !!room.accessibility_notes
  )
}

function FreeChip({ free }: { free: number }) {
  const { t } = useTranslation()
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${
        free > 0 ? 'bg-turquoise-500/10 text-turquoise-400' : 'bg-navy-800 text-sand-300'
      }`}
    >
      {free > 0 ? t('dorm.vacancyCount', { count: free }) : t('dorm.noVacancy')}
    </span>
  )
}

// One even-height row per room, however much a manager filled in: a thumb,
// the number, the key facts and small markers for what else there is.
// Everything else opens in RoomDetailsDialog.
function RoomCard({ room }: { room: RoomAvailability }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const photos = room.photo_urls ?? []
  const gender = room.restrictions?.gender
  const clickable = hasDetails(room)

  const body = (
    <>
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-navy-800">
        {photos.length > 0 ? (
          <img src={photos[0]} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <BedDouble className="absolute inset-0 m-auto h-6 w-6 text-sand-400" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-base font-bold text-sand-100">
            {t('dorm.rooms.roomNumber', { room: roomLabel(room) })}
          </p>
          <FreeChip free={freeSeats(room)} />
        </div>
        <div className="mt-1 flex items-center gap-x-3 overflow-hidden text-xs whitespace-nowrap text-sand-300">
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
          {photos.length > 0 && (
            <span className="inline-flex items-center gap-1" title={t('admin.rooms.photosLabel')}>
              <Camera className="h-3.5 w-3.5" />
              {photos.length}
            </span>
          )}
          {room.is_accessible && (
            <Accessibility className="h-3.5 w-3.5 shrink-0" aria-label={t('dorm.rooms.accessible')} />
          )}
          {gender && <span>{gender === 'male' ? t('dorm.rooms.maleOnly') : t('dorm.rooms.femaleOnly')}</span>}
        </div>
      </div>
      {clickable && <ChevronRight className="h-4 w-4 shrink-0 text-sand-400 transition-transform group-hover:translate-x-0.5" />}
    </>
  )

  const base = 'flex w-full items-center gap-3 rounded-2xl border border-sand-100/10 bg-navy-950/40 p-3 text-left'
  if (!clickable) return <div className={base}>{body}</div>

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('dorm.rooms.openDetails', { room: roomLabel(room) })}
        className={`group ${base} transition-colors hover:border-turquoise-400/50 focus-visible:border-turquoise-400 focus-visible:outline-none`}
      >
        {body}
      </button>
      {open && <RoomDetailsDialog room={room} onClose={() => setOpen(false)} />}
    </>
  )
}

function RoomDetailsDialog({ room, onClose }: { room: RoomAvailability; onClose: () => void }) {
  const { t } = useTranslation()
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const photos = room.photo_urls ?? []
  const gender = room.restrictions?.gender
  const title = t('dorm.rooms.roomNumber', { room: roomLabel(room) })

  // Escape closes (the lightbox handles its own Escape while it is open),
  // and the page behind doesn't scroll.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && lightboxIndex == null) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = overflow
    }
  }, [onClose, lightboxIndex])

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-navy-950/70 backdrop-blur-sm sm:items-center sm:px-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-[20px] bg-navy-900 shadow-[var(--shadow-card)] sm:rounded-[20px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-sand-100/10 p-4">
          <div>
            <p className="text-lg font-bold text-sand-100">{title}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-sand-300">
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
              {room.floor != null && <span>{t('wizard.floorLabel', { floor: room.floor })}</span>}
              {gender && <span>{gender === 'male' ? t('dorm.rooms.maleOnly') : t('dorm.rooms.femaleOnly')}</span>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <FreeChip free={freeSeats(room)} />
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.close')}
              className="flex h-8 w-8 items-center justify-center rounded-full text-sand-300 hover:bg-navy-800 hover:text-sand-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto p-4">
          {photos.length > 0 && (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setLightboxIndex(0)}
                aria-label={t('dorm.viewInFull')}
                className="group relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-navy-950"
              >
                <img src={photos[0]} alt={title} className="h-full w-full object-cover" />
                <span className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-navy-950/60 text-sand-100 backdrop-blur-sm">
                  <Maximize2 className="h-4 w-4" />
                </span>
              </button>
              {photos.length > 1 && (
                <div className="grid grid-cols-4 gap-2">
                  {photos.slice(1).map((url, i) => (
                    <button
                      key={url}
                      type="button"
                      onClick={() => setLightboxIndex(i + 1)}
                      aria-label={t('dorm.viewInFull')}
                      className="aspect-square overflow-hidden rounded-lg bg-navy-950"
                    >
                      <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <dl className="flex flex-col gap-3 text-sm">
            {room.equipment && <Detail label={t('admin.rooms.equipmentLabel')} value={room.equipment} />}
            {room.sanitary_conditions && (
              <Detail label={t('admin.rooms.sanitaryLabel')} value={room.sanitary_conditions} />
            )}
            {(room.is_accessible != null || room.accessibility_notes) && (
              <div>
                <dt className="text-xs font-semibold text-sand-300">{t('admin.rooms.accessibleLabel')}</dt>
                <dd className="mt-0.5 flex items-start gap-1.5 text-sand-200">
                  <Accessibility className="mt-0.5 h-4 w-4 shrink-0 text-sand-300" />
                  <span className="whitespace-pre-line">
                    {room.is_accessible != null &&
                      (room.is_accessible ? t('dorm.rooms.accessible') : t('dorm.rooms.notAccessible'))}
                    {room.is_accessible != null && room.accessibility_notes && ' — '}
                    {room.accessibility_notes}
                  </span>
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {lightboxIndex != null && (
        <div onClick={(e) => e.stopPropagation()}>
          <ImageLightbox
            imageUrls={photos}
            initialIndex={lightboxIndex}
            alt={title}
            onClose={() => setLightboxIndex(null)}
          />
        </div>
      )}
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-sand-300">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-line text-sand-200">{value}</dd>
    </div>
  )
}
