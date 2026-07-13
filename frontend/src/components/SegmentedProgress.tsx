interface SegmentedProgressProps {
  total: number
  filled: number
  className?: string
}

// The site's recurring N-segment rounded progress bar — 6 segments for the
// application journey (Home, Sent, My Applications), 3 for the application
// wizard. Filled segments are turquoise, the rest are the neutral line color.
export function SegmentedProgress({ total, filled, className = '' }: SegmentedProgressProps) {
  return (
    <div className={`flex gap-1 ${className}`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-1.5 flex-1 rounded-full ${i < filled ? 'bg-turquoise-500' : 'bg-navy-700'}`}
        />
      ))}
    </div>
  )
}
