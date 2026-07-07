import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '../../components/Card'
import { Alert } from '../../components/Alert'
import { StatusBadge } from '../../components/StatusBadge'
import { extractErrorMessage } from '../../api/client'
import { listMyApplications } from '../../api/applicationApi'
import { listDormitories } from '../../api/dormitoryApi'
import type { Application } from '../../types/applications'
import type { Dormitory } from '../../types/dormitories'

export function MyApplicationsPage() {
  const navigate = useNavigate()
  const [applications, setApplications] = useState<Application[] | null>(null)
  const [dormitoriesById, setDormitoriesById] = useState<Record<string, Dormitory>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([listMyApplications(), listDormitories()])
      .then(([apps, dormitories]) => {
        if (cancelled) return
        setApplications(apps)
        setDormitoriesById(Object.fromEntries(dormitories.map((d) => [d.id, d])))
      })
      .catch((err) => {
        if (!cancelled) setError(extractErrorMessage(err, 'Өтініштерді жүктеу сәтсіз аяқталды'))
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-gray-900">Менің өтініштерім</h1>

      {error && <Alert variant="error" message={error} />}
      {!error && !applications && <p className="text-sm text-gray-500">Жүктелуде...</p>}
      {applications && applications.length === 0 && (
        <p className="text-sm text-gray-500">Сізде әлі өтініш жоқ.</p>
      )}

      <div className="flex flex-col gap-3">
        {applications?.map((app) => (
          <Card
            key={app.id}
            className="cursor-pointer transition-shadow hover:shadow-md"
            onClick={() => navigate(`/applications/${app.id}`)}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium text-gray-900">
                  {dormitoriesById[app.dormitory_id]?.name ?? 'Жатақхана'}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(app.created_at).toLocaleDateString('kk-KZ')}
                </p>
              </div>
              <StatusBadge status={app.status} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
