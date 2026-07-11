import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  isLoading?: boolean
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-turquoise-500 text-ink font-semibold shadow-sm hover:bg-turquoise-400 disabled:bg-turquoise-500/40 focus-visible:ring-turquoise-400',
  secondary:
    'bg-transparent text-sand-100 border border-sand-100/20 hover:bg-sand-100/5 disabled:text-sand-400 focus-visible:ring-turquoise-400',
  danger:
    'bg-clay-500 text-ink font-semibold shadow-sm hover:bg-clay-400 disabled:bg-clay-500/40 focus-visible:ring-clay-400',
}

export function Button({
  variant = 'primary',
  isLoading = false,
  disabled,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-950 ${variantClasses[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...rest}
    >
      {isLoading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  )
}
