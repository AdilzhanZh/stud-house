import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, KeyRound } from 'lucide-react'
import { Card } from '../../../components/Card'
import { Alert } from '../../../components/Alert'
import { Button } from '../../../components/Button'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { extractErrorMessage } from '../../../api/client'
import { clearAIAPIKey, setAIAPIKey, type AISettings } from '../../../api/aiSettingsApi'
import { formatDateTime } from '../../../utils/dateFormat'

// The AI provider key: set it by pasting it in. The server checks it with
// the provider, stores it encrypted and never sends it back — afterwards
// only a "key is set" badge (provider, source, date) is shown here.
export function APIKeyCard({ settings, onChange }: { settings: AISettings; onChange: (s: AISettings) => void }) {
  const { t } = useTranslation()
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [justSet, setJustSet] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const status = settings.api_key
  const providerName = status.provider === 'openrouter' ? 'OpenRouter' : 'Anthropic'

  async function submit() {
    if (!key.trim()) return
    setBusy(true)
    setError(null)
    setJustSet(false)
    try {
      onChange(await setAIAPIKey(key.trim()))
      setJustSet(true)
    } catch (err) {
      setError(extractErrorMessage(err, t('admin.aiSettings.key.setError')))
    } finally {
      // The key leaves the page's state whether or not it was accepted.
      setKey('')
      setBusy(false)
    }
  }

  async function clear() {
    setBusy(true)
    setError(null)
    setJustSet(false)
    try {
      onChange(await clearAIAPIKey())
    } catch (err) {
      setError(extractErrorMessage(err, t('admin.aiSettings.key.clearError')))
    } finally {
      setBusy(false)
      setConfirmClear(false)
    }
  }

  return (
    <Card>
      <div className="flex items-start gap-3">
        <KeyRound className="mt-0.5 h-5 w-5 text-turquoise-400" />
        <div className="flex-1">
          <p className="text-[15px] font-bold text-sand-100">{t('admin.aiSettings.key.title')}</p>
          <p className="mt-0.5 text-sm text-sand-300">{t('admin.aiSettings.key.hint')}</p>
        </div>
      </div>

      <div className="mt-4">
        {status.configured ? (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-mint-500/10 px-4 py-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-mint-400" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-mint-400">
                {t('admin.aiSettings.key.configured', { provider: providerName })}
              </p>
              <p className="text-xs text-sand-300">
                {status.source === 'admin'
                  ? t('admin.aiSettings.key.fromAdmin', { date: status.set_at ? formatDateTime(status.set_at) : '' })
                  : t('admin.aiSettings.key.fromEnv')}
              </p>
            </div>
            {status.source === 'admin' && (
              <Button variant="secondary" onClick={() => setConfirmClear(true)} disabled={busy}>
                {t('admin.aiSettings.key.clear')}
              </Button>
            )}
          </div>
        ) : (
          <Alert variant="warning" message={t('admin.aiSettings.key.missing')} />
        )}
      </div>

      {justSet && <div className="mt-3"><Alert variant="success" message={t('admin.aiSettings.key.setSuccess')} /></div>}
      {error && <div className="mt-3"><Alert variant="error" message={error} /></div>}

      {status.can_set ? (
        <form
          className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-sm font-medium text-sand-200">
              {status.configured ? t('admin.aiSettings.key.replaceLabel') : t('admin.aiSettings.key.newLabel')}
            </span>
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder="sk-or-… / sk-ant-…"
              className="rounded-[14px] border border-navy-700 bg-navy-950 px-4 py-3 text-sm text-sand-100 outline-none focus:border-turquoise-400 focus:ring-4 focus:ring-turquoise-400/15"
            />
          </label>
          <Button type="submit" isLoading={busy} disabled={!key.trim()}>
            {t('admin.aiSettings.key.set')}
          </Button>
        </form>
      ) : (
        <p className="mt-4 text-xs text-sand-300">{t('admin.aiSettings.key.cannotSet')}</p>
      )}
      <p className="mt-3 text-xs text-sand-300">{t('admin.aiSettings.key.security')}</p>

      <ConfirmDialog
        open={confirmClear}
        title={t('admin.aiSettings.key.clearTitle')}
        message={t('admin.aiSettings.key.clearConfirm')}
        danger
        isLoading={busy}
        onConfirm={clear}
        onCancel={() => setConfirmClear(false)}
      />
    </Card>
  )
}
