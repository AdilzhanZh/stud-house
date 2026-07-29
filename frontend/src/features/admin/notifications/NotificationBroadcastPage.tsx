import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import { Card } from '../../../components/Card'
import { Input } from '../../../components/Input'
import { Select } from '../../../components/Select'
import { Button } from '../../../components/Button'
import { Alert } from '../../../components/Alert'
import { extractErrorMessage } from '../../../api/client'
import { listDormitories } from '../../../api/dormitoryApi'
import { listUsers } from '../../../api/adminUserApi'
import { sendBroadcast, type BroadcastAudience } from '../../../api/notificationAdminApi'
import { adminPageHeading } from '../adminTable'
import type { Dormitory } from '../../../types/dormitories'
import type { User } from '../../../types'

interface SentEntry {
  title: string
  audienceLabel: string
  sent: number
}

export function NotificationBroadcastPage() {
  const { t } = useTranslation()
  const AUDIENCE_LABELS: Record<BroadcastAudience, string> = {
    all: t('admin.notifications.audienceAll'),
    dormitory: t('admin.layout.dormitories'),
    student: t('admin.notifications.audienceStudent'),
  }
  const [dormitories, setDormitories] = useState<Dormitory[]>([])
  const [students, setStudents] = useState<User[]>([])
  const [audience, setAudience] = useState<BroadcastAudience>('all')
  const [dormitoryId, setDormitoryId] = useState('')
  const [studentIin, setStudentIin] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [justSent, setJustSent] = useState<number | null>(null)
  // Session-only — there's no backend endpoint that lists past broadcasts
  // (they're plain rows in the shared notifications table, not separately
  // tracked), so this history resets on reload rather than pretending to
  // be persisted.
  const [sentHistory, setSentHistory] = useState<SentEntry[]>([])

  useEffect(() => {
    listDormitories().then(setDormitories).catch(() => {})
    listUsers('student').then(setStudents).catch(() => {})
  }, [])

  const trimmedIin = studentIin.trim()
  const matchedStudent = trimmedIin ? (students.find((s) => s.iin === trimmedIin) ?? null) : null

  async function handleSend() {
    setError(null)
    if (audience === 'dormitory' && !dormitoryId) {
      setError(t('admin.notifications.selectDormitory'))
      return
    }
    if (audience === 'student' && !matchedStudent) {
      setError(t('admin.notifications.selectStudent'))
      return
    }
    if (!title.trim() || !body.trim()) {
      setError(t('admin.notifications.titleBodyRequired'))
      return
    }
    setIsSending(true)
    try {
      const { sent } = await sendBroadcast({
        audience,
        dormitory_id: audience === 'dormitory' ? dormitoryId : undefined,
        student_id: audience === 'student' ? matchedStudent!.id : undefined,
        title: title.trim(),
        body: body.trim(),
      })
      setJustSent(sent)
      setSentHistory((prev) => [{ title: title.trim(), audienceLabel: AUDIENCE_LABELS[audience], sent }, ...prev])
      setTitle('')
      setBody('')
    } catch (err) {
      setError(extractErrorMessage(err, t('admin.notifications.sendFailed')))
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <h1 className={adminPageHeading}>{t('admin.layout.broadcast')}</h1>

      {justSent !== null ? (
        <Card className="flex flex-col items-center gap-3 py-7 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-mint-500/15">
            <Check className="h-6 w-6 text-mint-400" strokeWidth={2.5} />
          </span>
          <p className="text-[17px] font-bold text-sand-100">{t('admin.notifications.sentSuccess', { count: justSent })}</p>
          <Button onClick={() => setJustSent(null)}>{t('admin.notifications.newBroadcast')}</Button>
        </Card>
      ) : (
        <Card className="flex flex-col gap-3.5">
          <p className="text-[15px] font-bold text-sand-100">{t('admin.notifications.sendBroadcast')}</p>
          {error && <Alert variant="error" message={error} />}

          <div>
            <p className="mb-2 text-sm font-semibold text-sand-200">{t('admin.notifications.toWhom')}</p>
            <div className="flex flex-wrap gap-2">
              {(['all', 'dormitory', 'student'] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => setAudience(a)}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                    audience === a
                      ? 'border-turquoise-500 bg-turquoise-500/10 text-turquoise-400'
                      : 'border-navy-700 bg-navy-900 text-sand-300'
                  }`}
                >
                  {AUDIENCE_LABELS[a]}
                </button>
              ))}
            </div>
          </div>

          {audience === 'dormitory' && (
            <Select label={t('admin.layout.dormitories')} value={dormitoryId} onChange={(e) => setDormitoryId(e.target.value)} required>
              <option value="">{t('admin.common.select')}</option>
              {dormitories.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          )}

          {audience === 'student' && (
            <div className="flex flex-col gap-1">
              <Input
                label={t('admin.notifications.studentIinLabel')}
                name="studentIin"
                value={studentIin}
                onChange={(e) => setStudentIin(e.target.value)}
                placeholder={t('admin.notifications.studentIinPlaceholder')}
                required
              />
              {trimmedIin &&
                (matchedStudent ? (
                  <p className="text-sm font-semibold text-mint-400">{matchedStudent.full_name}</p>
                ) : (
                  <p className="text-sm text-clay-400">{t('admin.notifications.studentIinNotFound')}</p>
                ))}
            </div>
          )}

          <Input label={t('admin.notifications.titleLabel')} name="title" value={title} onChange={(e) => setTitle(e.target.value)} required />

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-sand-200">
              {t('admin.notifications.bodyLabel')} <span className="text-clay-400">*</span>
            </label>
            <textarea
              rows={4}
              placeholder={t('admin.notifications.bodyPlaceholder')}
              className="w-full resize-y rounded-[14px] border border-navy-700 bg-navy-950 px-3.5 py-2.5 text-sm text-sand-100 outline-none focus:border-turquoise-400 focus:ring-4 focus:ring-turquoise-400/15"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>

          <Button className="self-start" onClick={handleSend} isLoading={isSending}>
            {t('admin.notifications.send')}
          </Button>
        </Card>
      )}

      {sentHistory.length > 0 && (
        <div>
          <p className="mb-2.5 text-[15px] font-bold text-sand-100">{t('admin.notifications.sentHistory')}</p>
          <div className="flex flex-col gap-2.5">
            {sentHistory.map((h, i) => (
              <Card key={i} className="!p-3.5">
                <p className="text-sm font-semibold text-sand-100">{h.title}</p>
                <p className="mt-0.5 text-xs text-sand-300">
                  {h.audienceLabel} · {t('admin.notifications.sentToCount', { count: h.sent })}
                </p>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
