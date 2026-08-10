import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card } from '../../../components/Card'
import { Alert } from '../../../components/Alert'
import { ProtocolStatusBadge } from '../../../components/ProtocolStatusBadge'
import { extractErrorMessage } from '../../../api/client'
import { getProtocolDetail, listProtocols } from '../../../api/protocolApi'
import { formatDate } from '../../../utils/dateFormat'
import { useAuth } from '../../auth/useAuth'
import type { Protocol } from '../../../types/protocols'

interface Row {
  protocol: Protocol
  myDecision: 'approved' | 'rejected' | 'pending'
}

// The committee member's own view of protocols: a "waiting for you" section
// (protocols still pending this member's own vote) up top — the thing they
// actually need to act on — plus every protocol below for general reference.
// Clicking a row goes to the shared ProtocolDetailPage (features/admin/protocols),
// which shows the vote panel itself when applicable.
export function CommitteeProtocolListPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    listProtocols()
      .then(async (protocols) => {
        const withDetail = await Promise.all(
          protocols.map(async (p) => {
            const detail = await getProtocolDetail(p.id)
            const myVote = detail.votes.find((v) => v.committee_member_id === user.id)
            return { protocol: p, myDecision: (myVote?.decision ?? 'pending') as Row['myDecision'] }
          }),
        )
        if (!cancelled) setRows(withDetail)
      })
      .catch((err) => {
        if (!cancelled) setError(extractErrorMessage(err, t('admin.protocols.loadError')))
      })
    return () => {
      cancelled = true
    }
  }, [user, t])

  const waitingForYou = rows?.filter((r) => r.protocol.status === 'pending' && r.myDecision === 'pending') ?? []

  function ProtocolRow({ row }: { row: Row }) {
    return (
      <Card
        key={row.protocol.id}
        className="flex cursor-pointer items-center justify-between transition-shadow hover:shadow-md"
        onClick={() => navigate(`/admin/protocols/${row.protocol.id}`)}
      >
        <div className="flex items-center gap-3">
          <span className="font-medium text-sand-100">№{row.protocol.number}</span>
          <span className="text-xs text-sand-300">{formatDate(row.protocol.created_at)}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-sand-300">
            {t('admin.committee.myVote')}{' '}
            {row.myDecision === 'approved'
              ? t('admin.committee.iApproved')
              : row.myDecision === 'rejected'
                ? t('admin.committee.iRejected')
                : t('admin.committee.notVotedYet')}
          </span>
          <ProtocolStatusBadge status={row.protocol.status} />
        </div>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[23px] font-bold text-sand-100">{t('admin.layout.committeeProtocols')}</h1>

      {error && <Alert variant="error" message={error} />}
      {!error && !rows && <p className="text-sm text-sand-300">{t('admin.common.loading')}</p>}

      {rows && (
        <>
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold tracking-wide text-sand-300 uppercase">
              {t('admin.committee.waitingForYou')}
            </h2>
            {waitingForYou.length === 0 ? (
              <p className="text-sm text-sand-300">{t('admin.committee.noProtocolsToReview')}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {waitingForYou.map((row) => (
                  <ProtocolRow key={row.protocol.id} row={row} />
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold tracking-wide text-sand-300 uppercase">
              {t('admin.committee.allProtocols')}
            </h2>
            <div className="flex flex-col gap-2">
              {rows.map((row) => (
                <ProtocolRow key={row.protocol.id} row={row} />
              ))}
              {rows.length === 0 && <p className="text-sm text-sand-300">{t('admin.protocols.empty')}</p>}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
