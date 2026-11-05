import { useTranslation } from 'react-i18next'

// Light-on-dark version of the dormitory logo (white and light blue), so it only
// belongs on the university-blue band. At small sizes the wordmark is unreadable,
// so everywhere but the login panel shows only the emblem cropped from the logo.
export function BrandLogo({ full = false, className = '' }: { full?: boolean; className?: string }) {
  const { t } = useTranslation()
  return (
    <img
      src={full ? '/brand/dormitory-logo.png' : '/brand/dormitory-mark.png'}
      alt={t('brand.university')}
      className={`w-auto shrink-0 object-contain ${className}`}
    />
  )
}

export function BrandMark() {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-3 text-left">
      <BrandLogo className="h-11" />
      <span className="flex min-w-0 flex-col">
        <span className="font-heading text-base leading-tight font-bold text-sand-100">Student House</span>
        <span className="truncate text-xs leading-tight text-gold-text">{t('brand.universityShort')}</span>
      </span>
    </div>
  )
}
