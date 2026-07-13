import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Alert } from '../../components/Alert'
import { DormitoryCard } from './DormitoryCard'
import { useDormitoriesWithMeta } from './useDormitoriesWithMeta'

export function DormitoriesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { dormitories, error } = useDormitoriesWithMeta()

  return (
    <div className="flex flex-col gap-3.5">
      <h1 className="text-[23px] font-bold text-sand-100">{t('dorm.title')}</h1>

      {error && <Alert variant="error" message={error} />}
      {!error && !dormitories && <p className="text-sm text-sand-300">{t('dorm.loading')}</p>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {dormitories?.map((d) => (
          <DormitoryCard key={d.id} dormitory={d} onClick={() => navigate(`/dormitories/${d.id}`)} />
        ))}
      </div>
    </div>
  )
}
