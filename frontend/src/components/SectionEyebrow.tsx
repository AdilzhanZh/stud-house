import type { ReactNode } from 'react'

// The small label above a heading on the university's site: a gold line, a dot,
// then the text.
export function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-sm font-medium text-gold-text">
      <span aria-hidden className="h-0.5 w-6 shrink-0 bg-gold-400" />
      <span aria-hidden className="h-1 w-1 shrink-0 rounded-full bg-gold-400" />
      {children}
    </p>
  )
}
