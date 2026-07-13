import { Check } from 'lucide-react'

export type JourneyStep = 'submitted' | 'under_review' | 'approved' | 'contract' | 'payment' | 'settled'

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

function StepNode({ done, active }: { done: boolean; active: boolean }) {
  if (done) {
    return (
      <span className="flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-full bg-turquoise-500">
        <Check className="h-3.5 w-3.5 text-ink" strokeWidth={3} />
      </span>
    )
  }
  if (active) {
    return (
      <span
        aria-current="step"
        className="flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-full border-2 border-turquoise-500 bg-turquoise-500/15"
      >
        <span className="h-2 w-2 animate-pulse rounded-full bg-turquoise-500" />
      </span>
    )
  }
  return <span className="h-6.5 w-6.5 shrink-0 rounded-full border-2 border-navy-700 box-border" />
}

// The site's signature visual: a step-by-step progress line showing where a
// student's application sits between submission and move-in. Reused as-is
// (same component, different currentStep) wherever the journey needs
// showing — the student's own application view and the manager's queue.
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
            <li key={step.key} className="flex items-stretch gap-3">
              <div className="flex flex-col items-center">
                <StepNode done={done} active={active} />
                {i < STEPS.length - 1 && (
                  <span
                    className={`mt-0.5 w-0.5 flex-1 ${done ? 'bg-turquoise-500' : 'bg-navy-700'}`}
                    style={{ minHeight: '1.25rem' }}
                  />
                )}
              </div>
              <div className={`pb-4 ${active ? '' : 'pt-1'}`}>
                <p
                  className={`text-sm ${
                    upcoming ? 'text-sand-400' : 'text-sand-100'
                  } ${active ? 'font-bold' : 'font-medium'}`}
                >
                  {step.label}
                  {active && ' — қазір осында'}
                </p>
              </div>
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
              <StepNode done={done} active={active} />
              {i < STEPS.length - 1 && (
                <span className={`mx-1 h-0.5 flex-1 ${done ? 'bg-turquoise-500' : 'bg-navy-700'}`} />
              )}
            </div>
            <span
              className={`mt-2 text-center text-xs leading-tight ${
                upcoming ? 'text-sand-400' : 'text-sand-100'
              } ${active ? 'font-bold' : ''}`}
            >
              {step.label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
