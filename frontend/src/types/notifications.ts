// Backend has many more notification types than this phase's UI cares about
// (contract/payment/report/transfer_request updates, added in later backend
// phases) — kept as a plain string rather than an exhaustive union so new
// backend types never require a frontend type change.
export type NotificationType = string

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  body: string
  is_read: boolean
  related_application_id: string | null
  created_at: string
}
