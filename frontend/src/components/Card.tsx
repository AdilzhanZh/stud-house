import type { PropsWithChildren } from 'react'

interface CardProps {
  title?: string
  className?: string
  onClick?: () => void
}

export function Card({ title, className = '', onClick, children }: PropsWithChildren<CardProps>) {
  return (
    <div
      className={`w-full rounded-lg border border-gray-200 bg-white p-6 shadow-sm ${className}`}
      onClick={onClick}
    >
      {title && <h2 className="mb-4 text-lg font-semibold text-gray-900">{title}</h2>}
      {children}
    </div>
  )
}
