import { useTranslation } from 'react-i18next'
import type { ProtocolStatus } from '../types/protocols'

const classes: Record<ProtocolStatus, string> = {
  pending: 'bg-amber-500/10 text-amber-400 ring-amber-400/20',
  approved: 'bg-mint-500/10 text-mint-400 ring-mint-500/30',
}

export function ProtocolStatusBadge({ status }: { status: ProtocolStatus }) {
  const { t } = useTranslation()
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${classes[status]}`}
    >
      {t(`protocolStatus.${status}`)}
    </span>
  )
}
