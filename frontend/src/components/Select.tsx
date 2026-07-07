import { forwardRef, type SelectHTMLAttributes } from 'react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  error?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, id, className = '', children, ...rest },
  ref,
) {
  const selectId = id ?? rest.name
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={selectId} className="text-sm font-medium text-gray-700">
        {label}
      </label>
      <select
        id={selectId}
        ref={ref}
        className={`rounded-md border px-3 py-2 text-sm outline-none transition-colors focus:ring-2 focus:ring-indigo-200 ${
          error ? 'border-red-400 focus:border-red-400' : 'border-gray-300 focus:border-indigo-400'
        } ${className}`}
        {...rest}
      >
        {children}
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
})
