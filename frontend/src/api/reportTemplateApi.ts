import { apiClient } from './client'
import type { ReportStudentColumn, ReportTemplate } from '../types/reports'

export async function listReportTemplates(): Promise<ReportTemplate[]> {
  const { data } = await apiClient.get<{ data: ReportTemplate[] }>('/report-templates')
  return data.data
}

export interface ReportTemplatePayload {
  name: string
  intro_text: string
  student_columns: ReportStudentColumn[]
}

export async function createReportTemplate(payload: ReportTemplatePayload): Promise<ReportTemplate> {
  const { data } = await apiClient.post<{ data: ReportTemplate }>('/report-templates', payload)
  return data.data
}

export async function deleteReportTemplate(id: string): Promise<void> {
  await apiClient.delete(`/report-templates/${id}`)
}
