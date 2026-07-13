import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '../../../components/Card'
import { Alert } from '../../../components/Alert'
import { StatusBadge } from '../../../components/StatusBadge'
import { extractErrorMessage } from '../../../api/client'
import { listApplications } from '../../../api/applicationAdminApi'
import { getDormitoryCapacity, listDormitories } from '../../../api/dormitoryApi'
import { listUsers } from '../../../api/adminUserApi'
import type { Application } from '../../../types/applications'
import type { Dormitory, DormitoryCapacity } from '../../../types/dormitories'

function isToday(iso: string): boolean {
  const d = new Date(iso)
  const now = new Date()
  return d.toDateString() === now.toDateString()
}

function isWithinLast24h(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() < 24 * 60 * 60 * 1000
}

interface Stats {
  brandNew: number
  pending: number
  missingDoc: number
  approvedToday: number
  freeBeds: number
}

export function DashboardPage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats | null>(null)
  const [recentApps, setRecentApps] = useState<Application[] | null>(null)
  const [dormitoryNamesById, setDormitoryNamesById] = useState<Record<string, string>>({})
  const [studentNamesById, setStudentNamesById] = useState<Record<string, string>>({})
  const [dormOccupancy, setDormOccupancy] = useState<{ dorm: Dormitory; capacity: DormitoryCapacity }[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [pending, needsCorrection, approved, dormitories, students] = await Promise.all([
          listApplications('pending'),
          listApplications('needs_correction'),
          listApplications('approved'),
          listDormitories(),
          listUsers('student'),
        ])
        if (cancelled) return

        setDormitoryNamesById(Object.fromEntries(dormitories.map((d) => [d.id, d.name])))
        setStudentNamesById(Object.fromEntries(students.map((s) => [s.id, s.full_name])))

        const capacities = await Promise.all(
          dormitories.map(async (d) => ({ dorm: d, capacity: await getDormitoryCapacity(d.id).catch(() => null) })),
        )
        const withCapacity = capacities.filter(
          (c): c is { dorm: Dormitory; capacity: DormitoryCapacity } => c.capacity !== null,
        )
        if (cancelled) return
        setDormOccupancy(withCapacity)

        const freeBeds = withCapacity.reduce(
          (sum, c) => sum + (c.capacity.total_capacity - c.capacity.allocated_beds),
          0,
        )

        setStats({
          brandNew: pending.filter((a) => isWithinLast24h(a.created_at)).length,
          pending: pending.length,
          missingDoc: needsCorrection.length,
          approvedToday: approved.filter((a) => isToday(a.updated_at)).length,
          freeBeds,
        })

        const allRecent = [...pending, ...needsCorrection, ...approved]
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 5)
        setRecentApps(allRecent)
      } catch (err) {
        if (!cancelled) setError(extractErrorMessage(err, 'Дашбордты жүктеу сәтсіз аяқталды'))
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  if (error) return <Alert variant="error" message={error} />

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-[23px] font-bold text-sand-100">Дашборд</h1>

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-5">
        <Card className="!p-4">
          <p className="text-[11px] font-semibold tracking-wide text-sand-300 uppercase">Жаңа</p>
          <p className="mt-1.5 text-2xl font-bold text-sand-100">{stats?.brandNew ?? '—'}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-[11px] font-semibold tracking-wide text-sand-300 uppercase">Қаралуда</p>
          <p className="mt-1.5 text-2xl font-bold text-turquoise-400">{stats?.pending ?? '—'}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-[11px] font-semibold tracking-wide text-sand-300 uppercase">Құжат жетіспейді</p>
          <p className="mt-1.5 text-2xl font-bold text-amber-400">{stats?.missingDoc ?? '—'}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-[11px] font-semibold tracking-wide text-sand-300 uppercase">Бүгін мақұлданды</p>
          <p className="mt-1.5 text-2xl font-bold text-mint-400">{stats?.approvedToday ?? '—'}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-[11px] font-semibold tracking-wide text-sand-300 uppercase">Бос орындар</p>
          <p className="mt-1.5 text-2xl font-bold text-sand-100">{stats?.freeBeds ?? '—'}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <div className="mb-3 flex items-baseline justify-between">
            <p className="text-[15px] font-bold text-sand-100">Соңғы өтініштер</p>
            <button
              onClick={() => navigate('/admin/applications')}
              className="text-sm font-semibold text-sand-100 hover:text-turquoise-400"
            >
              Барлығы →
            </button>
          </div>
          <div className="flex flex-col">
            {recentApps?.map((app) => (
              <div
                key={app.id}
                onClick={() => navigate(`/admin/applications/${app.id}`)}
                className="flex cursor-pointer items-center justify-between gap-3 border-b border-navy-700 py-3 last:border-0"
              >
                <div>
                  <p className="text-sm font-semibold text-sand-100">
                    {studentNamesById[app.student_id] ?? app.student_id}
                  </p>
                  <p className="mt-0.5 text-xs text-sand-300">
                    {dormitoryNamesById[app.dormitory_id] ?? app.dormitory_id} ·{' '}
                    {new Date(app.created_at).toLocaleDateString('kk-KZ')}
                  </p>
                </div>
                <StatusBadge status={app.status} />
              </div>
            ))}
            {recentApps?.length === 0 && <p className="py-3 text-sm text-sand-300">Өтініш жоқ</p>}
          </div>
        </Card>

        <Card>
          <p className="mb-3.5 text-[15px] font-bold text-sand-100">Жатақханалар толуы</p>
          <div className="flex flex-col gap-3.5">
            {dormOccupancy?.map(({ dorm, capacity }) => {
              const pct =
                capacity.total_capacity > 0
                  ? Math.min(100, Math.round((capacity.allocated_beds / capacity.total_capacity) * 100))
                  : 0
              return (
                <div key={dorm.id}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-semibold text-sand-100">{dorm.name}</span>
                    <span className="text-xs text-sand-300">
                      {capacity.allocated_beds}/{capacity.total_capacity}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-navy-800">
                    <div
                      className={`h-full rounded-full ${pct > 95 ? 'bg-clay-400' : 'bg-turquoise-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>
    </div>
  )
}
