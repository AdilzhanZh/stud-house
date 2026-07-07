import type { PropsWithChildren } from 'react'

interface CardProps {
  title?: string
  className?: string
}

export function Card({ title, className = '', children }: PropsWithChildren<CardProps>) {
  return (
    <div className={`w-full rounded-lg border border-gray-200 bg-white p-6 shadow-sm ${className}`}>
      {title && <h2 className="mb-4 text-lg font-semibold text-gray-900">{title}</h2>}
      {children}
    </div>
  )
}
