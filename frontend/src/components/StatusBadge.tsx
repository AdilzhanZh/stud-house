import type { ApplicationStatus } from '../types/applications'

const labels: Record<ApplicationStatus, string> = {
  pending: 'Қаралуда',
  manager_review: 'Қаралуда',
  needs_correction: 'Түзету қажет',
  approved: 'Мақұлданды',
  rejected: 'Қабылданбады',
  settled: 'Аяқталды',
}

const classes: Record<ApplicationStatus, string> = {
  pending: 'bg-turquoise-500/10 text-turquoise-300',
  manager_review: 'bg-turquoise-500/10 text-turquoise-300',
  needs_correction: 'bg-amber-500/10 text-amber-400',
  approved: 'bg-mint-500/10 text-mint-400',
  rejected: 'bg-clay-500/10 text-clay-400',
  settled: 'bg-mint-500/10 text-mint-400',
}

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${classes[status]}`}
    >
      {labels[status]}
    </span>
  )
}
