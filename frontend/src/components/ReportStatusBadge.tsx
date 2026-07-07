import type { ReportStatus } from '../types/reports'

const labels: Record<ReportStatus, string> = {
  pending_committee: 'Комиссия қарауда',
  approved: 'Мақұлданды',
  rejected: 'Қабылданбады',
}

const classes: Record<ReportStatus, string> = {
  pending_committee: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
}

export function ReportStatusBadge({ status }: { status: ReportStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${classes[status]}`}
    >
      {labels[status]}
    </span>
  )
}
