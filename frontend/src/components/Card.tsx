import type { PropsWithChildren } from 'react'

interface CardProps {
  title?: string
  className?: string
  onClick?: () => void
}

export function Card({ title, className = '', onClick, children }: PropsWithChildren<CardProps>) {
  return (
    <div
      className={`w-full rounded-xl border border-sand-100/10 bg-navy-900 p-6 shadow-sm ${
        onClick ? 'cursor-pointer transition-colors hover:border-sand-100/20' : ''
      } ${className}`}
      onClick={onClick}
    >
      {title && <h2 className="mb-4 font-heading text-lg text-sand-100">{title}</h2>}
      {children}
    </div>
  )
}
