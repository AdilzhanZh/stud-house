import type { TFunction } from 'i18next'
import { renderHtmlToPdf } from './pdf'
import { reportStudentColumnLabel, reportStudentColumnValue } from './reportColumns'
import type { ReportDetail } from '../types/reports'

export async function downloadReportPdf(report: ReportDetail, t: TFunction): Promise<void> {
  const voteLabels: Record<'approved' | 'rejected' | 'pending', string> = {
    approved: t('admin.reports.voteApproved'),
    rejected: t('admin.reports.voteRejected'),
    pending: t('admin.reports.votePending'),
  }
  const columns = report.template.student_columns
  const headerRow = columns
    .map((c) => `<th style="text-align:left;padding:6px 8px;border-bottom:1px solid #111827;">${reportStudentColumnLabel(c, t)}</th>`)
    .join('')
  const studentRows = report.students
    .map(
      (s) =>
        `<tr>${columns
          .map((c) => `<td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${reportStudentColumnValue(s, c)}</td>`)
          .join('')}</tr>`,
    )
    .join('')

  const votesRows = report.votes
    .map(
      (v) => `
        <tr>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${v.committee_member_name}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${voteLabels[v.decision ?? 'pending']}${v.reason ? ` — ${v.reason}` : ''}</td>
        </tr>`,
    )
    .join('')

  const doc = await renderHtmlToPdf(`
    <h1 style="font-size:22px;text-align:center;margin:0 0 16px;">${report.template.name}</h1>
    ${report.template.intro_text ? `<p style="font-size:13px;margin:0 0 24px;">${report.template.intro_text}</p>` : ''}

    <table style="width:100%;border-collapse:collapse;margin:0 0 32px;">
      <thead><tr>${headerRow}</tr></thead>
      <tbody>${studentRows}</tbody>
    </table>

    <h2 style="font-size:16px;margin:0 0 8px;">${t('admin.reports.committeeVotes')}</h2>
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr>
          <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #111827;">${t('admin.reports.member')}</th>
          <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #111827;">${t('admin.reports.decision')}</th>
        </tr>
      </thead>
      <tbody>${votesRows}</tbody>
    </table>
  `)
  doc.save(`report-${report.id}.pdf`)
}
