import { Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface DeleteIconButtonProps {
  onClick: () => void
  label?: string
}

export function DeleteIconButton({ onClick, label }: DeleteIconButtonProps) {
  const { t } = useTranslation()
  const resolvedLabel = label ?? t('common.delete')
  return (
    <button
      type="button"
      aria-label={resolvedLabel}
      title={resolvedLabel}
      className="shrink-0 rounded-lg p-1.5 text-clay-400 transition-colors hover:bg-clay-500/10"
      onClick={onClick}
    >
      <Trash2 className="h-4.5 w-4.5" />
    </button>
  )
}
