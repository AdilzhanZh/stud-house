import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '../../components/Card'
import { ThemeToggle } from '../../components/ThemeToggle'
import { useAuth } from '../auth/useAuth'
import { useIsSettled } from '../residence/useIsSettled'
import { getStudentProfile } from '../../api/profileApi'
import type { StudentProfile } from '../../types'

const degreeLabels: Record<NonNullable<StudentProfile['academic_degree']>, string> = {
  bachelor: 'Бакалавриат',
  master: 'Магистратура',
}

const genderLabels: Record<NonNullable<StudentProfile['gender']>, string> = {
  male: 'Ер',
  female: 'Әйел',
}

function initials(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

export function ProfilePage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const isSettled = useIsSettled()
  const [profile, setProfile] = useState<StudentProfile | null>(null)

  useEffect(() => {
    if (!user) return
    getStudentProfile(user.id)
      .then(setProfile)
      .catch(() => setProfile(null))
  }, [user])

  if (!user) return null

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center gap-3.5">
        <span className="flex h-15 w-15 shrink-0 items-center justify-center rounded-full bg-turquoise-500/15 text-xl font-bold text-turquoise-400">
          {initials(user.full_name)}
        </span>
        <div>
          <p className="text-xl font-bold text-sand-100">{user.full_name}</p>
          {profile?.academic_degree && (
            <p className="mt-0.5 text-sm text-sand-300">
              {degreeLabels[profile.academic_degree]}
              {profile.course != null && ` · ${profile.course}-курс`}
            </p>
          )}
        </div>
      </div>

      <Card className="!py-1.5 !px-4.5">
        <div className="flex justify-between gap-3 border-b border-navy-700 py-3.5 text-sm">
          <span className="text-sand-300">Email</span>
          <span className="font-semibold text-sand-100">{user.email}</span>
        </div>
        <div className="flex justify-between gap-3 border-b border-navy-700 py-3.5 text-sm">
          <span className="text-sand-300">Телефон</span>
          <span className="font-semibold text-sand-100">{user.phone || '—'}</span>
        </div>
        <div className="flex justify-between gap-3 border-b border-navy-700 py-3.5 text-sm">
          <span className="text-sand-300">ЖСН</span>
          <span className="font-semibold text-sand-100">{user.iin || '—'}</span>
        </div>
        <div className="flex justify-between gap-3 py-3.5 text-sm">
          <span className="text-sand-300">Жынысы</span>
          <span className="font-semibold text-sand-100">
            {profile?.gender ? genderLabels[profile.gender] : '—'}
          </span>
        </div>
      </Card>

      <Card className="!py-1.5 !px-4.5 md:hidden">
        <div className="flex items-center justify-between gap-3 py-3.5 text-sm font-semibold text-sand-100">
          <span>Тема</span>
          <ThemeToggle />
        </div>
      </Card>

      <Card className="!py-1.5 !px-4.5">
        {isSettled && (
          <button
            onClick={() => navigate('/my-residence')}
            className="flex w-full items-center justify-between gap-3 border-b border-navy-700 py-3.5 text-left text-sm font-semibold text-sand-100"
          >
            <span>Менің орным</span>
            <span className="text-sand-300">→</span>
          </button>
        )}
        <div className="flex items-center justify-between gap-3 border-b border-navy-700 py-3.5 text-sm font-semibold text-sand-400">
          <span>Деректерді өзгерту</span>
          <span className="text-sand-400">→</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center justify-between gap-3 py-3.5 text-left text-sm font-semibold text-clay-400"
        >
          <span>Шығу</span>
          <span>→</span>
        </button>
      </Card>
    </div>
  )
}
