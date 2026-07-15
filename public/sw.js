// Pabari ERP — Push Notification Service Worker
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

self.addEventListener('push', function(event) {
  if (!event.data) return
  let data = {}
  try { data = event.data.json() } catch { data = { body: event.data.text() } }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Pabari ERP', {
      body:     data.body  || '',
      icon:     '/favicon.ico',
      badge:    '/favicon.ico',
      tag:      data.tag   || 'pabari-notif',
      renotify: true,
      data:     { url: data.url || '/centre' },
    })
  )
})

self.addEventListener('notificationclick', function(event) {
  event.notification.close()
  const url = event.notification.data?.url || '/centre'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
      const match = list.find(c => c.url.includes(self.location.origin))
      if (match) { match.focus(); return match.navigate(url) }
      return clients.openWindow(url)
    })
  )
})
