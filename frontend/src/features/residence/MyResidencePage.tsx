import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronLeft } from 'lucide-react'
import { Card } from '../../components/Card'
import { Alert } from '../../components/Alert'
import { extractErrorMessage } from '../../api/client'
import { useAuth } from '../auth/useAuth'
import { getMyResidence } from '../../api/residenceApi'
import { getDormitory } from '../../api/dormitoryApi'
import { listRoomResidents } from '../../api/roomApi'
import { formatDate } from '../../utils/dateFormat'
import { ResidenceRequestsSection } from './ResidenceRequestsSection'
import type { Residence } from '../../types/residence'
import type { Dormitory } from '../../types/dormitories'
import type { RoomResident } from '../../types/rooms'

export function MyResidencePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [residence, setResidence] = useState<Residence | null>(null)
  const [dormitory, setDormitory] = useState<Dormitory | null>(null)
  const [roommates, setRoommates] = useState<RoomResident[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  function load() {
    if (!user) return
    getMyResidence(user.id)
      .then(async (res) => {
        setResidence(res)
        setDormitory(await getDormitory(res.dormitory_id))
        const residents = await listRoomResidents(res.room_id).catch(() => [])
        setRoommates(residents.filter((r) => r.student_id !== user.id && !r.moved_out_at))
      })
      .catch((err) => setLoadError(extractErrorMessage(err, t('residence.loadError'))))
  }

  useEffect(load, [user, t])

  if (loadError) return <Alert variant="error" message={loadError} />
  if (!residence || !dormitory) return <p className="text-sm text-sand-300">{t('residence.loading')}</p>

  return (
    <div className="flex flex-col gap-3.5">
      <button
        onClick={() => navigate('/dashboard/profile')}
        className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-sand-300 hover:text-sand-100"
      >
        <ChevronLeft className="h-4 w-4" /> {t('nav.profile')}
      </button>
      <h1 className="text-[23px] font-bold text-sand-100">{t('residence.title')}</h1>

      <Card>
        <div className="flex items-center gap-3.5">
          <span className="flex h-13.5 w-13.5 shrink-0 items-center justify-center rounded-2xl bg-turquoise-500/15 text-lg font-bold text-turquoise-400">
            {residence.room_number}
          </span>
          <div>
            <p className="text-base font-semibold text-sand-100">
              {dormitory.name} · {t('residence.roomSuffix', { room: residence.room_number })}
            </p>
            <p className="mt-0.5 text-sm text-sand-300">
              {dormitory.address} · {t('residence.capacitySuffix', { count: residence.capacity })}
            </p>
          </div>
        </div>

        {roommates.length > 0 && (
          <div className="mt-3.5 rounded-2xl border border-navy-700 bg-navy-950 p-3.5">
            <p className="mb-2 text-xs font-semibold tracking-wide text-sand-300 uppercase">
              {t('residence.roommatesTitle')}
            </p>
            <div className="flex flex-col gap-2">
              {roommates.map((r, i) => (
                <div key={r.id} className="flex items-center gap-2.5 text-sm text-sand-100">
                  <span className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-full bg-navy-800 text-xs font-bold text-sand-200">
                    {i + 1}
                  </span>
                  {t('residence.roommateSince', { date: formatDate(r.moved_in_at) })}
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <ResidenceRequestsSection />
    </div>
  )
}
