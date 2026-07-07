import { useEffect, useState } from 'react'
import { Card } from '../../components/Card'
import { Alert } from '../../components/Alert'
import { extractErrorMessage } from '../../api/client'
import { listNotifications, markNotificationRead } from '../../api/notificationApi'
import type { Notification } from '../../types/notifications'

export function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  function load() {
    listNotifications()
      .then(setNotifications)
      .catch((err) => setError(extractErrorMessage(err, 'Хабарламаларды жүктеу сәтсіз аяқталды')))
  }

  useEffect(load, [])

  async function handleClick(notification: Notification) {
    if (notification.is_read) return
    setNotifications(
      (prev) =>
        prev?.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n)) ?? prev,
    )
    try {
      await markNotificationRead(notification.id)
    } catch {
      load()
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-gray-900">Хабарламалар</h1>

      {error && <Alert variant="error" message={error} />}
      {!error && !notifications && <p className="text-sm text-gray-500">Жүктелуде...</p>}
      {notifications && notifications.length === 0 && (
        <p className="text-sm text-gray-500">Хабарлама жоқ</p>
      )}

      <div className="flex flex-col gap-2">
        {notifications?.map((n) => (
          <Card
            key={n.id}
            className={`cursor-pointer transition-shadow hover:shadow-md ${n.is_read ? '' : 'border-indigo-300'}`}
            onClick={() => handleClick(n)}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={`text-sm ${n.is_read ? 'text-gray-700' : 'font-semibold text-gray-900'}`}>
                  {!n.is_read && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-indigo-500" />}
                  {n.title}
                </p>
                <p className="text-sm text-gray-600">{n.body}</p>
                <p className="mt-1 text-xs text-gray-400">
                  {new Date(n.created_at).toLocaleString('kk-KZ')}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
