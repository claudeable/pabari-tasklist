self.addEventListener('push', function(event) {
  if (!event.data) return
  const data = event.data.json()
  event.waitUntil(
    self.registration.showNotification(data.title || 'Pabari ERP', {
      body:      data.body || '',
      icon:      '/pabari-icon.png',
      badge:     '/pabari-icon.png',
      tag:       data.tag || 'pabari-msg',
      renotify:  true,
      data:      { url: data.url || '/' },
    })
  )
})

self.addEventListener('notificationclick', function(event) {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
      for (const c of list) {
        if (c.url.includes(self.location.origin) && 'focus' in c) return c.focus()
      }
      return clients.openWindow('/')
    })
  )
})
