import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import { Card } from '../../../components/Card'
import { Alert } from '../../../components/Alert'
import { extractErrorMessage } from '../../../api/client'
import { getCampaignStats } from '../../../api/campaignApi'
import { formatDate } from '../../../utils/dateFormat'
import type { CampaignStage, CampaignStats } from '../../../types/campaign'

// Pipeline order: where an application is now, left to right through the
// intake process, then the two ways out of it.
const STAGES: CampaignStage[] = [
  'awaiting_review',
  'awaiting_documents',
  'awaiting_commission',
  'awaiting_confirmation',
  'confirmation_overdue',
  'settled',
  'rejected',
  'contract_declined',
]

// Clicking a stage opens the screen where it gets resolved.
const STAGE_LINKS: Partial<Record<CampaignStage, string>> = {
  awaiting_review: '/admin/applications',
  awaiting_documents: '/admin/applications',
  awaiting_commission: '/admin/protocols',
  awaiting_confirmation: '/admin/contracts',
  confirmation_overdue: '/admin/contracts',
}

const cardTitle = 'text-[15px] font-bold text-sand-100'
const tileLabel = 'text-[11px] font-semibold tracking-wide text-sand-300 uppercase'

export function CampaignProgress() {
  const { t } = useTranslation()
  const [stats, setStats] = useState<CampaignStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getCampaignStats()
      .then((s) => !cancelled && setStats(s))
      .catch((err) => !cancelled && setError(extractErrorMessage(err, t('admin.campaign.loadError'))))
    return () => {
      cancelled = true
    }
  }, [t])

  if (error) return <Alert variant="error" message={error} />
  if (!stats) return <p className="text-sm text-sand-300">{t('admin.common.loading')}</p>

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[18px] font-bold text-sand-100">{t('admin.campaign.title')}</h2>
        <span className="text-xs text-sand-300">
          {t('admin.campaign.since', { date: formatDate(stats.campaign_start) })}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Pipeline stats={stats} />
        <div className="flex flex-col gap-5">
          <ReviewProgress stats={stats} />
          <DailyTrend daily={stats.daily} />
        </div>
      </div>

      <Seats stats={stats} />
    </div>
  )
}

function ReviewProgress({ stats }: { stats: CampaignStats }) {
  const { t } = useTranslation()
  const pct = stats.submitted > 0 ? Math.round((stats.reviewed / stats.submitted) * 100) : 0
  return (
    <Card>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className={tileLabel}>{t('admin.campaign.submitted')}</p>
          <p className="mt-1.5 text-2xl font-bold text-sand-100">{stats.submitted}</p>
        </div>
        <div>
          <p className={tileLabel}>{t('admin.campaign.reviewed')}</p>
          <p className="mt-1.5 text-2xl font-bold text-sand-100">
            {stats.reviewed} <span className="text-sm font-semibold text-sand-300">· {pct}%</span>
          </p>
        </div>
      </div>
      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-navy-800"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full rounded-full bg-turquoise-500" style={{ width: `${pct}%` }} />
      </div>
    </Card>
  )
}

function Pipeline({ stats }: { stats: CampaignStats }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const max = Math.max(1, ...STAGES.map((s) => stats.stages[s] ?? 0))

  return (
    <Card>
      <p className={`${cardTitle} mb-3`}>{t('admin.campaign.pipeline')}</p>
      <div className="flex flex-col">
        {STAGES.map((stage) => {
          const count = stats.stages[stage] ?? 0
          const overdue = stage === 'confirmation_overdue' && count > 0
          const link = STAGE_LINKS[stage]
          return (
            <button
              key={stage}
              type="button"
              disabled={!link}
              onClick={() => link && navigate(link)}
              className="group grid grid-cols-[minmax(0,11rem)_1fr_2.5rem] items-center gap-3 rounded-lg py-1.5 text-left enabled:hover:bg-navy-800/60 disabled:cursor-default"
            >
              <span className={`flex items-center gap-1.5 text-sm ${overdue ? 'font-semibold text-clay-400' : 'text-sand-200'}`}>
                {overdue && <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />}
                {t(`admin.campaign.stages.${stage}`)}
              </span>
              <span className="h-2 overflow-hidden rounded-full bg-navy-800">
                <span
                  className={`block h-full rounded-full ${overdue ? 'bg-clay-400' : 'bg-turquoise-500'}`}
                  style={{ width: `${(count / max) * 100}%` }}
                />
              </span>
              <span className="text-right text-sm font-semibold text-sand-100 tabular-nums">{count}</span>
            </button>
          )
        })}
      </div>
      {(stats.stages.awaiting_review ?? 0) > 0 && (
        <p className="mt-3 border-t border-navy-700 pt-3 text-xs text-sand-300">
          {t('admin.campaign.triageBreakdown', {
            green: stats.triage.green,
            yellow: stats.triage.yellow,
          })}
        </p>
      )}
      {(stats.stages.confirmation_overdue ?? 0) > 0 && (
        <p className="mt-2 text-xs text-clay-400">{t('admin.campaign.overdueHint')}</p>
      )}
    </Card>
  )
}

