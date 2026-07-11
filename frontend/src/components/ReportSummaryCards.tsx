import { Card } from './Card'
import { ReportStatusBadge } from './ReportStatusBadge'
import type { ReportDetail } from '../types/reports'

const voteLabels: Record<'approved' | 'rejected' | 'pending', string> = {
  approved: 'Мақұлдады',
  rejected: 'Қабылдамады',
  pending: 'Әлі дауыс берген жоқ',
}

// Read-only template/students/votes display shared between the manager's
// ReportDetailPage (features/admin/reports) and the committee member's
// CommitteeVotePage (features/admin/committee) — same data, different
// action panels rendered below it by each page.
export function ReportSummaryCards({ report }: { report: ReportDetail }) {
  return (
    <>
      <Card>
        <div className="flex items-center justify-between">
          <h1 className="font-heading text-lg text-sand-100">{report.template.name}</h1>
          <ReportStatusBadge status={report.status} />
        </div>
        <a
          href={report.template.file_url}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-turquoise-400 hover:underline"
        >
          Шаблон файлы
        </a>
      </Card>

      <Card title="Студенттер">
        <ul className="flex flex-col gap-2">
          {report.students.map((s) => (
            <li key={s.application_id} className="text-sm">
              <span className="font-medium text-sand-100">{s.student_full_name}</span>{' '}
              <span className="text-sand-300/70">
                ({s.student_email}, {s.student_phone})
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Комиссия дауыстары">
        <ul className="flex flex-col gap-2">
          {report.votes.map((v) => (
            <li key={v.committee_member_id} className="flex justify-between text-sm">
              <span className="text-sand-100">{v.committee_member_name}</span>
              <span className="text-sand-300/70">
                {voteLabels[v.decision ?? 'pending']}
                {v.reason ? ` — ${v.reason}` : ''}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  )
}
