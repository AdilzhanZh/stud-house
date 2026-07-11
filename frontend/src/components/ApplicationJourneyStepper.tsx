export type JourneyStep =
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'contract'
  | 'payment'
  | 'settled'

const STEPS: { key: JourneyStep; label: string }[] = [
  { key: 'submitted', label: 'Өтініш берілді' },
  { key: 'under_review', label: 'Қаралуда' },
  { key: 'approved', label: 'Мақұлданды' },
  { key: 'contract', label: 'Келісімшарт' },
  { key: 'payment', label: 'Төлем' },
  { key: 'settled', label: 'Орналасты' },
]

interface ApplicationJourneyStepperProps {
  currentStep: JourneyStep
  orientation?: 'horizontal' | 'vertical'
  className?: string
}

// The site's signature visual: a dotted progress line showing where a
// student's application sits between submission and move-in. Reused as-is
// (same component, different currentStep) wherever the journey needs
// showing — the student's own application view, the manager's queue, and
// decoratively on the auth pages.
export function ApplicationJourneyStepper({
  currentStep,
  orientation = 'horizontal',
  className = '',
}: ApplicationJourneyStepperProps) {
  const currentIndex = STEPS.findIndex((s) => s.key === currentStep)

  if (orientation === 'vertical') {
    return (
      <ol className={`flex flex-col ${className}`}>
        {STEPS.map((step, i) => {
          const done = i < currentIndex
          const active = i === currentIndex
          const upcoming = i > currentIndex
          return (
            <li key={step.key} className="flex items-stretch gap-4">
              <div className="flex flex-col items-center">
                <span
                  aria-current={active ? 'step' : undefined}
                  className={`h-3 w-3 shrink-0 rounded-full ring-2 ring-offset-2 ring-offset-navy-900 transition-colors ${
                    done || active
                      ? 'bg-turquoise-400 ring-turquoise-400'
                      : 'bg-transparent ring-sand-100/25'
                  } ${active ? 'animate-pulse' : ''}`}
                />
                {i < STEPS.length - 1 && (
                  <span
                    className={`mt-1 w-px flex-1 ${done ? 'bg-turquoise-400' : 'bg-sand-100/15'}`}
                    style={{ minHeight: '1.75rem' }}
                  />
                )}
              </div>
              <span
                className={`pb-7 font-body text-sm ${
                  upcoming ? 'text-sand-300/40' : 'text-sand-100'
                } ${active ? 'font-semibold' : ''}`}
              >
                {step.label}
              </span>
            </li>
          )
        })}
      </ol>
    )
  }

  return (
    <ol className={`flex items-start ${className}`}>
      {STEPS.map((step, i) => {
        const done = i < currentIndex
        const active = i === currentIndex
        const upcoming = i > currentIndex
        return (
          <li key={step.key} className={`flex flex-col items-center ${i === STEPS.length - 1 ? '' : 'flex-1'}`}>
            <div className="flex w-full items-center">
              <span
                aria-current={active ? 'step' : undefined}
                className={`h-3 w-3 shrink-0 rounded-full ring-2 ring-offset-2 ring-offset-navy-900 transition-colors ${
                  done || active
                    ? 'bg-turquoise-400 ring-turquoise-400'
                    : 'bg-transparent ring-sand-100/25'
                } ${active ? 'animate-pulse' : ''}`}
              />
              {i < STEPS.length - 1 && (
                <span className={`mx-1.5 h-px flex-1 ${done ? 'bg-turquoise-400' : 'bg-sand-100/15'}`} />
              )}
            </div>
            <span
              className={`mt-2 text-center font-body text-xs leading-tight ${
                upcoming ? 'text-sand-300/40' : 'text-sand-100'
              } ${active ? 'font-semibold' : ''}`}
            >
              {step.label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
