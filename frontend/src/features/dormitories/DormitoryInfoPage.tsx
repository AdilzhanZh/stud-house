import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronLeft } from 'lucide-react'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import { extractErrorMessage } from '../../api/client'
import { getDormitory, getDormitoryCapacity, listDormitoryImages } from '../../api/dormitoryApi'
import { dormTypeLabel, formatTenge } from '../../utils/dormitoryLabels'
import type { Dormitory, DormitoryCapacity, DormitoryImage } from '../../types/dormitories'

function formatYear(value: string | null): string {
  return value ? value.slice(0, 4) : '—'
}

export function DormitoryInfoPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [dormitory, setDormitory] = useState<Dormitory | null>(null)
  const [images, setImages] = useState<DormitoryImage[]>([])
  const [capacity, setCapacity] = useState<DormitoryCapacity | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    Promise.all([
      getDormitory(id),
      listDormitoryImages(id).catch(() => []),
      getDormitoryCapacity(id).catch(() => null),
    ])
      .then(([d, imgs, cap]) => {
        setDormitory(d)
        setImages(imgs)
        setCapacity(cap)
      })
      .catch((err) => setError(extractErrorMessage(err, t('dorm.loadInfoError'))))
  }, [id, t])

  if (error) return <Alert variant="error" message={error} />
  if (!dormitory) return <p className="text-sm text-sand-300">{t('dorm.loading')}</p>

  const vacancy = capacity ? capacity.total_capacity - capacity.allocated_beds : dormitory.total_capacity

  return (
    <div className="flex flex-col gap-3.5">
      <button
        onClick={() => navigate('/dormitories')}
        className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-sand-300 hover:text-sand-100"
      >
        <ChevronLeft className="h-4 w-4" /> {t('dorm.title')}
      </button>

      {images.length > 0 ? (
        <img src={images[0].image_url} alt={dormitory.name} className="h-40 w-full rounded-[20px] object-cover" />
      ) : (
        <div
          className="flex h-40 w-full items-center justify-center rounded-[20px]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, var(--color-navy-800) 0 8px, var(--color-navy-950) 8px 16px)',
          }}
        >
          <span className="font-mono text-[10px] text-sand-400">{t('dorm.photoPlaceholder')}</span>
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[22px] font-bold text-sand-100">{dormitory.name}</p>
          <p className="mt-0.5 text-sm text-sand-300">
            {dormitory.address}
            {dormitory.phone && ` · ${dormitory.phone}`}
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center rounded-full px-3 py-1.5 text-sm font-semibold whitespace-nowrap ${
            vacancy > 0 ? 'bg-turquoise-500/10 text-turquoise-400' : 'bg-navy-800 text-sand-300'
          }`}
        >
          {vacancy > 0 ? t('dorm.vacancyCount', { count: vacancy }) : t('dorm.noVacancy')}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <Card className="!p-3.5">
          <p className="text-[11px] font-semibold tracking-wide text-sand-300 uppercase">{t('dorm.monthlyPayment')}</p>
          <p className="mt-1.5 text-lg font-bold text-sand-100">{formatTenge(dormitory.monthly_payment)}</p>
        </Card>
        <Card className="!p-3.5">
          <p className="text-[11px] font-semibold tracking-wide text-sand-300 uppercase">{t('dorm.yearlyPayment')}</p>
          <p className="mt-1.5 text-lg font-bold text-sand-100">{formatTenge(dormitory.yearly_payment)}</p>
        </Card>
        <Card className="!p-3.5">
          <p className="text-[11px] font-semibold tracking-wide text-sand-300 uppercase">{t('dorm.type')}</p>
          <p className="mt-1.5 text-lg font-bold text-sand-100">
            {dormitory.dorm_type ? dormTypeLabel(dormitory.dorm_type, t) : '—'}
          </p>
        </Card>
        <Card className="!p-3.5">
          <p className="text-[11px] font-semibold tracking-wide text-sand-300 uppercase">{t('dorm.floor')}</p>
          <p className="mt-1.5 text-lg font-bold text-sand-100">{dormitory.floor_count ?? '—'}</p>
        </Card>
      </div>

      <Card>
        <p className="mb-2.5 text-[15px] font-bold text-sand-100">{t('dorm.details')}</p>
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-sand-300">{t('dorm.totalCapacityRooms')}</span>
            <span className="font-semibold text-sand-100">
              {dormitory.total_capacity} / {dormitory.total_rooms_target ?? '—'}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-sand-300">{t('dorm.roomsByGender')}</span>
            <span className="font-semibold text-sand-100">
              {dormitory.rooms_male ?? '—'} / {dormitory.rooms_female ?? '—'} / {dormitory.rooms_mixed ?? '—'}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-sand-300">{t('dorm.builtYear')}</span>
            <span className="font-semibold text-sand-100">{formatYear(dormitory.built_year)}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-sand-300">{t('dorm.ownershipForm')}</span>
            <span className="font-semibold text-sand-100">{dormitory.ownership_form ?? '—'}</span>
          </div>
        </div>
      </Card>

      <Button
        className="w-full"
        onClick={() => navigate(`/applications/new?dormitory_id=${dormitory.id}`)}
      >
        {t('dorm.applyButton')}
      </Button>
    </div>
  )
}
