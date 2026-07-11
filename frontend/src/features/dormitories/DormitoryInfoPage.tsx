import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import { extractErrorMessage } from '../../api/client'
import { getDormitory, listDormitoryImages } from '../../api/dormitoryApi'
import type { Dormitory, DormitoryImage, DormitoryType } from '../../types/dormitories'

const dormTypeLabels: Record<DormitoryType, string> = {
  sectional: 'Секциялық',
  corridor: 'Дәліздік',
  block: 'Блоктық',
}

function formatYear(value: string | null): string {
  return value ? value.slice(0, 4) : '—'
}

export function DormitoryInfoPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [dormitory, setDormitory] = useState<Dormitory | null>(null)
  const [images, setImages] = useState<DormitoryImage[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    Promise.all([getDormitory(id), listDormitoryImages(id).catch(() => [])])
      .then(([d, imgs]) => {
        setDormitory(d)
        setImages(imgs)
      })
      .catch((err) => setError(extractErrorMessage(err, 'Жатақхана туралы ақпаратты жүктеу сәтсіз аяқталды')))
  }, [id])

  if (error) return <Alert variant="error" message={error} />
  if (!dormitory) return <p className="text-sm text-sand-300/60">Жүктелуде...</p>

  return (
    <div className="flex flex-col gap-4">
      <Button variant="secondary" className="self-start" onClick={() => navigate('/dormitories')}>
        ← Жатақханаларға оралу
      </Button>

      <Card title={dormitory.name}>
        <p className="text-sm text-sand-300/60">{dormitory.address}</p>

        {images.length > 0 ? (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {images.map((img) => (
              <img
                key={img.id}
                src={img.image_url}
                alt={dormitory.name}
                className="h-48 w-full rounded-md object-cover"
              />
            ))}
          </div>
        ) : (
          <div className="mt-4 flex h-36 w-full items-center justify-center rounded-md bg-navy-800 text-sm text-sand-400">
            Сурет жоқ
          </div>
        )}

        <dl className="mt-6 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase text-sand-300/60">Телефон</dt>
            <dd className="text-sm text-sand-100">{dormitory.phone ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-sand-300/60">Түрі</dt>
            <dd className="text-sm text-sand-100">
              {dormitory.dorm_type ? dormTypeLabels[dormitory.dorm_type] : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-sand-300/60">Қабат саны</dt>
            <dd className="text-sm text-sand-100">{dormitory.floor_count ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-sand-300/60">Жалпы орын саны</dt>
            <dd className="text-sm text-sand-100">{dormitory.total_capacity}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-sand-300/60">Жалпы бөлме саны</dt>
            <dd className="text-sm text-sand-100">{dormitory.total_rooms_target ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-sand-300/60">Ерлерге / Қыздарға / Ортақ бөлме</dt>
            <dd className="text-sm text-sand-100">
              {dormitory.rooms_male ?? '—'} / {dormitory.rooms_female ?? '—'} / {dormitory.rooms_mixed ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-sand-300/60">Айлық төлем</dt>
            <dd className="font-mono text-sm text-sand-100">
              {dormitory.monthly_payment != null ? `${dormitory.monthly_payment} ₸` : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-sand-300/60">Жылдық төлем</dt>
            <dd className="font-mono text-sm text-sand-100">
              {dormitory.yearly_payment != null ? `${dormitory.yearly_payment} ₸` : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-sand-300/60">Салынған жылы</dt>
            <dd className="text-sm text-sand-100">{formatYear(dormitory.built_year)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-sand-300/60">Пайдалануға берілген жылы</dt>
            <dd className="text-sm text-sand-100">{formatYear(dormitory.commissioned_year)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-sand-300/60">Меншік түрі</dt>
            <dd className="text-sm text-sand-100">{dormitory.ownership_form ?? '—'}</dd>
          </div>
        </dl>
      </Card>
    </div>
  )
}
