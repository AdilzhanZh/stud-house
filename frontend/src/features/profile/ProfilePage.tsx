import { Card } from '../../components/Card'
import { useAuth } from '../auth/useAuth'

export function ProfilePage() {
  const { user } = useAuth()

  if (!user) return null

  return (
    <div className="flex flex-col gap-6">
      <Card title="Негізгі ақпарат">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase text-sand-300/60">Аты-жөні</dt>
            <dd className="text-sm text-sand-100">{user.full_name}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-sand-300/60">Email</dt>
            <dd className="text-sm text-sand-100">{user.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-sand-300/60">Телефон</dt>
            <dd className="text-sm text-sand-100">{user.phone || '—'}</dd>
          </div>
        </dl>
      </Card>
    </div>
  )
}
