import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Map as MapIcon, MapPin, Maximize2, X } from 'lucide-react'
import type { Dormitory } from '../../types/dormitories'
import { DormitoryMap, dormitoryPosition, type LatLng } from './DormitoryMap'

type MapDormitory = Pick<Dormitory, 'name' | 'address' | 'latitude' | 'longitude'>

interface DormitoryMapDialogProps {
  dormitory: MapDormitory
  position: LatLng
  onClose: () => void
}

// Portaled to <body> because hover:-translate on Card would otherwise become
// the containing block for position:fixed. React events still bubble through
// the portal, so clicks are stopped here to keep the Card's onClick from
// navigating away underneath the dialog.
function DormitoryMapDialog({ dormitory, position, onClose }: DormitoryMapDialogProps) {
  const { t } = useTranslation()

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-navy-950/80 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={dormitory.name}
      onClick={(e) => {
        e.stopPropagation()
        onClose()
      }}
    >
      <div
        className="flex w-full max-w-6xl flex-col overflow-hidden bg-navy-900 shadow-[var(--shadow-card)] sm:rounded-[20px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-turquoise-500/10 text-turquoise-400">
            <MapPin className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold text-sand-100">{dormitory.name}</p>
            <p className="truncate text-xs text-sand-300">{dormitory.address}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('dorm.closeFullView')}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy-800 text-sand-100 hover:bg-navy-700"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>
        <DormitoryMap position={position} mode="view" className="min-h-0 flex-1" />
      </div>
    </div>,
    document.body,
  )
}

// The small map icon next to an address on a dormitory card; renders nothing
// until the dormitory has a point pinned.
export function DormitoryMapButton({ dormitory }: { dormitory: MapDormitory }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const position = dormitoryPosition(dormitory)
  if (!position) return null

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
        aria-label={t('dorm.showOnMap')}
        title={t('dorm.showOnMap')}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-turquoise-500/10 text-turquoise-400 transition-colors hover:bg-turquoise-500/20"
      >
        <MapIcon className="h-4 w-4" />
      </button>
      {open && <DormitoryMapDialog dormitory={dormitory} position={position} onClose={() => setOpen(false)} />}
    </>
  )
}

// The small map on a single dormitory's page; clicking anywhere opens it full size.
export function DormitoryMiniMap({ dormitory }: { dormitory: MapDormitory }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const position = dormitoryPosition(dormitory)
  if (!position) return null

  return (
    <div className="group relative h-44 overflow-hidden rounded-[20px] shadow-[var(--shadow-card)] md:h-52">
      <DormitoryMap position={position} mode="static" className="h-full w-full" />
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('dorm.openFullMap')}
        className="absolute inset-0 z-10 cursor-pointer rounded-[20px] ring-1 ring-sand-100/10 ring-inset transition-shadow group-hover:ring-2 group-hover:ring-turquoise-400/60"
      >
        <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1.5 rounded-full bg-navy-950/75 px-3 py-1.5 text-xs font-semibold text-sand-100 backdrop-blur-sm">
          <Maximize2 className="h-3.5 w-3.5" /> {t('dorm.openFullMap')}
        </span>
      </button>
      {open && <DormitoryMapDialog dormitory={dormitory} position={position} onClose={() => setOpen(false)} />}
    </div>
  )
}
