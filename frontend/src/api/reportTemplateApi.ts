import { apiClient } from './client'
import type { ReportTemplate } from '../types/reports'

export async function listReportTemplates(): Promise<ReportTemplate[]> {
  const { data } = await apiClient.get<{ data: ReportTemplate[] }>('/report-templates')
  return data.data
}
