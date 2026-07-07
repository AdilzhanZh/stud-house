// Client-side estimate only, for display — the real status transition
// (sent -> awaiting_manager_decision) happens via the backend cron/endpoint,
// so this can be a few minutes off around the exact deadline moment.
export function formatTimeRemaining(deadlineIso: string): string {
  const diffMs = new Date(deadlineIso).getTime() - Date.now()
  if (diffMs <= 0) return 'Мерзімі өтті'

  const totalMinutes = Math.floor(diffMs / 60_000)
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60

  const parts: string[] = []
  if (days > 0) parts.push(`${days} күн`)
  if (hours > 0) parts.push(`${hours} сағат`)
  if (days === 0 && hours === 0) parts.push(`${minutes} минут`)

  return `${parts.join(' ')} қалды`
}

// For contracts already flagged awaiting_manager_decision — shows how long
// ago the deadline passed instead of how long is left.
export function formatTimeElapsed(deadlineIso: string): string {
  const diffMs = Date.now() - new Date(deadlineIso).getTime()
  if (diffMs <= 0) return 'жаңа ғана'

  const totalMinutes = Math.floor(diffMs / 60_000)
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60

  const parts: string[] = []
  if (days > 0) parts.push(`${days} күн`)
  if (hours > 0) parts.push(`${hours} сағат`)
  if (days === 0 && hours === 0) parts.push(`${minutes} минут`)

  return `${parts.join(' ')} өтті`
}
