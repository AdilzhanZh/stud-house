function initials(fullName: string | undefined): string {
  if (!fullName) return '?'
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

interface AvatarProps {
  fullName: string | undefined
  avatarUrl?: string | null
  sizeClass?: string
  textClass?: string
  className?: string
}

export function Avatar({
  fullName,
  avatarUrl,
  sizeClass = 'h-9.5 w-9.5',
  textClass = 'text-sm',
  className = '',
}: AvatarProps) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className={`${sizeClass} shrink-0 rounded-full object-cover ${className}`}
      />
    )
  }
  return (
    <span
      className={`flex ${sizeClass} shrink-0 items-center justify-center rounded-full bg-turquoise-500/15 ${textClass} font-bold text-turquoise-400 ${className}`}
    >
      {initials(fullName)}
    </span>
  )
}
