import { useTranslation } from 'react-i18next'
import { useThemeStore } from '../store/themeStore'

// Sun/moon switch shown in every layout's header — icon shows the theme a
// click will switch TO, not the current one (moon while it's day, sun while
// it's night), matching the common convention for this kind of toggle.
export function ThemeToggle() {
  const { t } = useTranslation()
  const theme = useThemeStore((s) => s.theme)
  const toggle = useThemeStore((s) => s.toggle)
  const isDay = theme === 'day'

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDay ? t('common.enableNightView') : t('common.enableDayView')}
      title={isDay ? t('common.nightView') : t('common.dayView')}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sand-300 transition-colors hover:bg-sand-100/10 hover:text-sand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turquoise-400 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-950"
    >
      {isDay ? (
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
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
        </svg>
      ) : (
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
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      )}
    </button>
  )
}
