export interface RequiredDocument {
  id: string
  name_kk: string
  name_ru: string
  // Days a document stays valid after its issue date; null = never expires.
  validity_days: number | null
  created_at: string
}
