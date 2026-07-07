import { apiClient } from './client'
import type { ReportTemplate } from '../types/reports'

export async function listReportTemplates(): Promise<ReportTemplate[]> {
  const { data } = await apiClient.get<{ data: ReportTemplate[] }>('/report-templates')
  return data.data
}

export async function createReportTemplate(
  name: string,
  fileUrl: string,
): Promise<ReportTemplate> {
  const { data } = await apiClient.post<{ data: ReportTemplate }>('/report-templates', {
    name,
    file_url: fileUrl,
  })
  return data.data
}
