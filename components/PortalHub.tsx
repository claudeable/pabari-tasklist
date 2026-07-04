'use client'

import { useState, useEffect } from 'react'
import { SessionUser } from '@/types'

interface Props {
  currentUser: SessionUser
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

async function signOut() {
  await fetch('/api/auth/logout', { method: 'POST' })
  window.location.href = '/login'
}

const systems = [
  {
    key: 'tasks',
    icon: '✓',
    iconBg: '#dbeafe',
    iconColor: '#1d4ed8',
    label: 'Task Management',
    description: 'Assign, track, and manage tasks across all group entities.',
    badge: 'Live',
    badgeBg: '#dcfce7',
    badgeColor: '#15803d',
    href: '/tasks',
    detail: 'Pending lists · Assignments · Deadlines',
  },
  {
    key: 'forms',
    icon: '📋',
    iconBg: '#fef3c7',
    iconColor: '#b45309',
    label: 'Forms',
    description: 'Digital forms for leave requests and petty cash requisitions.',
    badge: 'Live',
    badgeBg: '#dcfce7',
    badgeColor: '#15803d',
    href: '/forms',
    detail: 'Leave Requests · Petty Cash',
  },
  {
    key: 'docs',
    icon: '📁',
    iconBg: '#f3e8ff',
    iconColor: '#7c3aed',
    label: 'Document Management',
    description: 'Centralised document storage and management for all entities.',
    badge: 'Coming Soon',
    badgeBg: '#f3f4f6',
    badgeColor: '#6b7280',
    href: null,
    detail: 'All entities · Version control · Expiry tracking',
  },
]

export default function PortalHub({ currentUser }: Props) {
  const [isMobile, setIsMobile] = useState(false)
  const firstName = currentUser.name.split(' ')[0]

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Header */}
      <div style={{
        background: 'white', borderBottom: '1px solid #e5e7eb',
        padding: isMobile ? '14px 16px' : '16px 40px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            background: '#b5833a', color: 'white', fontWeight: 800,
            fontSize: 11, padding: '5px 10px', borderRadius: 4, letterSpacing: '1px',
          }}>PABARI</div>
          {!isMobile && (
            <span style={{ fontSize: 13, color: '#6b7280' }}>platform.pabari.com</span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {!isMobile && (
            <span style={{ fontSize: 13, color: '#374151' }}>
              {currentUser.name} · {currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1)}
            </span>
          )}
          <div style={{
            width: 34, height: 34, borderRadius: '50%',
            background: '#1a3a2a', color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, flexShrink: 0,
          }}>
            {currentUser.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
          </div>
          <button
            onClick={signOut}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'transparent', border: '1px solid #d1d5db',
              borderRadius: 6, padding: '7px 13px', fontSize: 13,
              color: '#374151', cursor: 'pointer',
            }}
          >
            {isMobile ? 'Out' : 'Sign out'}
          </button>
        </div>
      </div>

      {/* Main */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? '32px 16px' : '52px 40px' }}>

        {/* Greeting */}
        <div style={{ marginBottom: 40 }}>
          <h1 style={{ fontSize: isMobile ? 26 : 32, fontWeight: 700, color: '#111827', margin: 0, marginBottom: 8 }}>
            {getGreeting()}, {firstName}
          </h1>
          <p style={{ fontSize: 15, color: '#6b7280', margin: 0 }}>
            Select a system to continue.
          </p>
        </div>

        {/* System cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
          gap: 20,
        }}>
          {systems.map(sys => {
            const isDisabled = !sys.href
            return (
              <div
                key={sys.key}
                onClick={() => { if (sys.href) window.location.href = sys.href }}
                style={{
                  background: 'white',
                  border: `2px solid ${isDisabled ? '#e5e7eb' : '#e5e7eb'}`,
                  borderRadius: 12,
                  padding: 28,
                  cursor: isDisabled ? 'default' : 'pointer',
                  opacity: isDisabled ? 0.65 : 1,
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                  position: 'relative',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                }}
                onMouseEnter={e => {
                  if (!isDisabled) {
                    (e.currentTarget as HTMLDivElement).style.borderColor = '#1a3a2a'
                    ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.10)'
                  }
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = '#e5e7eb'
                  ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'
                }}
              >
                {/* Badge */}
                <div style={{ position: 'absolute', top: 20, right: 20 }}>
                  <span style={{
                    background: sys.badgeBg, color: sys.badgeColor,
                    fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20,
                  }}>
                    {sys.badge === 'Live' && <span style={{ marginRight: 4 }}>●</span>}
                    {sys.badge}
                  </span>
                </div>

                {/* Icon */}
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: sys.iconBg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, marginBottom: 18,
                }}>
                  {sys.icon}
                </div>

                <div style={{ fontSize: 17, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
                  {sys.label}
                </div>
                <div style={{ fontSize: 13.5, color: '#6b7280', marginBottom: 16, lineHeight: 1.55 }}>
                  {sys.description}
                </div>
                <div style={{ fontSize: 12, color: '#9ca3af', borderTop: '1px solid #f3f4f6', paddingTop: 14 }}>
                  {sys.detail}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer note */}
        <div style={{
          marginTop: 48, padding: '14px 20px',
          background: '#f0fdf4', border: '1px solid #bbf7d0',
          borderRadius: 8, fontSize: 13, color: '#15803d',
        }}>
          <strong>Pabari Group Portal</strong> — Task Management and Forms are live.
          Document Management is coming soon.
        </div>
      </div>
    </div>
  )
}
