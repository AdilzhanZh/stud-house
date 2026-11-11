import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FileText } from 'lucide-react'
import { BedStatusBadge } from '../../../components/BedStatusBadge'
import { formatDate, formatDateTime } from '../../../utils/dateFormat'
import type { BedBasisType, BedStatusChange } from '../../../types/rooms'

// Where the document behind a log entry opens in the admin panel.
const basisLink: Partial<Record<BedBasisType, (id: string) => string>> = {
  application: (id) => `/admin/applications/${id}`,
  reservation: (id) => `/admin/applications/${id}`,
  contract: (id) => `/admin/contracts/${id}`,
  exit_request: () => '/admin/exit-requests',
  transfer_request: () => '/admin/transfer-requests',
}

interface BedStatusLogProps {
  changes: BedStatusChange[]
  // Display names of users (staff and students) by id.
  names: Record<string, string>
}

// A bed's status log: every status change with its date, author, previous
// and new status, the student it concerns, and the document behind it
// (заявление, бронь, договор, акт).
export function BedStatusLog({ changes, names }: BedStatusLogProps) {
  const { t } = useTranslation()
  if (changes.length === 0) {
    return <p className="text-sm text-sand-300">{t('admin.rooms.bedHistoryNoStatusChanges')}</p>
  }
  return (
    <ul className="flex flex-col gap-2">
      {changes.map((c) => {
        const link = c.basis_type && c.basis_id ? basisLink[c.basis_type]?.(c.basis_id) : undefined
        const basisText =
          c.basis_type === 'act'
            ? [
                t('admin.rooms.basis.act'),
                c.act_number ? `№ ${c.act_number}` : null,
                c.act_date ? t('admin.rooms.basisActDate', { date: formatDate(c.act_date) }) : null,
              ]
                .filter(Boolean)
                .join(' ')
            : c.basis_type
              ? t(`admin.rooms.basis.${c.basis_type}`)
              : t('admin.rooms.basisUnknown')
        return (
          <li key={c.id} className="flex flex-col gap-1 rounded-2xl bg-navy-950/40 p-3">
            <p className="flex flex-wrap items-center gap-1.5 text-sm">
              <BedStatusBadge status={c.old_status} />
              <span className="text-sand-400">→</span>
              <BedStatusBadge status={c.new_status} />
            </p>
            <p className="text-xs text-sand-300">
              {formatDateTime(c.changed_at)} ·{' '}
              {c.changed_by
                ? (names[c.changed_by] ?? c.changed_by)
                : c.backfilled
                  ? t('admin.rooms.bedLogUnknownAuthor')
                  : t('admin.rooms.bedLogSystem')}
            </p>
            {c.student_id && (
              <p className="text-xs text-sand-300">
                {t('admin.rooms.bedLogStudent', { name: names[c.student_id] ?? c.student_id })}
              </p>
            )}
            <p className="flex flex-wrap items-center gap-x-2 text-xs text-sand-200">
              <span className="text-sand-400">{t('admin.rooms.bedLogBasis')}:</span>
              {link ? (
                <Link to={link} className="font-semibold text-turquoise-400 hover:text-turquoise-300">
                  {basisText}
                </Link>
              ) : (
                <span className="font-semibold">{basisText}</span>
              )}
              {c.act_file_url && (
                <a
                  href={c.act_file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-turquoise-400 hover:text-turquoise-300"
                >
                  <FileText className="h-3.5 w-3.5" /> {t('admin.rooms.bedLogActFile')}
                </a>
              )}
            </p>
            {(c.reason || c.until) && (
              <p className="text-xs text-sand-300">
                {[c.reason, c.until ? t('admin.rooms.bedServiceUntil', { date: formatDate(c.until) }) : null]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            )}
          </li>
        )
      })}
    </ul>
  )
}
