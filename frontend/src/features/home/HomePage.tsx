import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Bell, Building2, Clock, FileText } from 'lucide-react'
import { Card } from '../../components/Card'
import { StatusBadge } from '../../components/StatusBadge'
import { SegmentedProgress } from '../../components/SegmentedProgress'
import { Alert } from '../../components/Alert'
import { DormitoryCard } from '../dormitories/DormitoryCard'
import { useDormitoriesWithMeta } from '../dormitories/useDormitoriesWithMeta'
import { useApplicationJourneys } from '../applications/useApplicationJourneys'
import { journeyStepCaption, journeyStepIndex } from '../applications/statusHelpers'
import { listMyApplications } from '../../api/applicationApi'
import { getDormitory } from '../../api/dormitoryApi'
import { useUnreadCount } from '../notifications/useUnreadCount'
import { useAuth } from '../auth/useAuth'
import type { Application } from '../../types/applications'
import type { JourneyStep } from '../../components/ApplicationJourneyStepper'

const NEXT_STEP_HINT_STEPS: JourneyStep[] = ['submitted', 'under_review', 'approved', 'contract', 'payment']

export function HomePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const unreadCount = useUnreadCount()
  const { dormitories } = useDormitoriesWithMeta()

  const [applications, setApplications] = useState<Application[] | null>(null)
  const [dormitoryName, setDormitoryName] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    listMyApplications()
      .then(setApplications)
      .catch(() => setLoadError(t('home.loadApplicationsError')))
  }, [t])

  const latestApplication =
    applications && applications.length > 0
      ? [...applications].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
      : null

  const journeys = useApplicationJourneys(latestApplication ? [latestApplication] : null)
  const journey = latestApplication ? journeys[latestApplication.id] : undefined

  useEffect(() => {
    if (!latestApplication) return
    getDormitory(latestApplication.dormitory_id)
      .then((d) => setDormitoryName(d.name))
      .catch(() => setDormitoryName(null))
  }, [latestApplication])

  const firstName = user?.full_name?.trim().split(/\s+/)[0] ?? ''

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-sand-300">{t('home.greeting')}</p>
          <p className="text-[23px] font-bold text-sand-100">{firstName}</p>
        </div>
        <button
          onClick={() => navigate('/notifications')}
          aria-label={t('nav.notifications')}
          className="relative flex h-10.5 w-10.5 items-center justify-center rounded-full border border-navy-700 bg-navy-900 text-sand-200 md:hidden"
        >
          <Bell className="h-4.5 w-4.5" />
          {unreadCount > 0 && (
            <span className="absolute top-2 right-2.5 h-2 w-2 rounded-full border-2 border-navy-900 bg-clay-400" />
          )}
        </button>
      </div>

      {loadError && <Alert variant="error" message={loadError} />}

      <div className="flex flex-col gap-5 md:grid md:grid-cols-2 md:items-start md:gap-5">
        <div className="flex flex-col gap-3.5">
          {latestApplication && journey?.step ? (
            <Card onClick={() => navigate(`/applications/${latestApplication.id}`)} className="flex flex-col">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold tracking-wide text-sand-300 uppercase">
                  {t('home.myApplication')}
                </span>
                <StatusBadge status={latestApplication.status} />
              </div>
              <p className="mt-2 text-lg font-semibold text-sand-100">{dormitoryName ?? '...'}</p>
              <SegmentedProgress total={6} filled={journeyStepIndex(journey.step) + 1} className="mt-3" />
              <p className="mt-2 text-sm text-sand-200">{journeyStepCaption(journey.step, t)}</p>
              <p className="mt-3 text-sm font-semibold text-turquoise-400">{t('home.openApplication')}</p>
            </Card>
          ) : applications && applications.length === 0 ? (
            <Card onClick={() => navigate('/dormitories')} className="flex flex-col gap-2">
              <p className="text-base font-semibold text-sand-100">{t('home.noApplicationTitle')}</p>
              <p className="text-sm text-sand-300">{t('home.noApplicationBody')}</p>
              <p className="mt-1 text-sm font-semibold text-turquoise-400">{t('home.browseDorms')}</p>
            </Card>
          ) : null}

          {latestApplication &&
            journey?.step &&
            NEXT_STEP_HINT_STEPS.includes(journey.step) && (
              <Card className="!p-3.5">
                <div className="flex items-center gap-3">
                  <span className="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-full bg-amber-500/15">
                    <Clock className="h-4.5 w-4.5 text-amber-400" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-sand-100">{t('home.nextStep')}</p>
                    <p className="text-sm text-sand-300">{t(`home.nextStepHint.${journey.step}`)}</p>
                  </div>
                </div>
              </Card>
            )}

          <div className="grid grid-cols-2 gap-3">
            <Card onClick={() => navigate('/dormitories')} className="!p-3.5 flex flex-col gap-2.5">
              <span className="flex h-8.5 w-8.5 items-center justify-center rounded-full bg-navy-800">
                <Building2 className="h-4 w-4 text-turquoise-400" />
              </span>
              <span className="text-sm font-semibold text-sand-100">{t('home.dormsCard')}</span>
            </Card>
            <Card onClick={() => navigate('/contracts/my')} className="!p-3.5 flex flex-col gap-2.5">
              <span className="flex h-8.5 w-8.5 items-center justify-center rounded-full bg-navy-800">
                <FileText className="h-4 w-4 text-turquoise-400" />
              </span>
              <span className="text-sm font-semibold text-sand-100">{t('home.contractCard')}</span>
            </Card>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[15px] font-bold text-sand-100">{t('home.dormsSectionTitle')}</span>
            <button
              onClick={() => navigate('/dormitories')}
              className="text-sm font-semibold text-sand-100 hover:text-turquoise-400"
            >
              {t('home.seeAll')}
            </button>
          </div>
          {dormitories?.slice(0, 2).map((d) => (
            <DormitoryCard
              key={d.id}
              dormitory={d}
              variant="compact"
              onClick={() => navigate(`/dormitories/${d.id}`)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
