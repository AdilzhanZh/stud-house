import { forwardRef, useState, type InputHTMLAttributes, type WheelEvent } from 'react'
import { Eye, EyeOff } from 'lucide-react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, id, className = '', type, required, onWheel, ...rest },
  ref,
) {
  const inputId = id ?? rest.name
  const isPassword = type === 'password'
  const [visible, setVisible] = useState(false)

  // Chrome/Firefox silently bump a focused number input's value on mouse-wheel
  // scroll (e.g. scrolling the page while the cursor happens to sit over the
  // field), which has caused real data-entry mistakes (e.g. a price off by
  // a couple of tenge). Blur it first so scrolling never changes the value.
  function handleWheel(e: WheelEvent<HTMLInputElement>) {
    if (type === 'number') {
      e.currentTarget.blur()
    }
    onWheel?.(e)
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-medium text-sand-200">
        {label}
        {required ? (
          <span className="text-clay-400"> *</span>
        ) : (
          <span className="ml-1 text-xs font-normal text-sand-400">(міндетті емес)</span>
        )}
      </label>
      <div className="relative">
        <input
          id={inputId}
          ref={ref}
          type={isPassword ? (visible ? 'text' : 'password') : type}
          required={required}
          onWheel={handleWheel}
          className={`w-full rounded-[14px] border bg-navy-900 px-4 py-3 text-sm text-sand-100 outline-none transition-colors placeholder:text-sand-400/50 focus:ring-4 ${
            isPassword ? 'pr-10' : ''
          } ${
            error
              ? 'border-clay-400 focus:border-clay-400 focus:ring-clay-500/15'
              : 'border-sand-100/15 focus:border-turquoise-400 focus:ring-turquoise-400/15'
          } ${className}`}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Құпия сөзді жасыру' : 'Құпия сөзді көрсету'}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-sand-400 transition-colors hover:text-sand-200"
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-clay-400">{error}</p>}
    </div>
  )
})
