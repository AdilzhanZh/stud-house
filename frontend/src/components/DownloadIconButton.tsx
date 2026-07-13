import { Download } from 'lucide-react'

interface DownloadIconButtonProps {
  onClick: () => void
  label?: string
}

export function DownloadIconButton({ onClick, label = 'Жүктеу' }: DownloadIconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="shrink-0 rounded-lg p-1.5 text-turquoise-400 transition-colors hover:bg-turquoise-500/10"
      onClick={onClick}
    >
      <Download className="h-4.5 w-4.5" />
    </button>
  )
}
