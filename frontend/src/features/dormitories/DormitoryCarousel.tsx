import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatTenge } from '../../utils/dormitoryLabels'
import { DormitoryCover } from './DormitoryCover'
import { VacancyChip } from './DormitoryCard'
import type { DormitoryCardData } from './useDormitoriesWithMeta'

const SLIDE_INTERVAL_MS = 5000

interface DormitoryCarouselProps {
  dormitories: DormitoryCardData[]
  onClick: () => void
}

// Home's dormitory preview: one block that cycles through the dormitories on
// its own, and opens the full list when clicked anywhere. Slides always move
// the same way, including from the last back to the first, so only the
// incoming and outgoing slides animate instead of a track rewinding past the
// rest. Rotation holds while the block is hovered or focused, so it doesn't
// change under the student, and stays off for reduced-motion users.
export function DormitoryCarousel({ dormitories, onClick }: DormitoryCarouselProps) {
  const { t } = useTranslation()
  const [slide, setSlide] = useState<{ current: number; previous: number | null }>({ current: 0, previous: null })
  const [paused, setPaused] = useState(false)

  const count = dormitories.length

  useEffect(() => {
    if (count < 2 || paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setInterval(() => {
      setSlide((s) => ({ current: (s.current + 1) % count, previous: s.current }))
    }, SLIDE_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [count, paused])

  if (count === 0) return null

  // The list is refetched when the language changes, so it may come back shorter.
  const current = slide.current % count

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      aria-label={t('home.dormsSectionTitle')}
      className="block w-full cursor-pointer rounded-[20px] bg-navy-900 p-3 text-left shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5"
    >
      {/* Slides share one grid cell, so the block is as tall as the tallest and never jumps. */}
      <div className="grid overflow-hidden">
        {dormitories.map((d, i) => {
          const motion =
            i === current
              ? slide.previous === null
                ? ''
                : 'dorm-slide-in'
              : i === slide.previous
                ? 'dorm-slide-out'
                : 'invisible'
          return (
            <div key={d.id} className={`[grid-area:1/1] min-w-0 ${motion}`}>
              <DormitoryCover
                src={d.imageUrl}
                alt={d.name}
                placeholder={t('dorm.photoPlaceholder')}
                className="aspect-[16/9] rounded-xl"
              />
              <div className="mt-2.5 flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-sm font-semibold text-sand-100">{d.name}</p>
                <VacancyChip vacancy={d.vacancy} />
              </div>
              <div className="mt-0.5 flex items-baseline justify-between gap-2">
                <p className="min-w-0 truncate text-xs text-sand-300">{d.address}</p>
                {d.monthly_payment_bachelor != null && (
                  <span className="shrink-0 text-sm font-bold text-sand-100">
                    {formatTenge(d.monthly_payment_bachelor)}
                    <span className="text-xs font-normal text-sand-300">{t('dorm.perMonth')}</span>
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {count > 1 && (
        <div aria-hidden className="mt-2.5 flex justify-center gap-1.5">
          {dormitories.map((d, i) => (
            <span
              key={d.id}
              className={`h-1.5 rounded-full transition-all ${i === current ? 'w-4 bg-sand-100' : 'w-1.5 bg-sand-100/30'}`}
            />
          ))}
        </div>
      )}
    </button>
  )
}
