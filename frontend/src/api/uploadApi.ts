import { apiClient } from './client'

// Files (dormitory images, application documents, etc.) are picked from the
// caller's computer instead of a pasted URL — this uploads the file and
// returns the URL to store (axios sets the multipart boundary itself; do
// not set Content-Type manually here).
export async function uploadFile(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await apiClient.post<{ data: { url: string } }>('/uploads', formData)
  return data.data.url
}
