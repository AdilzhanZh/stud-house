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

// The backend's /export handler currently returns the same JSON shape as
// GetDetail (no real document generation this phase — see
// ReportHandler.Export in backend/internal/http/handler/report_handler.go).
// We still hit the dedicated endpoint (per spec) and turn the JSON into a
// browser download, so "Выгрузка" produces an actual downloadable file.
export async function exportReport(id: string): Promise<ReportDetail> {
  const { data } = await apiClient.get<{ data: ReportDetail }>(`/reports/${id}/export`)
  return data.data
}

// committee_member-only.
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
