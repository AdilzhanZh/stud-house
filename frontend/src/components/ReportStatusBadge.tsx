import type { ReportStatus } from '../types/reports'

const labels: Record<ReportStatus, string> = {
  pending_committee: 'Комиссия қарауда',
  approved: 'Мақұлданды',
  rejected: 'Қабылданбады',
}

const classes: Record<ReportStatus, string> = {
  pending_committee: 'bg-amber-500/10 text-amber-400 ring-amber-400/20',
  approved: 'bg-mint-500/10 text-mint-400 ring-mint-500/30',
  rejected: 'bg-clay-500/10 text-clay-400 ring-clay-500/30',
}

export function ReportStatusBadge({ status }: { status: ReportStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${classes[status]}`}
    >
      {labels[status]}
    </span>
  )
}
