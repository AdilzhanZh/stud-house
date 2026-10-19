import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Bot, FileSearch } from 'lucide-react'
import { Card } from '../../../components/Card'
import { Alert } from '../../../components/Alert'
import { Button } from '../../../components/Button'
import { Select } from '../../../components/Select'
import { Input } from '../../../components/Input'
import { extractErrorMessage } from '../../../api/client'
import { getAISettings, updateAISettings, type AISettings, type AISettingsUpdate } from '../../../api/aiSettingsApi'
import { formatDateTime } from '../../../utils/dateFormat'
import { adminPageHeading } from '../adminTable'
import { APIKeyCard } from './APIKeyCard'

// Admin-only: switch the AI features on/off and pick their model (typed
// freely, with the server's suggestions), effort and limits, and set the
// provider API key. Everything saved applies immediately on the server; the
// key is never shown again once set.
export function AISettingsPage() {
  const { t } = useTranslation()
  const [settings, setSettings] = useState<AISettings | null>(null)
  const [form, setForm] = useState<AISettingsUpdate | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getAISettings()
      .then((s) => {
        setSettings(s)
        setForm(toForm(s))
      })
      .catch((err) => setError(extractErrorMessage(err, t('admin.aiSettings.loadError'))))
  }, [t])

  if (!settings || !form) {
    return error ? <Alert variant="error" message={error} /> : <p className="text-sm text-sand-300">{t('admin.common.loading')}</p>
  }

  const set = <K extends keyof AISettingsUpdate>(key: K, value: AISettingsUpdate[K]) => {
    setSaved(false)
    setForm((f) => (f ? { ...f, [key]: value } : f))
  }

  async function save() {
    if (!form) return
    setError(null)
    setSaving(true)
    try {
      const next = await updateAISettings(form)
      setSettings(next)
      setForm(toForm(next))
      setSaved(true)
    } catch (err) {
      setError(extractErrorMessage(err, t('admin.aiSettings.saveError')))
    } finally {
      setSaving(false)
    }
  }

  const openRouter = settings.provider === 'openrouter'
  const modelInputProps = {
    label: t('admin.aiSettings.model'),
    required: true,
    list: 'ai-model-suggestions',
    autoComplete: 'off',
    spellCheck: false,
    placeholder: t('admin.aiSettings.modelPlaceholder', { example: settings.models?.[0] ?? 'claude-opus-5-5' }),
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <h1 className={adminPageHeading}>{t('admin.aiSettings.title')}</h1>

      <APIKeyCard
        settings={settings}
        onChange={(s) => {
          setSettings(s)
          setForm(toForm(s))
          setSaved(false)
        }}
      />
      <datalist id="ai-model-suggestions">
        {(settings.models ?? []).map((m) => (
          <option key={m} value={m}>
            {t(`admin.aiSettings.models.${m}`, { defaultValue: '' })}
          </option>
        ))}
      </datalist>
      {error && <Alert variant="error" message={error} />}
      {saved && <Alert variant="success" message={t('admin.aiSettings.saved')} />}

      <Card>
        <SectionHeader
          icon={<Bot className="h-5 w-5 text-turquoise-400" />}
          title={t('admin.aiSettings.assistantTitle')}
          hint={t('admin.aiSettings.assistantHint')}
          checked={form.assistant_enabled}
          onToggle={(v) => set('assistant_enabled', v)}
          toggleLabel={t('admin.aiSettings.enabled')}
        />
        <div className="mt-4 grid gap-4 sm:grid-cols-[1.6fr_1fr_1fr]">
          <Input
            {...modelInputProps}
            value={form.assistant_model}
            onChange={(e) => set('assistant_model', e.target.value)}
          />
          <Select
            label={t('admin.aiSettings.effort')}
            required
            value={form.assistant_effort}
            onChange={(e) => set('assistant_effort', e.target.value)}
          >
            {settings.efforts.map((e) => (
              <option key={e} value={e}>
                {t(`admin.aiSettings.efforts.${e}`, { defaultValue: e })}
              </option>
            ))}
          </Select>
          <Input
            label={t('admin.aiSettings.dailyLimit')}
            required
            type="number"
            min={1}
            max={1000}
            value={form.assistant_daily_limit}
            onChange={(e) => set('assistant_daily_limit', Number(e.target.value))}
          />
        </div>
        <ul className="mt-4 flex list-disc flex-col gap-1 pl-5 text-xs text-sand-300">
          <li>{t('admin.aiSettings.modelInputHelp')}</li>
          <li>{t('admin.aiSettings.effortHelp')}</li>
          <li>{t('admin.aiSettings.limitHelp')}</li>
          {!openRouter && <li>{t('admin.aiSettings.costHelp')}</li>}
        </ul>
      </Card>

      <Card>
        <SectionHeader
          icon={<FileSearch className="h-5 w-5 text-turquoise-400" />}
          title={t('admin.aiSettings.checksTitle')}
          hint={t('admin.aiSettings.checksHint')}
          checked={form.document_checks_enabled}
          onToggle={(v) => set('document_checks_enabled', v)}
          toggleLabel={t('admin.aiSettings.enabled')}
        />
        <div className="mt-4 grid gap-4 sm:max-w-sm">
          <Input
            {...modelInputProps}
            value={form.document_check_model}
            onChange={(e) => set('document_check_model', e.target.value)}
          />
        </div>
        <p className="mt-4 text-xs text-sand-300">{t('admin.aiSettings.checksOffHelp')}</p>
      </Card>

      <Card>
        {openRouter ? (
          <>
            <p className="text-xs text-sand-300">{t('admin.aiSettings.modelsHelpOpenRouter')}</p>
            <p className="mt-2 text-xs text-sand-300">{t('admin.aiSettings.privacyHelpOpenRouter')}</p>
          </>
        ) : (
          <>
            <p className="text-xs text-sand-300">{t('admin.aiSettings.modelsHelp')}</p>
            <p className="mt-2 text-xs text-sand-300">{t('admin.aiSettings.fallbackHelp')}</p>
            <p className="mt-2 text-xs text-sand-300">{t('admin.aiSettings.privacyHelp')}</p>
          </>
        )}
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-sand-300">
          {settings.updated_at
            ? t('admin.aiSettings.lastUpdated', { date: formatDateTime(settings.updated_at) })
            : t('admin.aiSettings.usingDefaults')}
        </p>
        <Button onClick={save} isLoading={saving}>
          {t('admin.aiSettings.save')}
        </Button>
      </div>
    </div>
  )
}

