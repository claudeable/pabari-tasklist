'use client'

interface Props {
  title: string
  description: string
  icon: string
  fullPageHref: string
  fullPageLabel?: string
  secondaryHref?: string
  secondaryLabel?: string
  secondaryExternal?: boolean
  color?: string
  bg?: string
  features?: string[]
}

export default function CoreModulePage({ title, description, icon, fullPageHref, fullPageLabel, secondaryHref, secondaryLabel, secondaryExternal, color = '#22c55e', bg = '#f0fdf4', features }: Props) {
  return (
    <div style={{ maxWidth: 800, padding: '28px 32px', overflowY: 'auto', flex: 1 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>{title}</h1>
        <p style={{ margin: '5px 0 0', fontSize: 13, color: '#64748b' }}>{description}</p>
      </div>

      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        {/* Module hero */}
        <div style={{ padding: '40px 40px 36px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 28, alignItems: 'flex-start' }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, flexShrink: 0 }}>
            {icon}
          </div>
          <div>
            <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 800, color: '#0f172a' }}>{title}</h2>
            <p style={{ margin: 0, fontSize: 14, color: '#64748b', lineHeight: 1.6, maxWidth: 480 }}>{description}</p>
            <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
              <a
                href={fullPageHref}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 20px', background: color, color: 'white', borderRadius: 8, textDecoration: 'none', fontSize: 13.5, fontWeight: 700 }}
              >
                {fullPageLabel ?? `Open ${title}`} →
              </a>
              {secondaryHref && (
                <a
                  href={secondaryHref}
                  target={secondaryExternal ? '_blank' : undefined}
                  rel={secondaryExternal ? 'noopener noreferrer' : undefined}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 20px', background: 'white', color, border: `1.5px solid ${color}`, borderRadius: 8, textDecoration: 'none', fontSize: 13.5, fontWeight: 700 }}
                >
                  {secondaryLabel ?? 'Open'} ↗
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Feature list */}
        {features && features.length > 0 && (
          <div style={{ padding: '28px 40px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>What you can do</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
              {features.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9' }}>
                  <span style={{ color, fontWeight: 800, fontSize: 14 }}>✓</span>
                  <span style={{ fontSize: 13, color: '#374151' }}>{f}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
