'use client'

import { useState } from 'react'

export default function ChangePasswordPage() {
  const [form, setForm]     = useState({ current: '', next: '', confirm: '' })
  const [error, setError]   = useState('')
  const [saving, setSaving] = useState(false)

  const requirements = [
    { label: '8+ characters',           met: form.next.length >= 8 },
    { label: 'One uppercase letter',     met: /[A-Z]/.test(form.next) },
    { label: 'One number',              met: /[0-9]/.test(form.next) },
    { label: 'One special character',   met: /[^A-Za-z0-9]/.test(form.next) },
  ]

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (form.next !== form.confirm) { setError('Passwords do not match.'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword: form.current, newPassword: form.next }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to change password.'); return }
      window.location.href = '/'
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#1a3a2a',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{
        background: 'white', borderRadius: 16, padding: 36,
        width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, background: '#1a3a2a',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, margin: '0 auto 14px',
          }}>🔐</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#111827', marginBottom: 6 }}>
            Set your personal password
          </div>
          <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>
            Your account is using a default password.<br />
            Please set a private password to continue.
          </div>
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>
              Current (default) password
            </label>
            <input
              type="password"
              value={form.current}
              onChange={e => setForm(v => ({ ...v, current: e.target.value }))}
              placeholder="Your current password"
              required
              style={{
                width: '100%', padding: '10px 12px', border: '1px solid #d1d5db',
                borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>
              New password
            </label>
            <input
              type="password"
              value={form.next}
              onChange={e => setForm(v => ({ ...v, next: e.target.value }))}
              placeholder="Choose a strong password"
              required
              style={{
                width: '100%', padding: '10px 12px',
                border: `1px solid ${form.next && requirements.every(r => r.met) ? '#15803d' : '#d1d5db'}`,
                borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box',
              }}
            />
            {/* Requirements checklist */}
            {form.next && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {requirements.map(r => (
                  <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                    <span style={{ color: r.met ? '#15803d' : '#d1d5db', fontWeight: 700 }}>
                      {r.met ? '✓' : '○'}
                    </span>
                    <span style={{ color: r.met ? '#15803d' : '#9ca3af' }}>{r.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>
              Confirm new password
            </label>
            <input
              type="password"
              value={form.confirm}
              onChange={e => setForm(v => ({ ...v, confirm: e.target.value }))}
              placeholder="Repeat new password"
              required
              style={{
                width: '100%', padding: '10px 12px',
                border: `1px solid ${form.confirm && form.confirm === form.next ? '#15803d' : '#d1d5db'}`,
                borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#dc2626' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={saving || !form.current || !form.next || !form.confirm}
            style={{
              width: '100%', padding: '12px', background: saving ? '#9ca3af' : '#1a3a2a',
              color: 'white', border: 'none', borderRadius: 8, fontSize: 14,
              fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
              opacity: !form.current || !form.next || !form.confirm ? 0.5 : 1,
            }}>
            {saving ? 'Saving…' : 'Set Password & Continue →'}
          </button>
        </form>

        <div style={{ marginTop: 20, padding: '12px 14px', background: '#f0fdf4', borderRadius: 8, fontSize: 12, color: '#15803d', lineHeight: 1.5 }}>
          <strong>Keep your password private.</strong> Never share it with anyone — including the IT admin.
        </div>
      </div>
    </div>
  )
}
