// Service worker: shows push notifications and opens the right page when one
// is tapped. It deliberately caches nothing and doesn't handle fetches, so the
// site always loads fresh from the server, exactly as without it; it exists
// for push (and so the site can be installed to the home screen).

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// The payload is what the backend's PushService sends: { title, body, url }.
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'Student House'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/pwa/icon-192.png',
      badge: '/pwa/icon-192.png',
      lang: 'kk',
      data: { url: data.url || '/notifications' },
    }),
  )
})

// Reuse an open window of the site when there is one, so a tap doesn't pile
// up tabs; otherwise open the page in a new one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || '/notifications', self.location.origin).href
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
          await client.focus()
          if ('navigate' in client) await client.navigate(target)
          return
        }
      }
      await self.clients.openWindow(target)
    })(),
  )
})
