import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bot } from 'lucide-react'
import { Card } from '../../../components/Card'
import { Alert } from '../../../components/Alert'
import { Button } from '../../../components/Button'
import { extractErrorMessage } from '../../../api/client'
import {
  getAssistantAccess,
  updateAssistantAccess,
  type AssistantAccess,
  type AssistantAudience,
} from '../../../api/aiSettingsApi'
import { formatDateTime } from '../../../utils/dateFormat'
import { adminPageHeading } from '../adminTable'

// Admin-only: which roles may use the AI assistant. Everything else about
// the AI (model, limits, API key) is fixed on the server; a change here
// applies immediately.
export function AISettingsPage() {
  const { t } = useTranslation()
  const [access, setAccess] = useState<AssistantAccess | null>(null)
  const [selected, setSelected] = useState<AssistantAudience[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getAssistantAccess()
      .then((a) => {
        setAccess(a)
        setSelected(a.audiences)
      })
      .catch((err) => setError(extractErrorMessage(err, t('admin.aiSettings.loadError'))))
  }, [t])

  if (!access) {
    return error ? <Alert variant="error" message={error} /> : <p className="text-sm text-sand-300">{t('admin.common.loading')}</p>
  }

  function toggle(a: AssistantAudience, on: boolean) {
    setSaved(false)
    setSelected((s) => (on ? [...s, a] : s.filter((x) => x !== a)))
  }

  async function save() {
    setError(null)
    setSaving(true)
    try {
      const next = await updateAssistantAccess(selected)
      setAccess(next)
      setSelected(next.audiences)
      setSaved(true)
    } catch (err) {
      setError(extractErrorMessage(err, t('admin.aiSettings.saveError')))
    } finally {
      setSaving(false)
    }
  }

  const dirty = selected.length !== access.audiences.length || selected.some((a) => !access.audiences.includes(a))

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <h1 className={adminPageHeading}>{t('admin.aiSettings.title')}</h1>

      {!access.api_key_configured && <Alert variant="warning" message={t('admin.aiSettings.noApiKey')} />}
      {error && <Alert variant="error" message={error} />}
      {saved && <Alert variant="success" message={t('admin.aiSettings.saved')} />}

      <Card>
        <div className="flex items-start gap-3">
          <Bot className="mt-0.5 h-5 w-5 shrink-0 text-turquoise-400" />
          <div className="flex-1">
            <p className="text-[15px] font-bold text-sand-100">{t('admin.aiSettings.accessTitle')}</p>
            <p className="mt-0.5 text-sm text-sand-300">{t('admin.aiSettings.accessHint')}</p>
          </div>
        </div>

        <ul className="mt-4 flex flex-col divide-y divide-navy-700 rounded-xl border border-navy-700">
          {access.all_audiences.map((a) => {
            const on = selected.includes(a)
            return (
              <li key={a} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-sand-100">{t(`admin.aiSettings.audiences.${a}`)}</p>
                  <p className="mt-0.5 text-xs text-sand-300">{t(`admin.aiSettings.audienceHints.${a}`)}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={t(`admin.aiSettings.audiences.${a}`)}
                  onClick={() => toggle(a, !on)}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-navy-600 transition-colors ${on ? 'border-turquoise-500 bg-turquoise-500' : 'bg-navy-700'}`}
                >
                  <span
                    className={`pointer-events-none absolute left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0'}`}
                  />
                </button>
              </li>
            )
          })}
        </ul>

        <ul className="mt-4 flex list-disc flex-col gap-1 pl-5 text-xs text-sand-300">
          <li>{t('admin.aiSettings.overlapHelp')}</li>
          <li>{t('admin.aiSettings.offHelp')}</li>
          <li>{t('admin.aiSettings.fixedHelp', { model: access.model })}</li>
        </ul>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-sand-300">
          {access.updated_at
            ? t('admin.aiSettings.lastUpdated', { date: formatDateTime(access.updated_at) })
            : t('admin.aiSettings.usingDefaults')}
        </p>
        <Button onClick={save} isLoading={saving} disabled={!dirty}>
          {t('admin.aiSettings.save')}
        </Button>
      </div>
    </div>
  )
}
