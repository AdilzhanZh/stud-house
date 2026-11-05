// Public contact details, as published on the university's own site.
export const UNIVERSITY = {
  siteUrl: 'https://korkyt.edu.kz/',
  siteLabel: 'korkyt.edu.kz',
  email: 'ksu@korkyt.kz',
  phone: '+7 7242 26-27-14',
  admissionsPhone: '+7 7242 71-07-45',
} as const

export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^+\d]/g, '')}`
}
