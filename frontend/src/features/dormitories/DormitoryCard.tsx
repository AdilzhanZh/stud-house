import { useTranslation } from 'react-i18next'
import { Card } from '../../components/Card'
import { dormTypeLabel, formatTenge } from '../../utils/dormitoryLabels'
import type { DormitoryCardData } from './useDormitoriesWithMeta'

const placeholderStyle = {
  backgroundImage:
    'repeating-linear-gradient(45deg, var(--color-navy-800) 0 8px, var(--color-navy-950) 8px 16px)',
}

function VacancyChip({ vacancy }: { vacancy: number }) {
  const { t } = useTranslation()
  if (vacancy <= 0) {
    return (
      <span className="inline-flex shrink-0 items-center rounded-full bg-navy-800 px-2.5 py-1 text-xs font-semibold text-sand-300">
        {t('dorm.noVacancy')}
      </span>
    )
  }
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
        vacancy <= 15 ? 'bg-clay-500/10 text-clay-400' : 'bg-turquoise-500/10 text-turquoise-400'
      }`}
    >
      {t('dorm.vacancyCount', { count: vacancy })}
    </span>
  )
}

interface DormitoryCardProps {
  dormitory: DormitoryCardData
  onClick: () => void
  variant?: 'grid' | 'compact'
}

// Two layouts sourced from the design spec: the full "Жатақханалар" grid
// card (photo, name + availability chip, address/type/floor, price row) and
// the compact preview used on Home (smaller photo, name+address next to
// price, no chip) — same underlying data, different density.
export function DormitoryCard({ dormitory: d, onClick, variant = 'grid' }: DormitoryCardProps) {
  const { t } = useTranslation()
  const noVacancy = d.vacancy <= 0

  if (variant === 'compact') {
    return (
      <Card onClick={onClick} className={`!p-3 ${noVacancy ? 'opacity-55' : ''}`}>
        {d.imageUrl ? (
          <img src={d.imageUrl} alt={d.name} className="h-23 w-full rounded-xl object-cover" />
        ) : (
          <div className="flex h-23 w-full items-center justify-center rounded-xl" style={placeholderStyle}>
            <span className="font-mono text-[10px] text-sand-400">{t('dorm.photoPlaceholder')}</span>
          </div>
        )}
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-sand-100">{d.name}</p>
            <p className="truncate text-xs text-sand-300">{d.address}</p>
          </div>
          <span className="shrink-0 text-sm font-bold text-sand-100">
            {formatTenge(d.monthly_payment_bachelor)}
            <span className="text-xs font-normal text-sand-300">{t('dorm.perMonth')}</span>
          </span>
        </div>
      </Card>
    )
  }

  return (
    <Card onClick={onClick} className={`!p-3.5 ${noVacancy ? 'opacity-55' : ''}`}>
      {d.imageUrl ? (
        <img src={d.imageUrl} alt={d.name} className="h-30 w-full rounded-2xl object-cover" />
      ) : (
        <div className="flex h-30 w-full items-center justify-center rounded-2xl" style={placeholderStyle}>
          <span className="font-mono text-[10px] text-sand-400">{t('dorm.photoPlaceholder')}</span>
        </div>
      )}
      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-base font-semibold text-sand-100">{d.name}</p>
        <VacancyChip vacancy={d.vacancy} />
      </div>
      <p className="mt-0.5 text-sm text-sand-300">
        {d.address}
        {d.dorm_type && ` · ${dormTypeLabel(d.dorm_type, t)}`}
        {d.floor_count != null && ` · ${t('dorm.floorsCount', { count: d.floor_count })}`}
      </p>
      {!noVacancy && (
        <p className="mt-2.5 text-base font-bold text-sand-100">
          {formatTenge(d.monthly_payment_bachelor)} <span className="text-xs font-normal text-sand-300">{t('dorm.perMonthLong')}</span>
        </p>
      )}
    </Card>
  )
}
