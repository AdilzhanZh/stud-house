import type { PropsWithChildren } from 'react'

interface CardProps {
  id?: string
  title?: string
  className?: string
  onClick?: () => void
}

export function Card({ id, title, className = '', onClick, children }: PropsWithChildren<CardProps>) {
  return (
    <div
      id={id}
      className={`w-full rounded-[20px] bg-navy-900 p-[18px] shadow-[var(--shadow-card)] ${
        onClick ? 'cursor-pointer transition-transform hover:-translate-y-0.5' : ''
      } ${className}`}
      onClick={onClick}
    >
      {title && <h2 className="mb-4 font-heading text-lg text-sand-100">{title}</h2>}
      {children}
    </div>
  )
}
