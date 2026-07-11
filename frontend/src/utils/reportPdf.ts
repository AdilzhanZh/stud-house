import { renderHtmlToPdf } from './pdf'
import type { ReportDetail } from '../types/reports'

const voteLabels: Record<'approved' | 'rejected' | 'pending', string> = {
  approved: 'Мақұлдады',
  rejected: 'Қабылдамады',
  pending: 'Әлі дауыс берген жоқ',
}

export async function downloadReportPdf(report: ReportDetail): Promise<void> {
  // Mirrors the university's own "Рапорт" template: a centered title
  // followed by a plain numbered list of registered students (no table) —
  // each approved application's student is one numbered entry.
  const studentsList = report.students
    .map((s) => `<li style="padding:4px 0;font-size:13px;">${s.student_full_name}</li>`)
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
    <h1 style="font-size:22px;text-align:center;margin:0 0 32px;">Рапорт</h1>

    <ol style="margin:0 0 32px;padding-left:24px;">${studentsList}</ol>

    <h2 style="font-size:16px;margin:0 0 8px;">Комиссия дауыстары</h2>
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr>
          <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #111827;">Мүше</th>
          <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #111827;">Шешім</th>
        </tr>
      </thead>
      <tbody>${votesRows}</tbody>
    </table>
  `)
  doc.save(`report-${report.id}.pdf`)
}
