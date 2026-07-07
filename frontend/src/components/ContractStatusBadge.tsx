import type { ContractStatus } from '../types/contracts'

const labels: Record<ContractStatus, string> = {
  sent: 'Жауап күтілуде',
  awaiting_manager_decision: 'Мерзімі өтті, менеджер шешеді',
  accepted: 'Қабылданды',
  declined: 'Бас тартылды',
  expired: 'Мерзімі аяқталды',
}

const classes: Record<ContractStatus, string> = {
  sent: 'bg-yellow-100 text-yellow-800',
  awaiting_manager_decision: 'bg-orange-100 text-orange-800',
  accepted: 'bg-green-100 text-green-800',
  declined: 'bg-red-100 text-red-800',
  expired: 'bg-gray-200 text-gray-700',
}

export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${classes[status]}`}
    >
      {labels[status]}
    </span>
  )
}
