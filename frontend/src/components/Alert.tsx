type Variant = 'error' | 'success'

interface AlertProps {
  variant: Variant
  message: string
}

const variantClasses: Record<Variant, string> = {
  error: 'bg-red-50 text-red-700 border-red-200',
  success: 'bg-green-50 text-green-700 border-green-200',
}

export function Alert({ variant, message }: AlertProps) {
  return (
    <div className={`rounded-md border px-3 py-2 text-sm ${variantClasses[variant]}`} role="alert">
      {message}
    </div>
  )
}
