import { useTranslation } from 'react-i18next'
import { Download } from 'lucide-react'

interface DownloadIconButtonProps {
  onClick: () => void
  label?: string
}

export function DownloadIconButton({ onClick, label }: DownloadIconButtonProps) {
  const { t } = useTranslation()
  const resolvedLabel = label ?? t('admin.applications.download')
  return (
    <button
      type="button"
      aria-label={resolvedLabel}
      title={resolvedLabel}
      className="shrink-0 rounded-lg p-1.5 text-turquoise-400 transition-colors hover:bg-turquoise-500/10"
      onClick={onClick}
    >
      <Download className="h-4.5 w-4.5" />
    </button>
  )
}
