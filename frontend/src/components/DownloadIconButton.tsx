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
      className="shrink-0 rounded-md p-1.5 text-turquoise-400 transition-colors hover:bg-turquoise-500/10"
      onClick={onClick}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <path d="M7 10l5 5 5-5" />
        <path d="M12 15V3" />
      </svg>
    </button>
  )
}
