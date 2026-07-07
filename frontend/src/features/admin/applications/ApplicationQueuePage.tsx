import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '../../../components/Card'
import { Alert } from '../../../components/Alert'
import { StatusBadge } from '../../../components/StatusBadge'
import { extractErrorMessage } from '../../../api/client'
import { listApplications } from '../../../api/applicationAdminApi'
import { listDormitories } from '../../../api/dormitoryApi'
import { listUsers } from '../../../api/adminUserApi'
import type { Application, ApplicationStatus } from '../../../types/applications'

const TABS: { status: ApplicationStatus; label: string }[] = [
  { status: 'pending', label: 'Менеджерді күтуде' },
  { status: 'needs_correction', label: 'Түзетуде' },
  { status: 'approved', label: 'Қабылданды' },
  { status: 'rejected', label: 'Қабылданбады' },
]

export function ApplicationQueuePage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<ApplicationStatus>('pending')
  const [applications, setApplications] = useState<Application[] | null>(null)
  const [namesById, setNamesById] = useState<Record<string, string>>({})
  const [dormitoryNamesById, setDormitoryNamesById] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setApplications(null)
    Promise.all([listApplications(activeTab), listUsers('student'), listDormitories()])
      .then(([apps, students, dormitories]) => {
        if (cancelled) return
        setApplications(apps)
        setNamesById(Object.fromEntries(students.map((s) => [s.id, s.full_name])))
        setDormitoryNamesById(Object.fromEntries(dormitories.map((d) => [d.id, d.name])))
      })
      .catch((err) => {
        if (!cancelled) setError(extractErrorMessage(err, 'Өтініштерді жүктеу сәтсіз аяқталды'))
      })
    return () => {
      cancelled = true
    }
  }, [activeTab])

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-gray-900">Өтініш кезегі</h1>

      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.status}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === tab.status
                ? 'border-b-2 border-indigo-600 text-indigo-600'
                : 'text-gray-500 hover:text-gray-900'
            }`}
            onClick={() => setActiveTab(tab.status)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && <Alert variant="error" message={error} />}
      {!error && !applications && <p className="text-sm text-gray-500">Жүктелуде...</p>}

      {applications && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Студент</th>
                <th className="px-4 py-3">Жатақхана</th>
                <th className="px-4 py-3">Құрылған күні</th>
                <th className="px-4 py-3">Статус</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr
                  key={app.id}
                  className="cursor-pointer border-b border-gray-100 last:border-0 hover:bg-gray-50"
                  onClick={() => navigate(`/admin/applications/${app.id}`)}
                >
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {namesById[app.student_id] ?? app.student_id}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {dormitoryNamesById[app.dormitory_id] ?? app.dormitory_id}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(app.created_at).toLocaleDateString('kk-KZ')}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={app.status} />
                  </td>
                </tr>
              ))}
              {applications.length === 0 && (
                <tr>
                  <td className="px-4 py-3 text-gray-500" colSpan={4}>
                    Өтініш жоқ
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
