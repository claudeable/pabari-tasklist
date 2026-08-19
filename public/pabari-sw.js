// Pabari Workspace — Service Worker v3
const CACHE_NAME = 'pabari-v3'

// ─── IndexedDB helpers ──────────────────────────────────────────────────────

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('pabari-offline', 2)
    req.onupgradeneeded = e => {
      const db = e.target.result
      if (!db.objectStoreNames.contains('tasks-cache')) {
        db.createObjectStore('tasks-cache', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('pending-ops')) {
        const store = db.createObjectStore('pending-ops', { autoIncrement: true })
        store.createIndex('by-task', 'taskId')
      }
    }
    req.onsuccess  = e => resolve(e.target.result)
    req.onerror    = e => reject(e.target.error)
  })
}

async function dbPut(storeName, record) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    tx.objectStore(storeName).put(record)
    tx.oncomplete = () => resolve()
    tx.onerror    = e => reject(e.target.error)
  })
}

async function dbGetAll(storeName) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const req = tx.objectStore(storeName).getAll()
    req.onsuccess = e => resolve(e.target.result)
    req.onerror   = e => reject(e.target.error)
  })
}

async function dbDelete(storeName, key) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    tx.objectStore(storeName).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror    = e => reject(e.target.error)
  })
}

async function dbGetAllKeys(storeName) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const req = tx.objectStore(storeName).getAllKeys()
    req.onsuccess = e => resolve(e.target.result)
    req.onerror   = e => reject(e.target.error)
  })
}

// ─── Install ─────────────────────────────────────────────────────────────────

self.addEventListener('install', event => {
  // Do NOT pre-cache HTML pages — they may redirect (e.g. /tasks/hub → /login
  // when unauthenticated). Safari rejects redirect responses from a SW.
  // Pages are cached lazily on first successful visit in the fetch handler.
  self.skipWaiting()
})

// ─── Activate ────────────────────────────────────────────────────────────────

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

// ─── Fetch ───────────────────────────────────────────────────────────────────

self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Only intercept same-origin requests
  if (url.origin !== self.location.origin) return

  // GET /api/tasks — network first, fall back to IndexedDB cache
  if (url.pathname === '/api/tasks' && request.method === 'GET') {
    event.respondWith(networkFirstTasks(request))
    return
  }

  // PATCH /api/tasks/:id — queue offline mutations
  if (url.pathname.startsWith('/api/tasks/') && request.method === 'PATCH') {
    event.respondWith(queueMutation(request))
    return
  }

  // POST /api/tasks — queue offline creates
  if (url.pathname === '/api/tasks' && request.method === 'POST') {
    event.respondWith(queueMutation(request))
    return
  }

  // Navigation requests — network first, cache successful pages for offline.
  // Key: only cache resp.ok responses (status 200). Never cache redirects.
  // This fixes Safari "Response served by service worker has redirections".
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then(resp => {
        // Cache only genuine 200 responses (not redirects, not errors)
        if (resp.status === 200) {
          caches.open(CACHE_NAME).then(c => c.put(request, resp.clone()))
        }
        return resp
      }).catch(async () => {
        // Offline — serve the cached version of this exact URL
        const cached = await caches.match(request)
        if (cached) return cached
        // Fall back to any cached page the user has visited
        const fallback = await caches.match('/tasks') ||
                         await caches.match('/tasks/hub')
        if (fallback) return fallback
        // Nothing cached — return a simple offline message
        return new Response(
          `<!doctype html><html><head><meta name="viewport" content="width=device-width">
          <title>Pabari — Offline</title>
          <style>body{font-family:system-ui,sans-serif;background:#1a3a2a;color:white;
          display:flex;flex-direction:column;align-items:center;justify-content:center;
          min-height:100vh;margin:0;text-align:center;padding:20px}
          h1{font-size:28px;margin-bottom:12px}p{color:rgba(255,255,255,0.7);font-size:15px;line-height:1.6}
          small{margin-top:24px;color:rgba(255,255,255,0.4);font-size:12px}</style></head>
          <body><h1>✈ You're offline</h1>
          <p>Open the app while connected first — then task data<br>will be available offline.</p>
          <small>Pabari Workspace</small></body></html>`,
          { headers: { 'Content-Type': 'text/html' } }
        )
      })
    )
    return
  }

  // Static Next.js assets — cache first
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached
        return fetch(request).then(resp => {
          if (resp.ok) {
            const clone = resp.clone()
            caches.open(CACHE_NAME).then(c => c.put(request, clone))
          }
          return resp
        })
      })
    )
    return
  }
})

