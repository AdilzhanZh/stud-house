import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '../../../components/Card'
import { Alert } from '../../../components/Alert'
import { extractErrorMessage } from '../../../api/client'
import { getReportDetail, listReports } from '../../../api/reportApi'
import { useAuth } from '../../auth/useAuth'

interface Row {
  id: string
  templateName: string
  myVote: 'approved' | 'rejected' | 'pending'
}

export function CommitteeReportListPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    listReports('pending_committee')
      .then(async (reports) => {
        const withDetail = await Promise.all(
          reports.map(async (r) => {
            const detail = await getReportDetail(r.id)
            const myVote = detail.votes.find((v) => v.committee_member_id === user.id)
            return {
              id: r.id,
              templateName: detail.template.name,
              myVote: (myVote?.decision ?? 'pending') as Row['myVote'],
            }
          }),
        )
        if (!cancelled) setRows(withDetail)
      })
      .catch((err) => {
        if (!cancelled) setError(extractErrorMessage(err, 'Рапорттарды жүктеу сәтсіз аяқталды'))
      })
    return () => {
      cancelled = true
    }
  }, [user])

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-2xl text-sand-100">Комиссия рапорттары</h1>

      {error && <Alert variant="error" message={error} />}
      {!error && !rows && <p className="text-sm text-sand-300/60">Жүктелуде...</p>}

      <div className="flex flex-col gap-2">
        {rows?.map((r) => (
          <Card
            key={r.id}
            className="flex cursor-pointer items-center justify-between transition-shadow hover:shadow-md"
            onClick={() => navigate(`/committee/reports/${r.id}`)}
          >
            <span className="font-medium text-sand-100">{r.templateName}</span>
            <span className="text-sm text-sand-300/70">
              Менің дауысым:{' '}
              {r.myVote === 'approved'
                ? 'Мақұлдадым'
                : r.myVote === 'rejected'
                  ? 'Қабылдамадым'
                  : 'Әлі бермедім'}
            </span>
          </Card>
        ))}
        {rows && rows.length === 0 && (
          <p className="text-sm text-sand-300/60">Қаралатын рапорт жоқ</p>
        )}
      </div>
    </div>
  )
}
