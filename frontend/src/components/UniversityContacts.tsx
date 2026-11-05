import { useTranslation } from 'react-i18next'
import { ExternalLink, Mail, MapPin, Phone } from 'lucide-react'
import { UNIVERSITY, telHref } from '../constants/university'

// Meant for the university-blue band (.on-chrome): used by the login panel and
// the student portal footer.
export function UniversityContacts() {
  const { t } = useTranslation()
  const linkClass = 'transition-colors hover:text-sand-100'
  const iconClass = 'mt-0.5 h-4 w-4 shrink-0 text-gold-400'

  return (
    <ul className="flex flex-col gap-2 text-sm text-sand-200">
      <li className="flex gap-2.5">
        <MapPin aria-hidden className={iconClass} />
        {t('brand.address')}
      </li>
      <li className="flex gap-2.5">
        <Phone aria-hidden className={iconClass} />
        <a href={telHref(UNIVERSITY.phone)} className={linkClass}>
          {UNIVERSITY.phone}
        </a>
      </li>
      <li className="flex gap-2.5">
        <Mail aria-hidden className={iconClass} />
        <a href={`mailto:${UNIVERSITY.email}`} className={linkClass}>
          {UNIVERSITY.email}
        </a>
      </li>
      <li className="flex gap-2.5">
        <ExternalLink aria-hidden className={iconClass} />
        <a href={UNIVERSITY.siteUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
          {UNIVERSITY.siteLabel}
        </a>
      </li>
    </ul>
  )
}
