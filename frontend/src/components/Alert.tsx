type Variant = 'error' | 'success'

interface AlertProps {
  variant: Variant
  message: string
}

const variantClasses: Record<Variant, string> = {
  error: 'border-clay-500/20 bg-clay-500/10 text-clay-400 border-l-clay-400',
  success: 'border-mint-500/20 bg-mint-500/10 text-mint-400 border-l-mint-400',
}

export function Alert({ variant, message }: AlertProps) {
  return (
    <div
      className={`rounded-lg border border-l-4 px-3 py-2.5 text-sm ${variantClasses[variant]}`}
      role="alert"
    >
      {message}
    </div>
  )
}
