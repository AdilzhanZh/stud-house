import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight } from 'lucide-react'
import { DormitoryCover } from './DormitoryCover'
import { VacancyChip } from './DormitoryCard'
import type { DormitoryCardData } from './useDormitoriesWithMeta'

// Enough cards per pass that one pass is wider than any screen, so the
// seamless loop (two identical passes, shifted by half) never shows a gap.
const MIN_CARDS_PER_PASS = 8

function fillPass(list: DormitoryCardData[]): DormitoryCardData[] {
  if (list.length === 0) return []
  const out: DormitoryCardData[] = []
  while (out.length < MIN_CARDS_PER_PASS) out.push(...list)
  return out
}

function MarqueeRow({ items, direction }: { items: DormitoryCardData[]; direction: 'right' | 'left' }) {
  const { t } = useTranslation()
  const pass = fillPass(items)
  return (
    <div className="dorm-marquee-mask overflow-hidden">
      <div
        className={`flex w-max ${direction === 'right' ? 'dorm-marquee-right' : 'dorm-marquee-left'}`}
        style={{ animationDuration: `${pass.length * 6}s` }}
      >
        {[0, 1].map((copy) => (
          // Each copy carries its own trailing gap so the two are exactly
          // equal and the -50% shift lands on the seam.
          <div key={copy} aria-hidden={copy === 1} className="flex gap-3 pr-3">
            {pass.map((d, i) => (
              <div key={i} className="w-44 shrink-0 rounded-2xl bg-navy-900 p-2 shadow-[var(--shadow-card)] md:w-48">
                <DormitoryCover
                  src={d.imageUrl}
                  alt={copy === 0 ? d.name : ''}
                  placeholder={t('dorm.photoPlaceholder')}
                  className="aspect-[16/10] rounded-xl"
                />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-sand-100">{d.name}</p>
                  <VacancyChip vacancy={d.vacancy} />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// Two endlessly scrolling rows of dormitory cards (top row drifts right,
// bottom row left). The whole block is one link to the public catalogue.
export function DormitoryMarquee({ dormitories }: { dormitories: DormitoryCardData[] | null }) {
  const { t } = useTranslation()
  if (dormitories != null && dormitories.length === 0) return null
  const reversed = dormitories ? [...dormitories].reverse() : []

  return (
    <Link to="/dormitories" className="group flex flex-col gap-3 outline-none">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-lg font-bold text-sand-100">{t('auth.marqueeTitle')}</p>
          <p className="text-sm text-sand-300">{t('auth.marqueeSubtitle')}</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-turquoise-500/15 px-3 py-1.5 text-sm font-semibold text-turquoise-400 transition-colors group-hover:bg-turquoise-500/25 group-focus-visible:ring-2 group-focus-visible:ring-turquoise-400">
          {t('auth.marqueeCta')}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
      {dormitories == null ? (
        <div className="flex flex-col gap-3">
          <div className="h-40 animate-pulse rounded-2xl bg-navy-900/60" />
          <div className="h-40 animate-pulse rounded-2xl bg-navy-900/60" />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <MarqueeRow items={dormitories} direction="right" />
          <MarqueeRow items={reversed} direction="left" />
        </div>
      )}
    </Link>
  )
}
