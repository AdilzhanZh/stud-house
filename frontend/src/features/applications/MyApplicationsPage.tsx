import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card } from '../../components/Card'
import { Alert } from '../../components/Alert'
import { StatusBadge } from '../../components/StatusBadge'
import { SegmentedProgress } from '../../components/SegmentedProgress'
import { extractErrorMessage } from '../../api/client'
import { listMyApplications } from '../../api/applicationApi'
import { listDormitories } from '../../api/dormitoryApi'
import { useApplicationJourneys } from './useApplicationJourneys'
import { journeyStepCaption, journeyStepIndex } from './statusHelpers'
import { formatDate } from '../../utils/dateFormat'
import type { Application } from '../../types/applications'
import type { Dormitory } from '../../types/dormitories'

export function MyApplicationsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [applications, setApplications] = useState<Application[] | null>(null)
  const [dormitoriesById, setDormitoriesById] = useState<Record<string, Dormitory>>({})
  const [error, setError] = useState<string | null>(null)
  const journeys = useApplicationJourneys(applications)

  useEffect(() => {
    let cancelled = false
    Promise.all([listMyApplications(), listDormitories()])
      .then(([apps, dormitories]) => {
        if (cancelled) return
        setApplications(apps)
        setDormitoriesById(Object.fromEntries(dormitories.map((d) => [d.id, d])))
      })
      .catch((err) => {
        if (!cancelled) setError(extractErrorMessage(err, t('home.loadApplicationsError')))
      })
    return () => {
      cancelled = true
    }
  }, [t])

  return (
    <div className="flex flex-col gap-3.5">
      <h1 className="text-[23px] font-bold text-sand-100">{t('myApplications.title')}</h1>

      {error && <Alert variant="error" message={error} />}
      {!error && !applications && <p className="text-sm text-sand-300">{t('myApplications.loading')}</p>}
      {applications && applications.length === 0 && (
        <p className="text-sm text-sand-300">{t('myApplications.empty')}</p>
      )}

      <div className="flex flex-col gap-3.5">
        {applications?.map((app) => {
          const step = journeys[app.id]?.step
          const rejected = app.status === 'rejected'
          return (
            <Card
              key={app.id}
              onClick={() => navigate(`/applications/${app.id}`)}
              className={rejected ? 'opacity-70' : ''}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-base font-semibold text-sand-100">
                    {dormitoriesById[app.dormitory_id]?.name ?? t('myApplications.dormFallback')}
                  </p>
                  <p className="mt-0.5 text-sm text-sand-300">
                    {t('myApplications.submittedOn', { date: formatDate(app.created_at) })}
                  </p>
                </div>
                <StatusBadge status={app.status} />
              </div>
              {step && !rejected && (
                <>
                  <SegmentedProgress total={6} filled={journeyStepIndex(step) + 1} className="mt-3" />
                  <p className="mt-2 text-sm text-sand-200">{journeyStepCaption(step, t)}</p>
                </>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
