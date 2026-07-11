import { apiClient } from './client'

// Report-template files are picked from the admin's computer instead of a
// pasted URL — this uploads the file and returns the URL to store as
// file_url (axios sets the multipart boundary itself; do not set
// Content-Type manually here).
export async function uploadFile(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await apiClient.post<{ data: { url: string } }>('/uploads', formData)
  return data.data.url
}
