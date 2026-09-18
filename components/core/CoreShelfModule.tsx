'use client'
import { useState, useEffect } from 'react'

export default function CoreShelfModule() {
  const [src, setSrc] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/sso/token', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ portal: 'shelf' }),
    })
      .then(async r => {
        if (!r.ok) {
          const d = await r.json().catch(() => ({}))
          throw new Error((d as { error?: string }).error ?? 'Failed to open Shelf')
        }
        return r.json() as Promise<{ redirect_url: string }>
      })
      .then(data => setSrc(data.redirect_url))
      .catch((e: Error) => setError(e.message))
  }, [])

  if (error) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <p style={{ color: '#dc2626', fontSize: 14 }}>{error}</p>
    </div>
  )

  if (!src) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, border: '3px solid rgba(34,197,94,0.2)', borderTopColor: '#22c55e', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  return (
    <iframe
      src={src}
      style={{ flex: 1, width: '100%', border: 'none', display: 'block', minHeight: 0 }}
      allow="fullscreen"
    />
  )
}
