import { useTranslation } from 'react-i18next'
import type { BedStatus } from '../types/rooms'

const classes: Record<BedStatus, string> = {
  free: 'bg-mint-500/10 text-mint-400',
  reserved: 'bg-amber-500/10 text-amber-400',
  occupied: 'bg-turquoise-500/10 text-turquoise-300',
  repair: 'bg-clay-500/10 text-clay-400',
  unavailable: 'bg-sand-100/10 text-sand-300',
}

export function BedStatusBadge({ status }: { status: BedStatus }) {
  const { t } = useTranslation()
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${classes[status]}`}
    >
      {t(`admin.rooms.bedStatus.${status}`)}
    </span>
  )
}
