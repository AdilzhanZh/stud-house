import type { BedStatus } from '../types/rooms'

// Dot colour per bed status, matching BedStatusBadge.
export const bedStatusDotClass: Record<BedStatus, string> = {
  free: 'bg-mint-400',
  reserved: 'bg-amber-400',
  occupied: 'bg-turquoise-400',
  repair: 'bg-clay-400',
  unavailable: 'bg-sand-400',
}
