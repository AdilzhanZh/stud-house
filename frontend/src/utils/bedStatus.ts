import type { BedStatus } from '../types/rooms'

// Dot colour per bed status, matching BedStatusBadge.
export const bedStatusDotClass: Record<BedStatus, string> = {
  free: 'bg-mint-400',
  reserved: 'bg-amber-400',
  occupied: 'bg-turquoise-400',
  repair: 'bg-clay-400',
  unavailable: 'bg-sand-400',
}

// The latest of some ISO timestamps, or null.
export function latestTime(values: (string | null | undefined)[]): string | null {
  let best: string | null = null
  for (const v of values) if (v && (!best || new Date(v) > new Date(best))) best = v
  return best
}
