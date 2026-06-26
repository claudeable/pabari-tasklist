'use client'
import { useState } from 'react'
import { SessionUser, COMPANIES, SECTIONS, TaskStatus, STATUS_LABELS, TaskPriority, PRIORITY_LABELS, PRIORITY_STYLE, Task } from '@/types'
import { Report } from '@/lib/reports'
import InactivityGuard from './InactivityGuard'

interface Props {
  currentUser:    SessionUser
  initialReports: Report[]
}

const PEOPLE = [
  'Ahmad','Andu','Ashok','Benson','Binal','Eng. Suresh','Krishina',
  'Lazarus','Mungai','Paul','Sabina','Simon','Yalelet','Yared',
]

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })
}

function generatePDF(tasks: Task[], filters: Record<string, string>, reportName: string) {
  const companyLabel = filters.company || 'All Companies'
  const dateStr = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })
  const filterSummary = [
    filters.section && `Section: ${filters.section}`,
    filters.status  && `Status: ${STATUS_LABELS[filters.status as TaskStatus] || filters.status}`,
    filters.person  && `Person: ${filters.person}`,
  ].filter(Boolean).join(' · ')

  const showCo = !filters.company
  const coTh   = showCo ? '<th>Company</th>' : ''

  const rows = tasks.map(t => `
    <tr>
      <td>${t.sno}</td>
      <td>${t.date || ''}</td>
      ${showCo ? `<td><strong>${t.company}</strong></td>` : ''}
      <td>${(t.section || '').replace('External Stakeholders - ','Ext. ').replace(' PENDING LIST','')}</td>
      <td>${t.category || ''}</td>
      <td><strong>${t.particulars}</strong></td>
      <td>${(t.task_updates?.[0]
        ? `${t.task_updates[0].date}: ${t.task_updates[0].text}`
        : t.updates || ''
      ).slice(0, 250)}</td>
      <td>${t.responsible || ''}</td>
      <td>${STATUS_LABELS[t.status] || t.status}</td>
    </tr>`).join('')

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>${reportName}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; font-size: 9pt; color: #111; }
      .header { background: #1a3a2a; color: white; padding: 12px 16px; display: flex; align-items: center; gap: 12px; }
      .badge { background: #b5833a; color: white; font-weight: 800; font-size: 10pt; padding: 3px 8px; border-radius: 3px; }
      .header h1 { font-size: 13pt; font-weight: 700; }
      .meta { padding: 8px 16px; font-size: 8pt; color: #555; border-bottom: 1px solid #ddd; display: flex; justify-content: space-between; }
      table { width: 100%; border-collapse: collapse; }
      th { background: #f3f4f6; border: 1px solid #d1d5db; padding: 5px 6px; font-size: 7.5pt; font-weight: 700; text-transform: uppercase; text-align: left; }
      td { border: 1px solid #e5e7eb; padding: 5px 6px; font-size: 8pt; vertical-align: top; }
      tr:nth-child(even) td { background: #fafafa; }
      .footer { margin-top: 10px; font-size: 7.5pt; color: #999; text-align: right; padding: 0 16px; }
      @page { size: A4 landscape; margin: 12mm; }
      @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    </style>
  </head><body>
    <div class="header">
      <span class="badge">PABARI</span>
      <h1>PABARI GROUP &mdash; ${reportName}</h1>
    </div>
    <div class="meta">
      <span><strong>${companyLabel}</strong>${filterSummary ? ' · ' + filterSummary : ''} &nbsp;|&nbsp; ${tasks.length} tasks</span>
      <span>Generated: ${dateStr}</span>
    </div>
    <table>
      <thead><tr>
        <th>#</th><th>Date</th>${coTh}<th>Section</th><th>Category</th>
        <th>Particulars</th><th>Latest Update</th><th>Responsible</th><th>Status</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="footer">PABARI GROUP · Internal Use Only · ${dateStr}</div>
    <script>window.onload=()=>window.print()</script>
  </body></html>`

  const w = window.open('', '_blank')
  if (w) { w.document.write(html); w.document.close() }
}

export default function ReportsModule({ currentUser, initialReports }: Props) {
  const [reports, setReports]   = useState<Report[]>(initialReports)
  const [filters, setFilters]   = useState({ company:'', section:'', status:'', priority:'', person:'', dateFrom:'', dateTo:'' })
  const [generating, setGen]    = useState(false)
  const [error, setError]       = useState('')

  const setF = (k: string, v: string) => setFilters(f => ({ ...f, [k]: v }))

  const handleGenerate = async () => {
    setGen(true); setError('')
    try {
      const res  = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(filters),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setReports(prev => [data.report, ...prev])
      generatePDF(data.tasks, filters, data.report.name)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to generate report')
    } finally {
      setGen(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this report record?')) return
    await fetch(`/api/reports/${id}`, { method:'DELETE', credentials:'include' })
    setReports(prev => prev.filter(r => r.id !== id))
  }

  const handleRedownload = async (r: Report) => {
    const res   = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(r.filters),
    })
    const data = await res.json()
    if (res.ok) generatePDF(data.tasks, r.filters, r.name)
  }

  const sel: React.CSSProperties = {
    border:'1px solid #d1d5db', borderRadius:4, padding:'7px 10px',
    fontSize:13, color:'#374151', background:'white', width:'100%',
  }

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh',fontFamily:'Inter,Arial,sans-serif',background:'#f3f4f6'}}>
      <InactivityGuard />

      {/* NAV */}
      <div style={{background:'#1a3a2a',padding:'0 18px',display:'flex',alignItems:'center',gap:12,height:50,flexShrink:0}}>
        <span style={{background:'#b5833a',color:'white',fontWeight:800,fontSize:11,padding:'4px 9px',borderRadius:4,letterSpacing:'1px'}}>PABARI</span>
        <span style={{fontSize:13,fontWeight:700,color:'white'}}>PABARI GROUP</span>
        <div style={{width:1,height:20,background:'rgba(255,255,255,0.15)',margin:'0 4px'}}/>
        <a href="/dashboard" style={{color:'rgba(255,255,255,0.6)',textDecoration:'none',fontSize:12}}>Dashboard</a>
        <a href="/tasks"     style={{color:'rgba(255,255,255,0.6)',textDecoration:'none',fontSize:12}}>Task Board</a>
        <a href="/reports"   style={{color:'white',textDecoration:'none',fontSize:12,fontWeight:600,borderBottom:'2px solid #b5833a',paddingBottom:2}}>Reports</a>
        <div style={{flex:1}}/>
        <span style={{color:'rgba(255,255,255,0.7)',fontSize:12}}>{currentUser.name}</span>
      </div>

      <div style={{flex:1,overflow:'auto',padding:24}}>

        {/* GENERATE PANEL */}
        <div style={{background:'white',borderRadius:8,border:'1px solid #e5e7eb',padding:24,marginBottom:24,maxWidth:900}}>
          <div style={{fontWeight:700,fontSize:16,color:'#111',marginBottom:4}}>Generate New Report</div>
          <div style={{fontSize:12,color:'#6b7280',marginBottom:20}}>Select filters then click Generate. The PDF opens immediately and the report is saved to history below.</div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:14,marginBottom:14}}>
            <div>
              <label style={{display:'block',fontSize:11,fontWeight:600,color:'#374151',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.5px'}}>Company</label>
              <select value={filters.company} onChange={e=>setF('company',e.target.value)} style={sel}>
                <option value="">All Companies</option>
                {COMPANIES.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{display:'block',fontSize:11,fontWeight:600,color:'#374151',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.5px'}}>Section</label>
              <select value={filters.section} onChange={e=>setF('section',e.target.value)} style={sel}>
                <option value="">All Sections</option>
                {SECTIONS.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{display:'block',fontSize:11,fontWeight:600,color:'#374151',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.5px'}}>Status</label>
              <select value={filters.status} onChange={e=>setF('status',e.target.value)} style={sel}>
                <option value="">All Statuses</option>
                {Object.entries(STATUS_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label style={{display:'block',fontSize:11,fontWeight:600,color:'#374151',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.5px'}}>Priority</label>
              <select value={filters.priority} onChange={e=>setF('priority',e.target.value)} style={sel}>
                <option value="">All Priorities</option>
                {(Object.entries(PRIORITY_LABELS) as [TaskPriority, string][]).map(([k,v])=>(
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:14,marginBottom:20}}>
            <div>
              <label style={{display:'block',fontSize:11,fontWeight:600,color:'#374151',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.5px'}}>Person</label>
              <select value={filters.person} onChange={e=>setF('person',e.target.value)} style={sel}>
                <option value="">All People</option>
                {PEOPLE.map(p=><option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label style={{display:'block',fontSize:11,fontWeight:600,color:'#374151',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.5px'}}>Date From</label>
              <input type="date" value={filters.dateFrom} onChange={e=>setF('dateFrom',e.target.value)} style={{...sel,fontFamily:'inherit'}}/>
            </div>
            <div>
              <label style={{display:'block',fontSize:11,fontWeight:600,color:'#374151',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.5px'}}>Date To</label>
              <input type="date" value={filters.dateTo} onChange={e=>setF('dateTo',e.target.value)} style={{...sel,fontFamily:'inherit'}}/>
            </div>
            <div style={{display:'flex',alignItems:'flex-end'}}>
              <button onClick={()=>setFilters({company:'',section:'',status:'',priority:'',person:'',dateFrom:'',dateTo:''})}
                style={{border:'1px solid #d1d5db',background:'white',borderRadius:4,padding:'7px 14px',fontSize:12,cursor:'pointer',color:'#6b7280',width:'100%'}}>
                Clear Filters
              </button>
            </div>
          </div>

          {error && <div style={{color:'#dc2626',fontSize:12,marginBottom:12}}>{error}</div>}

          <button onClick={handleGenerate} disabled={generating}
            style={{background:'#1a3a2a',color:'white',border:'none',borderRadius:5,
              padding:'9px 22px',fontSize:13,fontWeight:600,cursor:'pointer',opacity:generating?0.7:1}}>
            {generating ? 'Generating…' : '⬇ Generate & Download PDF'}
          </button>
        </div>

        {/* REPORTS HISTORY */}
        <div style={{background:'white',borderRadius:8,border:'1px solid #e5e7eb',overflow:'hidden'}}>
          <div style={{padding:'14px 20px',borderBottom:'1px solid #e5e7eb',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div>
              <div style={{fontWeight:700,fontSize:15,color:'#111'}}>Report History</div>
              <div style={{fontSize:12,color:'#6b7280'}}>{reports.length} report{reports.length!==1?'s':''} generated</div>
            </div>
          </div>

          {reports.length === 0 ? (
            <div style={{padding:48,textAlign:'center',color:'#9ca3af',fontSize:13}}>
              No reports generated yet. Use the form above to create your first report.
            </div>
          ) : (
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr style={{background:'#f9fafb'}}>
                  {['Report Name','Generated By','Date','Tasks','Filters','Actions'].map(h=>(
                    <th key={h} style={{padding:'9px 16px',textAlign:'left',fontSize:10,fontWeight:700,color:'#9ca3af',letterSpacing:'0.5px',textTransform:'uppercase',borderBottom:'1px solid #e5e7eb'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reports.map((r,i)=>(
                  <tr key={r.id} style={{borderBottom:'1px solid #f3f4f6',background:i%2===0?'white':'#fafafa'}}>
                    <td style={{padding:'11px 16px',fontWeight:600,color:'#111',fontSize:13}}>{r.name}</td>
                    <td style={{padding:'11px 16px',fontSize:12,color:'#4b5563'}}>{r.generated_by}</td>
                    <td style={{padding:'11px 16px',fontSize:12,color:'#6b7280',whiteSpace:'nowrap'}}>{fmtDate(r.created_at)}</td>
                    <td style={{padding:'11px 16px',fontSize:12,color:'#374151',fontWeight:600}}>{r.task_count}</td>
                    <td style={{padding:'11px 16px',fontSize:11,color:'#6b7280'}}>
                      {[
                        r.filters.company  && <span key="co"  style={{background:'#eff6ff',color:'#1d4ed8',padding:'2px 7px',borderRadius:10,fontSize:10,fontWeight:600,marginRight:4}}>{r.filters.company}</span>,
                        r.filters.section  && <span key="sec" style={{background:'#f0fdf4',color:'#166534',padding:'2px 7px',borderRadius:10,fontSize:10,fontWeight:600,marginRight:4}}>{r.filters.section.split(' - ').pop()}</span>,
                        r.filters.status   && <span key="st"  style={{background:'#fef9ee',color:'#92400e',padding:'2px 7px',borderRadius:10,fontSize:10,fontWeight:600,marginRight:4}}>{STATUS_LABELS[r.filters.status as TaskStatus]||r.filters.status}</span>,
                        r.filters.priority && <span key="pr"  style={{background:PRIORITY_STYLE[r.filters.priority as TaskPriority]?.bg||'#f9fafb',color:PRIORITY_STYLE[r.filters.priority as TaskPriority]?.color||'#374151',padding:'2px 7px',borderRadius:10,fontSize:10,fontWeight:600,marginRight:4}}>{PRIORITY_LABELS[r.filters.priority as TaskPriority]||r.filters.priority} Priority</span>,
                        r.filters.person   && <span key="pe"  style={{background:'#fdf2f8',color:'#7e22ce',padding:'2px 7px',borderRadius:10,fontSize:10,fontWeight:600,marginRight:4}}>{r.filters.person}</span>,
                        (r.filters.dateFrom||r.filters.dateTo) && <span key="dt" style={{background:'#f3f4f6',color:'#374151',padding:'2px 7px',borderRadius:10,fontSize:10,fontWeight:600,marginRight:4}}>{r.filters.dateFrom||'…'} → {r.filters.dateTo||'…'}</span>,
                        !r.filters.company && !r.filters.section && !r.filters.status && !r.filters.priority && !r.filters.person && !r.filters.dateFrom && !r.filters.dateTo && <span key="all" style={{color:'#9ca3af',fontSize:11}}>All tasks</span>,
                      ]}
                    </td>
                    <td style={{padding:'11px 16px'}}>
                      <div style={{display:'flex',gap:6}}>
                        <button onClick={()=>handleRedownload(r)}
                          style={{background:'#1a3a2a',color:'white',border:'none',borderRadius:4,padding:'4px 11px',fontSize:11,fontWeight:600,cursor:'pointer'}}>
                          ⬇ PDF
                        </button>
                        <button onClick={()=>handleDelete(r.id)}
                          style={{background:'white',color:'#dc2626',border:'1px solid #fee2e2',borderRadius:4,padding:'4px 10px',fontSize:11,cursor:'pointer'}}>
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* STATUS BAR */}
      <div style={{background:'#1a3a2a',color:'rgba(255,255,255,0.55)',fontSize:10.5,padding:'5px 20px',display:'flex',gap:14,alignItems:'center',flexShrink:0}}>
        <span style={{color:'rgba(255,255,255,0.85)',fontWeight:600}}>PABARI GROUP</span>
        <span>·</span>
        <span>Reports Module</span>
        <span>·</span>
        <span>{currentUser.name} ({currentUser.role})</span>
        <span>·</span>
        <span>{new Date().toISOString().slice(0,10)}</span>
      </div>
    </div>
  )
}