function toForm(s: AISettings): AISettingsUpdate {
  return {
    assistant_enabled: s.assistant_enabled,
    assistant_model: s.assistant_model,
    assistant_effort: s.assistant_effort,
    assistant_daily_limit: s.assistant_daily_limit,
    document_checks_enabled: s.document_checks_enabled,
    document_check_model: s.document_check_model,
  }
}

function SectionHeader(props: {
  icon: ReactNode
  title: string
  hint: string
  checked: boolean
  onToggle: (v: boolean) => void
  toggleLabel: string
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5">{props.icon}</span>
      <div className="flex-1">
        <p className="text-[15px] font-bold text-sand-100">{props.title}</p>
        <p className="mt-0.5 text-sm text-sand-300">{props.hint}</p>
      </div>
      <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm text-sand-200">
        {props.toggleLabel}
        <button
          type="button"
          role="switch"
          aria-checked={props.checked}
          aria-label={props.title}
          onClick={() => props.onToggle(!props.checked)}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-navy-600 transition-colors ${props.checked ? 'border-turquoise-500 bg-turquoise-500' : 'bg-navy-700'}`}
        >
          <span
            className={`pointer-events-none absolute left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${props.checked ? 'translate-x-5' : 'translate-x-0'}`}
          />
        </button>
      </label>
    </div>
  )
}
