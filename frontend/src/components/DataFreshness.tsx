import { useTranslation } from 'react-i18next'
import { RefreshCw } from 'lucide-react'
import { formatDateTime } from '../utils/dateFormat'

interface DataFreshnessProps {
  // When this page last loaded its data from the server.
  loadedAt: Date | null
  // When a bed shown on the page last changed status (null if never).
  lastChangeAt?: string | null
  onRefresh: () => void
  isRefreshing?: boolean
}

// "Данные на … · последнее изменение статуса …" with a refresh button:
// shows how current the occupancy on the page is.
export function DataFreshness({ loadedAt, lastChangeAt, onRefresh, isRefreshing }: DataFreshnessProps) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-sand-300">
      {loadedAt && <span>{t('admin.rooms.dataAsOf', { time: formatDateTime(loadedAt) })}</span>}
      {lastChangeAt && <span>· {t('admin.rooms.lastStatusChange', { time: formatDateTime(lastChangeAt) })}</span>}
      <button
        type="button"
        onClick={onRefresh}
        disabled={isRefreshing}
        className="inline-flex items-center gap-1 font-semibold text-turquoise-400 hover:text-turquoise-300 disabled:opacity-50"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} /> {t('admin.rooms.refresh')}
      </button>
    </div>
  )
}
