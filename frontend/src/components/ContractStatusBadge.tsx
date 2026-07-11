import type { ContractStatus } from '../types/contracts'

const labels: Record<ContractStatus, string> = {
  sent: 'Жауап күтілуде',
  awaiting_manager_decision: 'Мерзімі өтті, менеджер шешеді',
  accepted: 'Қабылданды',
  declined: 'Бас тартылды',
  expired: 'Мерзімі аяқталды',
}

const classes: Record<ContractStatus, string> = {
  sent: 'bg-turquoise-500/10 text-turquoise-300 ring-turquoise-400/20',
  awaiting_manager_decision: 'bg-sand-100/10 text-sand-200 ring-sand-100/20',
  accepted: 'bg-mint-500/10 text-mint-400 ring-mint-500/30',
  declined: 'bg-clay-500/10 text-clay-400 ring-clay-500/30',
  expired: 'bg-sand-100/5 text-sand-300/60 ring-sand-100/15',
}

export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${classes[status]}`}
    >
      {labels[status]}
    </span>
  )
}
