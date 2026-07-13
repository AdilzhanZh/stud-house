import type { TFunction } from 'i18next'

// Client-side estimate only, for display — the real status transition
// (sent -> awaiting_manager_decision) happens via the backend cron/endpoint,
// so this can be a few minutes off around the exact deadline moment.
export function formatTimeRemaining(deadlineIso: string, t: TFunction): string {
  const diffMs = new Date(deadlineIso).getTime() - Date.now()
  if (diffMs <= 0) return t('deadline.expired')

  return t('deadline.remainingSuffix', { time: formatDuration(diffMs, t) })
}

// For contracts already flagged awaiting_manager_decision — shows how long
// ago the deadline passed instead of how long is left.
export function formatTimeElapsed(deadlineIso: string, t: TFunction): string {
  const diffMs = Date.now() - new Date(deadlineIso).getTime()
  if (diffMs <= 0) return t('deadline.justNow')

  return t('deadline.elapsedSuffix', { time: formatDuration(diffMs, t) })
}

function formatDuration(diffMs: number, t: TFunction): string {
  const totalMinutes = Math.floor(diffMs / 60_000)
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60

  const parts: string[] = []
  if (days > 0) parts.push(t('deadline.days', { count: days }))
  if (hours > 0) parts.push(t('deadline.hours', { count: hours }))
  if (days === 0 && hours === 0) parts.push(t('deadline.minutes', { count: minutes }))

  return parts.join(' ')
}
