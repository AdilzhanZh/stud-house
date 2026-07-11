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
  pending: 'bg-turquoise-500/10 text-turquoise-300 ring-turquoise-400/20',
  manager_review: 'bg-turquoise-500/10 text-turquoise-300 ring-turquoise-400/20',
  needs_correction: 'bg-sand-100/10 text-sand-200 ring-sand-100/20',
  approved: 'bg-mint-500/10 text-mint-400 ring-mint-500/30',
  rejected: 'bg-clay-500/10 text-clay-400 ring-clay-500/30',
  settled: 'bg-mint-500/10 text-mint-400 ring-mint-500/30',
}

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${classes[status]}`}
    >
      {labels[status]}
    </span>
  )
}
