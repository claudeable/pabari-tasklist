// Pabari Workspace — Service Worker v2
const CACHE_NAME = 'pabari-v2'

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
  self.skipWaiting()
  // No pre-caching of HTML pages — they may redirect (login) and Safari
  // cannot handle redirect responses served by a service worker.
  // Static Next.js assets are cached on first fetch below.
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

  // NEVER intercept navigate requests — Safari errors when a SW returns
  // a redirect response for navigation (e.g. /tasks → /login).
  // The browser handles page navigation natively; offline task data
  // is served from IndexedDB via the /api/tasks intercept below.
  if (request.mode === 'navigate') return

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
