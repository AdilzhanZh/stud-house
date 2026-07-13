type Variant = 'error' | 'success' | 'warning'

interface AlertProps {
  variant: Variant
  message: string
}

const variantClasses: Record<Variant, string> = {
  error: 'bg-clay-500/10 text-clay-400',
  success: 'bg-mint-500/10 text-mint-400',
  warning: 'bg-amber-500/10 text-amber-400',
}

export function Alert({ variant, message }: AlertProps) {
  return (
    <div className={`rounded-2xl px-4 py-3 text-sm font-medium ${variantClasses[variant]}`} role="alert">
      {message}
    </div>
  )
}
