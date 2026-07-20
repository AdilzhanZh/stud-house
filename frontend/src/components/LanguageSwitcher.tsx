import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Globe } from 'lucide-react'
import { storeLanguage, type SupportedLanguage } from '../i18n'

const ALL_LANGUAGES: { code: SupportedLanguage; label: string }[] = [
  { code: 'kk', label: 'Қазақша' },
  { code: 'ru', label: 'Русский' },
  { code: 'en', label: 'English' },
]

interface LanguageSwitcherProps {
  // Restricts which languages are selectable (e.g. the admin/manager panel
  // only exposes kk/ru, unlike the full kk/ru/en student-facing switcher).
  // Defaults to all three.
  languages?: SupportedLanguage[]
}

export function LanguageSwitcher({ languages }: LanguageSwitcherProps = {}) {
  const { i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const allowed = languages ?? ALL_LANGUAGES.map((l) => l.code)
  const LANGUAGES = ALL_LANGUAGES.filter((l) => allowed.includes(l.code))
  const current = allowed.includes(i18n.language as SupportedLanguage)
    ? (i18n.language as SupportedLanguage)
    : allowed[0]

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  function select(code: SupportedLanguage) {
    void i18n.changeLanguage(code)
    storeLanguage(code)
    setOpen(false)
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Тіл / Язык / Language"
        title="Тіл / Язык / Language"
        className="flex h-8 items-center gap-1 rounded-lg px-2 text-sand-300 transition-colors hover:bg-sand-100/10 hover:text-sand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turquoise-400 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-950"
      >
        <Globe className="h-4.5 w-4.5" />
        <span className="text-xs font-bold uppercase">{current}</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-40 overflow-hidden rounded-2xl border border-navy-700 bg-navy-900 py-1.5 shadow-[var(--shadow-card)]"
        >
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              role="menuitem"
              onClick={() => select(lang.code)}
              className="flex w-full items-center justify-between gap-2 px-3.5 py-2 text-left text-sm font-semibold text-sand-100 hover:bg-navy-800"
            >
              {lang.label}
              {current === lang.code && <Check className="h-4 w-4 text-turquoise-400" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