function DailyTrend({ daily }: { daily: CampaignStats['daily'] }) {
  const { t } = useTranslation()
  const [hovered, setHovered] = useState<number | null>(null)
  const max = Math.max(1, ...daily.map((d) => d.count))
  const shown = hovered !== null ? daily[hovered] : null

  return (
    <Card>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <p className={cardTitle}>{t('admin.campaign.daily')}</p>
        <span className="text-xs text-sand-300 tabular-nums">
          {shown ? t('admin.campaign.dailyValue', { date: formatDate(shown.day), count: shown.count }) : ' '}
        </span>
      </div>
      <div className="flex h-24 items-end gap-[2px]" onMouseLeave={() => setHovered(null)}>
        {daily.map((d, i) => (
          <div
            key={d.day}
            className="flex h-full flex-1 cursor-default items-end"
            onMouseEnter={() => setHovered(i)}
            aria-label={t('admin.campaign.dailyValue', { date: formatDate(d.day), count: d.count })}
          >
            <div
              className={`w-full rounded-t ${hovered === i ? 'bg-turquoise-400' : 'bg-turquoise-500/70'}`}
              style={{ height: d.count > 0 ? `${Math.max(4, (d.count / max) * 100)}%` : '2px' }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-sand-300">
        <span>{daily.length > 0 && formatDate(daily[0].day)}</span>
        <span>{daily.length > 0 && formatDate(daily[daily.length - 1].day)}</span>
      </div>
    </Card>
  )
}

function Seats({ stats }: { stats: CampaignStats }) {
  const { t } = useTranslation()
  return (
    <Card>
      <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-2">
        <p className={cardTitle}>{t('admin.campaign.seats')}</p>
        <div className="flex flex-wrap gap-3 text-xs text-sand-300">
          <LegendDot className="bg-turquoise-500" label={t('admin.campaign.residents')} />
          <LegendDot className="bg-turquoise-500/40" label={t('admin.campaign.held')} />
          <LegendDot className="border border-sand-300/50 bg-navy-800" label={t('admin.campaign.free')} />
        </div>
      </div>
      <div className="flex flex-col gap-4">
        {stats.dormitories.map((d) => {
          const total = Math.max(d.room_beds, d.residents + d.held, 1)
          return (
            <div key={d.dormitory_id}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className="text-sm font-semibold text-sand-100">{d.dormitory_name}</span>
                <span className="text-xs text-sand-300 tabular-nums">
                  {t('admin.campaign.seatLine', {
                    residents: d.residents,
                    held: d.held,
                    free: d.free_beds,
                    beds: d.room_beds,
                  })}
                </span>
              </div>
              <div
                className="mt-1.5 flex h-2 gap-[2px] overflow-hidden rounded-full bg-navy-800"
                title={t('admin.campaign.seatLine', {
                  residents: d.residents,
                  held: d.held,
                  free: d.free_beds,
                  beds: d.room_beds,
                })}
              >
                {d.residents > 0 && (
                  <div className="h-full bg-turquoise-500" style={{ width: `${(d.residents / total) * 100}%` }} />
                )}
                {d.held > 0 && (
                  <div className="h-full bg-turquoise-500/40" style={{ width: `${(d.held / total) * 100}%` }} />
                )}
              </div>
              <p className="mt-1 text-xs text-sand-300">
                {t('admin.campaign.dormApplications', { submitted: d.submitted, awaiting: d.awaiting_review })}
              </p>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${className}`} />
      {label}
    </span>
  )
}
