import { useTranslation } from 'react-i18next'
import { Card } from './Card'
import { ReportStatusBadge } from './ReportStatusBadge'
import { reportStudentColumnLabel, reportStudentColumnValue } from '../utils/reportColumns'
import type { ReportDetail } from '../types/reports'

// Read-only template/students/votes display shared between the manager's
// ReportDetailPage (features/admin/reports) and the committee member's
// CommitteeVotePage (features/admin/committee) — same data, different
// action panels rendered below it by each page.
export function ReportSummaryCards({ report }: { report: ReportDetail }) {
  const { t } = useTranslation()
  const voteLabels: Record<'approved' | 'rejected' | 'pending', string> = {
    approved: t('admin.reports.voteApproved'),
    rejected: t('admin.reports.voteRejected'),
    pending: t('admin.reports.votePending'),
  }
  return (
    <>
      <Card>
        <div className="flex items-center justify-between">
          <h1 className="font-heading text-lg text-sand-100">{report.template.name}</h1>
          <ReportStatusBadge status={report.status} />
        </div>
        {report.template.intro_text && (
          <p className="mt-1 text-sm text-sand-300">{report.template.intro_text}</p>
        )}
        {report.template.file_url && (
          <a
            href={report.template.file_url}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-sm text-turquoise-400 hover:underline"
          >
            {t('admin.reports.attachedDocument')}
          </a>
        )}
      </Card>

      <Card title={t('admin.reports.studentsTitle')}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                {report.template.student_columns.map((c) => (
                  <th key={c} className="px-2 py-1.5 text-xs font-semibold text-sand-300">
                    {reportStudentColumnLabel(c, t)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.students.map((s) => (
                <tr key={s.application_id}>
                  {report.template.student_columns.map((c) => (
                    <td key={c} className="px-2 py-1.5 text-sand-100">
                      {reportStudentColumnValue(s, c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title={t('admin.reports.committeeVotes')}>
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
