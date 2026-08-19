'use client'

import { useEffect, useState } from 'react'

export default function PWASetup() {
  const [offline, setOffline]       = useState(false)
  const [syncing, setSyncing]       = useState(false)
  const [syncDone, setSyncDone]     = useState(false)
  const [pendingCount, setPending]  = useState(0)

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/pabari-sw.js', { scope: '/' })
        .then(reg => {
          // Listen for SW messages (sync results)
          navigator.serviceWorker.addEventListener('message', e => {
            if (e.data?.type === 'SYNC_DONE') {
              setSyncing(false)
              setSyncDone(true)
              setPending(0)
              setTimeout(() => setSyncDone(false), 4000)
            }
          })

          // Prompt SW update if new version available
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  newWorker.postMessage({ type: 'SKIP_WAITING' })
                }
              })
            }
          })
        })
        .catch(() => {})
    }

    // Track online/offline
    const goOffline = () => setOffline(true)
    const goOnline  = () => {
      setOffline(false)
      setSyncing(true)
      // Trigger sync when back online
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'SYNC_NOW' })
      }
    }

    setOffline(!navigator.onLine)
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])

  // Count pending ops from IndexedDB for offline indicator
  useEffect(() => {
    if (!offline) return
    const interval = setInterval(async () => {
      try {
        const req = indexedDB.open('pabari-offline', 2)
        req.onsuccess = e => {
          const db = (e.target as IDBOpenDBRequest).result
          if (!db.objectStoreNames.contains('pending-ops')) return
          const tx  = db.transaction('pending-ops', 'readonly')
          const cnt = tx.objectStore('pending-ops').count()
          cnt.onsuccess = () => setPending((cnt.result as number))
        }
      } catch {}
    }, 2000)
    return () => clearInterval(interval)
  }, [offline])

  if (!offline && !syncing && !syncDone) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 20px',
      borderRadius: 12,
      fontSize: 13,
      fontWeight: 600,
      fontFamily: 'system-ui, sans-serif',
      boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      background: offline ? '#7f1d1d' : syncing ? '#1a3a2a' : '#14532d',
      color: 'white',
      border: `1px solid ${offline ? '#991b1b' : '#15803d'}`,
      transition: 'background 0.3s',
      pointerEvents: 'none',
      whiteSpace: 'nowrap',
    }}>
      {offline && (
        <>
          <span style={{ fontSize: 16 }}>✈</span>
          <span>
            Offline mode — changes saved locally
            {pendingCount > 0 && ` (${pendingCount} pending)`}
          </span>
        </>
      )}
      {syncing && !offline && (
        <>
          <span style={{
            display: 'inline-block',
            width: 14, height: 14,
            border: '2px solid rgba(255,255,255,0.3)',
            borderTopColor: 'white',
            borderRadius: '50%',
            animation: 'pabari-spin 0.7s linear infinite',
          }} />
          <span>Syncing changes…</span>
        </>
      )}
      {syncDone && !offline && (
        <>
          <span>✓</span>
          <span>All changes synced</span>
        </>
      )}
      <style>{`@keyframes pabari-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
