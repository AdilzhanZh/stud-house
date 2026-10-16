import { useTranslation } from 'react-i18next'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { bilingualField } from '../../../utils/bilingualField'
import { formatDate } from '../../../utils/dateFormat'
import type { DocumentAICheck } from '../../../types/applications'

// What the AI document check found for one uploaded document, shown under
// it on the manager's application page. Findings inform the manager; they
// never decide anything by themselves.
export function DocumentCheckSummary({ check }: { check: DocumentAICheck }) {
  const { t, i18n } = useTranslation()

  if (check.status === 'pending' || check.status === 'processing') {
    return (
      <p className="flex items-center gap-1.5 text-xs text-sand-300">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        {t('admin.applications.aiCheck.inProgress')}
      </p>
    )
  }
  if (check.status !== 'done' || !check.result) {
    return (
      <p className="text-xs text-sand-300">
        {t('admin.applications.aiCheck.notChecked')}
        {check.error ? `: ${check.error}` : ''}
      </p>
    )
  }

  const r = check.result
  const flags: string[] = []
  if (!r.readable) flags.push(t('admin.applications.aiCheck.unreadable'))
  if (r.readable && !r.matches_expected_type) {
    flags.push(t('admin.applications.aiCheck.wrongType', { type: r.detected_type }))
  }
  if (r.names_student === 'no') {
    flags.push(t('admin.applications.aiCheck.nameMismatch', { name: r.holder_full_name }))
  }
  if (r.forgery_signs) {
    flags.push(
      t('admin.applications.aiCheck.forgery', {
        reason: bilingualField(r.forgery_reason_kk, r.forgery_reason_ru, i18n.language),
      }),
    )
  }

  return (
    <div className="flex flex-col gap-1 text-xs">
      <p className="text-sand-300">{bilingualField(r.summary_kk, r.summary_ru, i18n.language)}</p>
      <p className="text-sand-300">
        {[
          r.holder_full_name && t('admin.applications.aiCheck.holder', { name: r.holder_full_name }),
          r.issue_date && t('admin.applications.aiCheck.issued', { date: formatDate(r.issue_date) }),
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
      {flags.map((f) => (
        <p key={f} className="flex items-start gap-1.5 font-semibold text-clay-400">
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          {f}
        </p>
      ))}
    </div>
  )
}
