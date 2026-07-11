import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '../../components/Card'
import { Alert } from '../../components/Alert'
import { extractErrorMessage } from '../../api/client'
import { listDormitories, listDormitoryImages } from '../../api/dormitoryApi'
import type { Dormitory } from '../../types/dormitories'

interface DormitoryCardData extends Dormitory {
  imageUrl: string | null
}

export function DormitoriesPage() {
  const navigate = useNavigate()
  const [dormitories, setDormitories] = useState<DormitoryCardData[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const list = await listDormitories()
        if (cancelled) return

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
      <h1 className="font-heading text-2xl text-sand-100">Жатақханалар</h1>

      {error && <Alert variant="error" message={error} />}
      {!error && !dormitories && <p className="text-sm text-sand-300/60">Жүктелуде...</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {dormitories?.map((d) => (
          <Card
            key={d.id}
            className="flex flex-col gap-3"
            onClick={() => navigate(`/dormitories/${d.id}`)}
          >
            {d.imageUrl ? (
              <img src={d.imageUrl} alt={d.name} className="h-36 w-full rounded-md object-cover" />
            ) : (
              <div className="flex h-36 w-full items-center justify-center rounded-md bg-navy-800 text-sm text-sand-400">
                Сурет жоқ
              </div>
            )}
            <div>
              <h2 className="font-heading text-lg text-sand-100">{d.name}</h2>
              <p className="text-sm text-sand-300/60">{d.address}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
