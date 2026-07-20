import { apiClient } from './client'
import type { Report, ReportDetail, ReportStatus, VoteDecision } from '../types/reports'

export async function listReports(status?: ReportStatus): Promise<Report[]> {
  const { data } = await apiClient.get<{ data: Report[] }>('/reports', {
    params: status ? { status } : undefined,
  })
  return data.data
}

export async function getReportDetail(id: string): Promise<ReportDetail> {
  const { data } = await apiClient.get<{ data: ReportDetail }>(`/reports/${id}`)
  return data.data
}

export async function createReport(templateId: string, applicationIds: string[]): Promise<Report> {
  const { data } = await apiClient.post<{ data: Report }>('/reports', {
    template_id: templateId,
    application_ids: applicationIds,
  })
  return data.data
}

export async function reviseReport(id: string, applicationIds: string[]): Promise<Report> {
  const { data } = await apiClient.post<{ data: Report }>(`/reports/${id}/revise`, {
    application_ids: applicationIds,
  })
  return data.data
}

export async function deleteReport(id: string): Promise<void> {
  await apiClient.delete(`/reports/${id}`)
}

// The backend's /export handler currently returns the same JSON shape as
// GetDetail (no real document generation this phase — see
// ReportHandler.Export in backend/internal/http/handler/report_handler.go).
// We still hit the dedicated endpoint (per spec) and turn the JSON into a
// browser download, so "Выгрузка" produces an actual downloadable file.
export async function exportReport(id: string): Promise<ReportDetail> {
  const { data } = await apiClient.get<{ data: ReportDetail }>(`/reports/${id}/export`)
  return data.data
}

// Requires is_committee_member=true.
export async function voteReport(
  id: string,
  decision: VoteDecision,
  reason?: string,
): Promise<Report> {
  const { data } = await apiClient.patch<{ data: Report }>(`/reports/${id}/vote`, {
    decision,
    reason,
  })
  return data.data
}

// Which application ids are already bundled into a non-rejected report (a
// rejected report's applications are free to be re-bundled). Shared by the
// auto-register-on-approval flow and the manual "create report" flow so an
// application is never claimed by two reports at once.
export async function listClaimedApplicationIds(): Promise<Set<string>> {
  const reports = await listReports()
  const activeReports = reports.filter((r) => r.status !== 'rejected')
  const details = await Promise.all(activeReports.map((r) => getReportDetail(r.id)))
  const claimed = new Set<string>()
  for (const detail of details) {
    for (const s of detail.students) claimed.add(s.application_id)
  }
  return claimed
}
