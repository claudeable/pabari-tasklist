'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [showPw, setShowPw]     = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res  = await fetch('/api/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, password }) })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Invalid email or password'); return }
      router.push('/dashboard')
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', background:'linear-gradient(135deg, #14532d 0%, #166534 50%, #15803d 100%)' }}>

      {/* Left panel */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', padding:'60px 80px', color:'#fff' }}>
        <div style={{ maxWidth:420 }}>
          <div style={{ fontSize:48, marginBottom:20 }}>💰</div>
          <h1 style={{ fontSize:36, fontWeight:800, letterSpacing:'-1px', marginBottom:12, lineHeight:1.1 }}>
            Pabari Group<br/>Finance Portal
          </h1>
          <p style={{ fontSize:16, color:'#86efac', lineHeight:1.7, marginBottom:40 }}>
            Manage invoices, payments, budgets and assets across all 17 companies from one secure portal.
          </p>

          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {[
              { icon:'📊', text:'Real-time financial dashboard' },
              { icon:'📄', text:'Invoices, LPOs & documents' },
              { icon:'💸', text:'Payment tracking & reconciliation' },
              { icon:'📈', text:'Budget monitoring & alerts' },
              { icon:'🏗️', text:'Company assets & vehicles' },
            ].map(f => (
              <div key={f.text} style={{ display:'flex', alignItems:'center', gap:12, color:'#bbf7d0', fontSize:14 }}>
                <span style={{ fontSize:18, width:24, textAlign:'center' }}>{f.icon}</span>
                {f.text}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div style={{ width:480, display:'flex', alignItems:'center', justifyContent:'center', padding:40, background:'rgba(0,0,0,.15)' }}>
        <div style={{ width:'100%', maxWidth:400, background:'#fff', borderRadius:16, padding:40, boxShadow:'0 24px 64px rgba(0,0,0,.3)' }}>

          <div style={{ marginBottom:32 }}>
            <h2 style={{ fontSize:22, fontWeight:700, color:'#0f172a', marginBottom:6 }}>Sign in</h2>
            <p style={{ fontSize:13, color:'#64748b' }}>Authorized personnel only</p>
          </div>

          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:18 }}>

            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:6 }}>
                Email Address
              </label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" required autoComplete="email"
                style={{ width:'100%', padding:'11px 14px', border:'1.5px solid #e2e8f0', borderRadius:8, fontSize:14, color:'#0f172a', outline:'none', transition:'border-color .15s' }}
                onFocus={e => e.target.style.borderColor='#15803d'}
                onBlur={e => e.target.style.borderColor='#e2e8f0'}
              />
            </div>

            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:6 }}>
                Password
              </label>
              <div style={{ position:'relative' }}>
                <input
                  type={showPw?'text':'password'} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required autoComplete="current-password"
                  style={{ width:'100%', padding:'11px 42px 11px 14px', border:'1.5px solid #e2e8f0', borderRadius:8, fontSize:14, color:'#0f172a', outline:'none', transition:'border-color .15s' }}
                  onFocus={e => e.target.style.borderColor='#15803d'}
                  onBlur={e => e.target.style.borderColor='#e2e8f0'}
                />
                <button type="button" onClick={() => setShowPw(s => !s)} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:16, color:'#94a3b8' }}>
                  {showPw ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {error && (
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', background:'#fee2e2', borderRadius:8, color:'#991b1b', fontSize:13, fontWeight:500 }}>
                <span>⚠️</span> {error}
              </div>
            )}

            <button
              type="submit" disabled={loading}
              style={{
                width:'100%', padding:'12px', borderRadius:8, border:'none', cursor: loading?'not-allowed':'pointer',
                background: loading ? '#86efac' : 'linear-gradient(135deg, #15803d, #166534)',
                color:'#fff', fontSize:15, fontWeight:700, marginTop:4,
                boxShadow:'0 4px 12px rgba(21,128,61,.35)', transition:'opacity .15s',
                opacity: loading ? .7 : 1,
              }}
            >
              {loading ? 'Signing in…' : 'Sign In →'}
            </button>
          </form>

          <div style={{ marginTop:28, paddingTop:20, borderTop:'1px solid #f1f5f9', textAlign:'center' }}>
            <p style={{ fontSize:12, color:'#94a3b8' }}>
              Access restricted to Finance team members only.<br/>
              Contact your administrator if you need access.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
