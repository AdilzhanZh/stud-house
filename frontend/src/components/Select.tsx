import { forwardRef, type SelectHTMLAttributes } from 'react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  error?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, id, className = '', children, required, ...rest },
  ref,
) {
  const selectId = id ?? rest.name
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={selectId} className="text-sm font-medium text-sand-200">
        {label}
        {required ? (
          <span className="text-clay-400"> *</span>
        ) : (
          <span className="ml-1 text-xs font-normal text-sand-400">(міндетті емес)</span>
        )}
      </label>
      <select
        id={selectId}
        ref={ref}
        required={required}
        className={`rounded-[14px] border bg-navy-900 px-4 py-3 text-sm text-sand-100 outline-none transition-colors focus:ring-4 ${
          error
            ? 'border-clay-400 focus:border-clay-400 focus:ring-clay-500/15'
            : 'border-sand-100/15 focus:border-turquoise-400 focus:ring-turquoise-400/15'
        } ${className}`}
        {...rest}
      >
        {children}
      </select>
      {error && <p className="text-xs text-clay-400">{error}</p>}
    </div>
  )
})
