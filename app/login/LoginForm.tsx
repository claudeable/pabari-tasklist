'use client'

import { useState, FormEvent } from 'react'

export default function LoginForm() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Sign in failed.')
        setLoading(false)
        return
      }

      window.location.href = '/dashboard'
    } catch {
      setError('Network error. Please try again.')
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', border: '1px solid #d1d5db', borderRadius: 5,
    padding: '10px 12px', fontSize: 14, outline: 'none',
    fontFamily: 'inherit', boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 600,
    color: '#374151', marginBottom: 5,
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#1a3a2a',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <div style={{
        background: 'white', borderRadius: 8, padding: '36px 40px',
        width: '100%', maxWidth: 380, boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <span style={{
            background: '#b5833a', color: 'white', fontWeight: 800,
            fontSize: 12, padding: '5px 11px', borderRadius: 4, letterSpacing: '1px',
            display: 'inline-block', marginBottom: 12,
          }}>PABARI</span>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1a3a2a', letterSpacing: '0.2px' }}>
            PABARI GROUP
          </div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
            Sign in to your account
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@pabari.co.ke" required autoFocus
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Password</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" required
              style={inputStyle}
            />
          </div>

          {error && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 5,
              padding: '9px 12px', fontSize: 13, color: '#dc2626', marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit" disabled={loading}
            style={{
              width: '100%', background: loading ? '#9ca3af' : '#b5833a',
              color: 'white', border: 'none', borderRadius: 5,
              padding: '11px', fontSize: 14, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p style={{ fontSize: 11.5, color: '#9ca3af', textAlign: 'center', marginTop: 20, lineHeight: 1.5 }}>
          No self-registration. Contact your administrator<br />to request access.
        </p>
      </div>
    </div>
  )
}
