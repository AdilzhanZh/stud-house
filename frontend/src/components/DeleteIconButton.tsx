interface DeleteIconButtonProps {
  onClick: () => void
  label?: string
}

export function DeleteIconButton({ onClick, label = 'Өшіру' }: DeleteIconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="shrink-0 rounded-md p-1.5 text-clay-400 transition-colors hover:bg-clay-500/10"
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
        <path d="M3 6h18" />
        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
      </svg>
    </button>
  )
}
