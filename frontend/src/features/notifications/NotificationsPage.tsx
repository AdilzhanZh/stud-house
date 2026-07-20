import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Bell, FileText } from 'lucide-react'
import { Card } from '../../components/Card'
import { Alert } from '../../components/Alert'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { DeleteIconButton } from '../../components/DeleteIconButton'
import { extractErrorMessage } from '../../api/client'
import {
  clearAllNotifications,
  deleteNotification,
  listNotifications,
  markNotificationRead,
} from '../../api/notificationApi'
import { formatDateTime } from '../../utils/dateFormat'
import type { Notification, NotificationType } from '../../types/notifications'

const iconByType: Partial<Record<NotificationType, { icon: typeof Bell; tint: string; iconColor: string }>> = {
  document_requested: { icon: AlertCircle, tint: 'bg-amber-500/15', iconColor: 'text-amber-400' },
  contract_sent: { icon: FileText, tint: 'bg-turquoise-500/15', iconColor: 'text-turquoise-400' },
  application_status_changed: { icon: FileText, tint: 'bg-turquoise-500/15', iconColor: 'text-turquoise-400' },
}

export function NotificationsPage() {
  const { t } = useTranslation()
  const [notifications, setNotifications] = useState<Notification[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Notification | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [clearAllOpen, setClearAllOpen] = useState(false)
  const [isClearing, setIsClearing] = useState(false)

  function load() {
    listNotifications()
      .then(setNotifications)
      .catch((err) => setError(extractErrorMessage(err, t('notif.loadError'))))
  }

  useEffect(load, [t])

  async function handleClick(notification: Notification) {
    if (notification.is_read) return
    setNotifications((prev) => prev?.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n)) ?? prev)
    try {
      await markNotificationRead(notification.id)
    } catch {
      load()
    }
  }

  async function handleMarkAllRead() {
    const unread = notifications?.filter((n) => !n.is_read) ?? []
    if (unread.length === 0) return
    setNotifications((prev) => prev?.map((n) => ({ ...n, is_read: true })) ?? prev)
    await Promise.all(unread.map((n) => markNotificationRead(n.id).catch(() => {})))
    load()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      await deleteNotification(deleteTarget.id)
      setNotifications((prev) => prev?.filter((n) => n.id !== deleteTarget.id) ?? prev)
      setDeleteTarget(null)
    } catch (err) {
      setDeleteError(extractErrorMessage(err, t('notif.deleteOneFailed')))
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleClearAll() {
    setIsClearing(true)
    setDeleteError(null)
    try {
      await clearAllNotifications()
      setNotifications([])
      setClearAllOpen(false)
    } catch (err) {
      setDeleteError(extractErrorMessage(err, t('notif.clearAllFailed')))
    } finally {
      setIsClearing(false)
    }
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <h1 className="text-[23px] font-bold text-sand-100">{t('notif.title')}</h1>
        <div className="flex items-center gap-4">
          {notifications && notifications.some((n) => !n.is_read) && (
            <button onClick={handleMarkAllRead} className="text-sm font-semibold text-sand-100 hover:text-turquoise-400">
              {t('notif.markAllRead')}
            </button>
          )}
          {notifications && notifications.length > 0 && (
            <button onClick={() => setClearAllOpen(true)} className="text-sm font-semibold text-clay-400 hover:text-clay-300">
              {t('notif.clearAll')}
            </button>
          )}
        </div>
      </div>

      {error && <Alert variant="error" message={error} />}
      {!error && !notifications && <p className="text-sm text-sand-300">{t('notif.loading')}</p>}
      {notifications && notifications.length === 0 && <p className="text-sm text-sand-300">{t('notif.empty')}</p>}

      <div className="flex flex-col gap-2.5">
        {notifications?.map((n) => {
          const style = iconByType[n.type] ?? { icon: Bell, tint: 'bg-navy-800', iconColor: 'text-sand-200' }
          const Icon = style.icon
          return (
            <Card key={n.id} onClick={() => handleClick(n)} className={n.is_read ? 'opacity-65' : ''}>
              <div className="flex gap-3">
                <span className={`flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-full ${style.tint}`}>
                  <Icon className={`h-4.5 w-4.5 ${style.iconColor}`} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${n.is_read ? 'font-semibold' : 'font-bold'} text-sand-100`}>{n.title}</p>
                  <p className="mt-0.5 text-sm text-sand-200">{n.body}</p>
                  <p className="mt-1.5 text-xs text-sand-300">{formatDateTime(n.created_at)}</p>
                </div>
                {!n.is_read && <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-clay-400" />}
                <div onClick={(e) => e.stopPropagation()}>
                  <DeleteIconButton onClick={() => setDeleteTarget(n)} label={t('notif.deleteOne')} />
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      <ConfirmDialog
        open={deleteTarget != null}
        title={t('notif.deleteOne')}
        message={t('notif.deleteOneConfirm')}
        danger
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      >
        {deleteError && <Alert variant="error" message={deleteError} />}
      </ConfirmDialog>

      <ConfirmDialog
        open={clearAllOpen}
        title={t('notif.clearAllTitle')}
        message={t('notif.clearAllConfirm')}
        confirmLabel={t('notif.clearAllButton')}
        danger
        isLoading={isClearing}
        onConfirm={handleClearAll}
        onCancel={() => setClearAllOpen(false)}
      >
        {deleteError && <Alert variant="error" message={deleteError} />}
      </ConfirmDialog>
    </div>
  )
}
