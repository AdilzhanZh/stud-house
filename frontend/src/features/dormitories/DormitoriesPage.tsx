import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { Alert } from '../../components/Alert'
import { extractErrorMessage } from '../../api/client'
import { listDormitories, listDormitoryImages } from '../../api/dormitoryApi'
import { listMyApplications } from '../../api/applicationApi'
import { isActiveApplicationStatus } from '../applications/statusHelpers'
import type { Dormitory } from '../../types/dormitories'

interface DormitoryCardData extends Dormitory {
  imageUrl: string | null
}

export function DormitoriesPage() {
  const navigate = useNavigate()
  const [dormitories, setDormitories] = useState<DormitoryCardData[] | null>(null)
  const [hasActiveApplication, setHasActiveApplication] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [list, myApplications] = await Promise.all([listDormitories(), listMyApplications()])
        if (cancelled) return
        setHasActiveApplication(myApplications.some((a) => isActiveApplicationStatus(a.status)))

        const withImages = await Promise.all(
          list.map(async (d) => {
            const images = await listDormitoryImages(d.id).catch(() => [])
            return { ...d, imageUrl: images[0]?.image_url ?? null }
          }),
        )
        if (!cancelled) setDormitories(withImages)
      } catch (err) {
        if (!cancelled) setError(extractErrorMessage(err, 'Жатақханаларды жүктеу сәтсіз аяқталды'))
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-gray-900">Жатақханалар</h1>

      {error && <Alert variant="error" message={error} />}
      {hasActiveApplication && (
        <Alert variant="success" message="Сізде белсенді өтініш бар. Жаңа өтініш беру үшін алдымен ағымдағысын шешу керек." />
      )}
      {!error && !dormitories && <p className="text-sm text-gray-500">Жүктелуде...</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {dormitories?.map((d) => (
          <Card key={d.id} className="flex flex-col gap-3">
            {d.imageUrl ? (
              <img src={d.imageUrl} alt={d.name} className="h-36 w-full rounded-md object-cover" />
            ) : (
              <div className="flex h-36 w-full items-center justify-center rounded-md bg-gray-100 text-sm text-gray-400">
                Сурет жоқ
              </div>
            )}
            <div>
              <h2 className="font-semibold text-gray-900">{d.name}</h2>
              <p className="text-sm text-gray-500">{d.address}</p>
            </div>
            {hasActiveApplication ? (
              <p className="text-sm text-gray-500">Сізде белсенді өтініш бар</p>
            ) : (
              <Button
                className="mt-auto self-start"
                onClick={() => navigate(`/applications/new?dormitory_id=${d.id}`)}
              >
                Өтініш беру
              </Button>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
