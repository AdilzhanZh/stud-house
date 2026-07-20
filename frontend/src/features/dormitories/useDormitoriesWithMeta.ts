import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { extractErrorMessage } from '../../api/client'
import { getDormitoryCapacity, listDormitories, listDormitoryImages } from '../../api/dormitoryApi'
import type { Dormitory } from '../../types/dormitories'

export interface DormitoryCardData extends Dormitory {
  imageUrl: string | null
  vacancy: number
}

// Shared by the Home dormitory previews and the full Dormitories list so
// both compute "N бос орын" the same way (total_capacity - allocated_beds
// from the capacity endpoint, not a second ad-hoc calculation).
export function useDormitoriesWithMeta() {
  const { t } = useTranslation()
  const [dormitories, setDormitories] = useState<DormitoryCardData[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const list = await listDormitories(true)
        if (cancelled) return

        const withMeta = await Promise.all(
          list.map(async (d) => {
            const [images, capacity] = await Promise.all([
              listDormitoryImages(d.id).catch(() => []),
              getDormitoryCapacity(d.id).catch(() => null),
            ])
            return {
              ...d,
              imageUrl: images[0]?.image_url ?? null,
              vacancy: capacity ? capacity.total_capacity - capacity.allocated_beds : d.total_capacity,
            }
          }),
        )
        if (!cancelled) setDormitories(withMeta)
      } catch (err) {
        if (!cancelled) setError(extractErrorMessage(err, t('dorm.loadError')))
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [t])

  return { dormitories, error }
}