async function networkFirstTasks(request) {
  try {
    const resp = await fetch(request)
    if (resp.ok) {
      const data = await resp.clone().json()
      if (Array.isArray(data)) {
        for (const task of data) {
          await dbPut('tasks-cache', task)
        }
      }
    }
    return resp
  } catch {
    // Offline — return tasks from IndexedDB
    const tasks = await dbGetAll('tasks-cache')
    return new Response(JSON.stringify(tasks), {
      headers: { 'Content-Type': 'application/json', 'X-From-Cache': '1' },
    })
  }
}

async function queueMutation(request) {
  const cloned = request.clone()
  const body = await cloned.json().catch(() => null)
  const url  = new URL(request.url)

  try {
    const resp = await fetch(request)
    if (resp.ok && body) {
      const segments = url.pathname.split('/')
      const taskId = segments[segments.length - 1]
      if (taskId && request.method === 'PATCH') {
        const tasks = await dbGetAll('tasks-cache')
        const task  = tasks.find(t => String(t.id) === taskId)
        if (task) await dbPut('tasks-cache', { ...task, ...body })
      }
    }
    return resp
  } catch {
    // Offline — queue the operation
    const segments = url.pathname.split('/')
    const taskId = segments[segments.length - 1]

    const op = {
      url: url.pathname,
      method: request.method,
      body,
      taskId: taskId || null,
      queuedAt: Date.now(),
    }
    await dbPut('pending-ops', op)

    // Optimistic local update in IndexedDB
    if (body && request.method === 'PATCH' && taskId) {
      const tasks = await dbGetAll('tasks-cache')
      const task  = tasks.find(t => String(t.id) === taskId)
      if (task) await dbPut('tasks-cache', { ...task, ...body })
    }

    try {
      await self.registration.sync.register('pabari-sync')
    } catch {}

    return new Response(JSON.stringify({ ok: true, offline: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

// ─── Background Sync ─────────────────────────────────────────────────────────

self.addEventListener('sync', event => {
  if (event.tag === 'pabari-sync') {
    event.waitUntil(replayPendingOps())
  }
})

async function replayPendingOps() {
  const ops  = await dbGetAll('pending-ops')
  const keys = await dbGetAllKeys('pending-ops')

  const results = { ok: 0, failed: 0 }
  for (let i = 0; i < ops.length; i++) {
    const op  = ops[i]
    const key = keys[i]
    try {
      const resp = await fetch(op.url, {
        method:  op.method,
        headers: { 'Content-Type': 'application/json' },
        body:    op.body ? JSON.stringify(op.body) : undefined,
        credentials: 'include',
      })
      if (resp.ok || resp.status === 404) {
        await dbDelete('pending-ops', key)
        results.ok++
      } else {
        results.failed++
      }
    } catch {
      results.failed++
    }
  }

  // Refresh task cache after sync
  try {
    const resp = await fetch('/api/tasks', { credentials: 'include' })
    if (resp.ok) {
      const tasks = await resp.json()
      if (Array.isArray(tasks)) {
        for (const task of tasks) await dbPut('tasks-cache', task)
      }
    }
  } catch {}

  const clients = await self.clients.matchAll({ type: 'window' })
  for (const client of clients) {
    client.postMessage({ type: 'SYNC_DONE', ...results })
  }
}

// ─── Message from client ──────────────────────────────────────────────────────

self.addEventListener('message', event => {
  if (event.data?.type === 'SYNC_NOW') {
    event.waitUntil(replayPendingOps())
  }
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
