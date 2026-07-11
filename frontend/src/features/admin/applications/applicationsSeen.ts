const STORAGE_KEY = 'admin_applications_last_seen_at'
const SEEN_EVENT = 'applications-queue-seen'

// Tracks when the manager last viewed the "Менеджерді күтуде" tab of the
// application queue, so the sidebar badge can count only applications that
// arrived after that — not the whole pending backlog every time.
export function getApplicationsLastSeenAt(): number {
  const raw = localStorage.getItem(STORAGE_KEY)
  return raw ? Number(raw) : 0
}

export function markApplicationsSeenNow(): void {
  localStorage.setItem(STORAGE_KEY, String(Date.now()))
  window.dispatchEvent(new Event(SEEN_EVENT))
}

export function onApplicationsSeen(listener: () => void): () => void {
  window.addEventListener(SEEN_EVENT, listener)
  return () => window.removeEventListener(SEEN_EVENT, listener)
}
