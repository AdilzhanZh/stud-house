import type { ContractStatus } from '../types/contracts'

const labels: Record<ContractStatus, string> = {
  sent: 'Жауап күтілуде',
  awaiting_manager_decision: 'Мерзімі өтті, менеджер шешеді',
  accepted: 'Қабылданды',
  declined: 'Бас тартылды',
  expired: 'Мерзімі аяқталды',
}

const classes: Record<ContractStatus, string> = {
  sent: 'bg-amber-500/10 text-amber-400',
  awaiting_manager_decision: 'bg-sand-100/10 text-sand-200',
  accepted: 'bg-mint-500/10 text-mint-400',
  declined: 'bg-clay-500/10 text-clay-400',
  expired: 'bg-sand-100/5 text-sand-300/60',
}

export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${classes[status]}`}
    >
      {labels[status]}
    </span>
  )
}
