'use client'

import { useState, useEffect, useMemo } from 'react'
import { SessionUser } from '@/types'
import { LeaveRequest, LEAVE_TYPE_LABELS, LEAVE_STATUS_LABELS, LeaveStatus, LeaveType } from '@/lib/leaveTypes'
import { PettyCashRequest, PettyCashStatus, PETTY_CASH_STATUS_LABELS } from '@/lib/pettyCashTypes'

interface Props {
  currentUser:   SessionUser
  leaveReqs:     LeaveRequest[]
  pcrReqs:       PettyCashRequest[]
  canSeeLeaveFull: boolean
  canSeePCRFull:   boolean
}

type ReportTab = 'leave' | 'pcr'

function fmtDate(d: string) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })
}
function fmtAmt(n: number) {
  return 'KSH ' + n.toLocaleString('en-KE', { minimumFractionDigits:2, maximumFractionDigits:2 })
}

// ── CSV helpers ──────────────────────────────────────────────────────────────
function esc(v: unknown): string {
  const s = String(v ?? '')
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g,'""')}"` : s
}
function downloadCSV(rows: string[][], filename: string) {
  const csv = rows.map(r => r.map(esc).join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ── Excel export (HTML table format — opens natively in Excel) ───────────────
function downloadExcel(rows: string[][], filename: string) {
  const safe = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body><table>${
    rows.map((r, i) => `<tr>${r.map(c => i === 0 ? `<th style="background:#1a3a2a;color:white;font-weight:bold">${safe(String(c))}</th>` : `<td>${safe(String(c))}</td>`).join('')}</tr>`).join('')
  }</table></body></html>`
  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ── PDF export (print-ready popup) ──────────────────────────────────────────
function printPDF(title: string, rows: string[][]) {
  const safe = (s: string) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  const [header, ...data] = rows
  const w = window.open('', '_blank', 'width=900,height=700')
  if (!w) { alert('Please allow popups for PDF export.'); return }
  w.document.write(`<!DOCTYPE html><html><head><title>${safe(title)}</title><style>
    *{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:20px;font-size:11px;color:#222}
    h2{color:#1a3a2a;margin:0 0 4px}p{margin:0 0 12px;color:#666;font-size:10px}
    table{width:100%;border-collapse:collapse;margin-top:8px}
    th{background:#1a3a2a;color:white;padding:6px 8px;text-align:left;font-size:10px;font-weight:700}
    td{padding:5px 8px;border-bottom:1px solid #e5e7eb;font-size:10.5px}
    tr:nth-child(even) td{background:#f9fafb}
    .print-btn{margin-bottom:12px;padding:7px 16px;background:#1a3a2a;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px}
    @media print{.print-btn{display:none}body{margin:10px}}
  </style></head><body>
  <h2>${safe(title)}</h2>
  <p>Generated: ${new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</p>
  <button class="print-btn" onclick="window.print()">🖨 Print / Save as PDF</button>
  <table><thead><tr>${(header||[]).map(h=>`<th>${safe(h)}</th>`).join('')}</tr></thead>
  <tbody>${data.map(r=>`<tr>${r.map(c=>`<td>${safe(c)}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></body></html>`)
  w.document.close()
}

function buildLeaveCSV(rows: LeaveRequest[]): string[][] {
  const header = [
    'Submitted','Employee Name','Employee No.','Department','Company',
    'Leave Type','From','To','Days Requested','Reason','Cover Person',
    'Status','HR Notes','HK Notes','Rejection Reason',
  ]
  const data = rows.map(r => [
    fmtDate(r.submitted_at), r.employee_name, r.employee_no, r.department, r.company,
    LEAVE_TYPE_LABELS[r.leave_type] ?? r.leave_type,
    fmtDate(r.date_from), fmtDate(r.date_to), String(r.days_requested),
    r.reason, r.cover_person, LEAVE_STATUS_LABELS[r.status] ?? r.status,
    r.hr_notes, r.hk_notes, r.rejection_reason,
  ])
  return [header, ...data]
}

function buildPCRCSV(rows: PettyCashRequest[]): string[][] {
  const header = [
    'Request No.','Submitted','Employee','Department','Company',
    'Form Type','Payment Method','Item Description','Total Amount (KSH)','Status',
  ]
  const data = rows.map(r => {
    const itemDesc = r.items.map(i => `${i.description} (${i.account_no}) KSH${i.amount}`).join(' | ')
    return [
      r.req_no, fmtDate(r.submitted_at), r.employee_name, r.department, r.company,
      r.form_type === 'kiscol' ? 'KISCOL' : 'General',
      r.payment_method,
      itemDesc,
      r.total_amount.toFixed(2),
      PETTY_CASH_STATUS_LABELS[r.status] ?? r.status,
    ]
  })
  return [header, ...data]
}

// ── Per-record PDF popups ────────────────────────────────────────────────────
function printLeaveRecord(r: LeaveRequest) {
  const safe = (s: unknown) => String(s ?? '—').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  const statusBg:    Record<LeaveStatus,string> = { pending_supervisor:'#e0f2fe', pending_hod:'#fef9c3', pending_hr:'#fef3c7', pending_hk:'#ede9fe', pending_director:'#ede9fe', approved:'#d1fae5', rejected:'#fee2e2' }
  const statusColor: Record<LeaveStatus,string> = { pending_supervisor:'#0369a1', pending_hod:'#854d0e', pending_hr:'#92400e', pending_hk:'#5b21b6', pending_director:'#5b21b6', approved:'#065f46', rejected:'#991b1b' }
  const w = window.open('', '_blank', 'width=900,height=720')
  if (!w) { alert('Please allow popups for PDF export.'); return }
  w.document.write(`<!DOCTYPE html><html><head><title>Leave Application — ${safe(r.employee_name)}</title><style>
    *{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:11px;color:#111;padding:24px}
    .hdr{background:#1a3a2a;color:white;padding:14px 20px;display:flex;align-items:center;gap:14px;margin-bottom:20px;border-radius:4px}
    .badge{background:#b5833a;color:white;font-weight:800;font-size:11px;padding:3px 10px;border-radius:3px;letter-spacing:1px}
    .sec-title{font-size:9px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.8px;border-bottom:1px solid #e5e7eb;padding-bottom:4px;margin:16px 0 10px}
    .grid{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin-bottom:4px}
    .fl{font-size:8px;color:#9ca3af;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px}
    .fv{font-size:11px;color:#111;font-weight:500;padding:4px 0;border-bottom:1px solid #e5e7eb}
    .reason{background:#f9fafb;border:1px solid #e5e7eb;padding:8px 10px;border-radius:3px;font-size:11px;min-height:36px}
    .status{display:inline-block;padding:3px 10px;border-radius:10px;font-size:9px;font-weight:700;text-transform:uppercase}
    .arow{display:flex;align-items:flex-start;padding:8px 10px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:4px;margin-bottom:8px;gap:12px}
    .sigs{display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;margin-top:24px}
    .sig{border-top:1px solid #374151;padding-top:4px;text-align:center;font-size:9px;color:#6b7280;padding-bottom:28px}
    .pbtn{margin-bottom:16px;padding:7px 18px;background:#1a3a2a;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px}
    @media print{.pbtn{display:none}body{padding:12px}}
  </style></head><body>
  <div class="hdr">
    <span class="badge">PABARI</span>
    <div><div style="font-size:14px;font-weight:700">LEAVE APPLICATION FORM</div><div style="font-size:10px;opacity:.7;margin-top:2px">Pabari Group — Human Resources</div></div>
    <div style="margin-left:auto;text-align:right;font-size:10px;opacity:.9">
      <div>Submitted: ${safe(fmtDate(r.submitted_at))}</div>
      <span class="status" style="background:${statusBg[r.status]};color:${statusColor[r.status]};margin-top:4px;display:inline-block">${safe(LEAVE_STATUS_LABELS[r.status])}</span>
    </div>
  </div>
  <button class="pbtn" onclick="window.print()">🖨 Print / Save as PDF</button>
  <div class="sec-title">Employee Details</div>
  <div class="grid">
    <div><div class="fl">Full Name</div><div class="fv">${safe(r.employee_name)}</div></div>
    <div><div class="fl">Employee No.</div><div class="fv">${safe(r.employee_no)}</div></div>
    <div><div class="fl">Department</div><div class="fv">${safe(r.department)}</div></div>
    <div><div class="fl">Job Title</div><div class="fv">${safe(r.job_title)}</div></div>
    <div><div class="fl">Company</div><div class="fv">${safe(r.company)}</div></div>
    <div><div class="fl">Telephone</div><div class="fv">${safe(r.telephone)}</div></div>
    <div><div class="fl">Date of Employment</div><div class="fv">${r.date_of_employment ? safe(fmtDate(r.date_of_employment)) : '—'}</div></div>
  </div>
  <div class="sec-title">Leave Details</div>
  <div class="grid">
    <div><div class="fl">Leave Type</div><div class="fv">${safe(LEAVE_TYPE_LABELS[r.leave_type])}</div></div>
    <div><div class="fl">From Date</div><div class="fv">${safe(fmtDate(r.date_from))}</div></div>
    <div><div class="fl">To Date</div><div class="fv">${safe(fmtDate(r.date_to))}</div></div>
    <div><div class="fl">Days Requested</div><div class="fv" style="font-weight:700;font-size:14px">${r.days_requested}</div></div>
    <div><div class="fl">Cover Person</div><div class="fv">${safe(r.cover_person)}</div></div>
  </div>
  <div class="sec-title">Reason for Leave</div>
  <div class="reason">${safe(r.reason) || '<em style="color:#9ca3af">No reason provided</em>'}</div>
  <div class="sec-title">Approval Status</div>
  <div class="arow">
    <div style="min-width:110px"><div class="fl">HR Review</div>
      <span class="status" style="background:${r.status==='pending_hr'?'#fef3c7':'#d1fae5'};color:${r.status==='pending_hr'?'#92400e':'#065f46'};margin-top:4px;display:inline-block">
        ${r.status==='pending_hr'?'Pending':'Reviewed'}
      </span>
    </div>
    ${r.hr_notes?`<div><div class="fl">HR Notes</div><div style="font-size:11px;color:#374151;margin-top:2px">${safe(r.hr_notes)}</div></div>`:''}
  </div>
  <div class="arow">
    <div style="min-width:110px"><div class="fl">HK Approval</div>
      <span class="status" style="background:${statusBg[r.status]};color:${statusColor[r.status]};margin-top:4px;display:inline-block">
        ${r.status==='approved'?'Approved':r.status==='rejected'?'Rejected':'Pending'}
      </span>
    </div>
    ${r.hk_notes?`<div><div class="fl">HK Notes</div><div style="font-size:11px;color:#374151;margin-top:2px">${safe(r.hk_notes)}</div></div>`:''}
    ${r.rejection_reason?`<div><div class="fl" style="color:#dc2626">Rejection Reason</div><div style="font-size:11px;color:#dc2626;margin-top:2px">${safe(r.rejection_reason)}</div></div>`:''}
  </div>
  <div class="sigs">
    <div class="sig">Employee Signature &amp; Date</div>
    <div class="sig">HR Manager Signature &amp; Date</div>
    <div class="sig">Director Signature &amp; Date</div>
  </div>
  </body></html>`)
  w.document.close()
}

function printPCRRecord(r: PettyCashRequest) {
  const safe = (s: unknown) => String(s ?? '—').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  const statusBg:    Record<PettyCashStatus,string> = { pending_hos:'#fef3c7', pending_hod:'#ede9fe', pending_finance:'#dbeafe', approved:'#fef9c3', disbursed:'#d1fae5', received:'#bbf7d0', rejected:'#fee2e2' }
  const statusColor: Record<PettyCashStatus,string> = { pending_hos:'#92400e', pending_hod:'#5b21b6', pending_finance:'#1e40af', approved:'#854d0e', disbursed:'#065f46', received:'#14532d', rejected:'#991b1b' }
  const w = window.open('', '_blank', 'width=900,height=720')
  if (!w) { alert('Please allow popups for PDF export.'); return }
  const itemRows = r.items.map(i => `<tr><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${safe(i.description)}</td><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:center">${safe(i.account_no)}</td><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600">${i.amount.toLocaleString('en-KE',{minimumFractionDigits:2})}</td></tr>`).join('')
  w.document.write(`<!DOCTYPE html><html><head><title>Petty Cash — ${safe(r.req_no)}</title><style>
    *{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:11px;color:#111;padding:24px}
    .hdr{background:#1a3a2a;color:white;padding:14px 20px;display:flex;align-items:center;gap:14px;margin-bottom:20px;border-radius:4px}
    .badge{background:#b5833a;color:white;font-weight:800;font-size:11px;padding:3px 10px;border-radius:3px;letter-spacing:1px}
    .sec-title{font-size:9px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.8px;border-bottom:1px solid #e5e7eb;padding-bottom:4px;margin:16px 0 10px}
    .grid{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin-bottom:4px}
    .fl{font-size:8px;color:#9ca3af;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px}
    .fv{font-size:11px;color:#111;font-weight:500;padding:4px 0;border-bottom:1px solid #e5e7eb}
    table.items{width:100%;border-collapse:collapse;font-size:11px}
    table.items thead th{background:#1a3a2a;color:white;padding:7px 10px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase}
    table.items thead th:last-child{text-align:right}
    .tot td{padding:8px 10px;font-weight:700;background:#f0fdf4;font-size:12px;border-top:2px solid #1a3a2a}
    .status{display:inline-block;padding:3px 10px;border-radius:10px;font-size:9px;font-weight:700;text-transform:uppercase}
    .agrid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
    .abox{border:1px solid #e5e7eb;border-radius:4px;padding:10px 12px}
    .sigs{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:20px;margin-top:24px}
    .sig{border-top:1px solid #374151;padding-top:4px;text-align:center;font-size:9px;color:#6b7280;padding-bottom:28px}
    .pbtn{margin-bottom:16px;padding:7px 18px;background:#1a3a2a;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px}
    @media print{.pbtn{display:none}body{padding:12px}}
  </style></head><body>
  <div class="hdr">
    <span class="badge">PABARI</span>
    <div><div style="font-size:14px;font-weight:700">PETTY CASH REQUEST${r.form_type==='kiscol'?' — KISCOL':''}</div><div style="font-size:10px;opacity:.7;margin-top:2px">Pabari Group · Finance Department</div></div>
    <div style="margin-left:auto;text-align:right;font-size:10px;opacity:.9">
      <div style="font-weight:700;font-size:13px">${safe(r.req_no)}</div>
      <div style="margin-top:2px">${safe(fmtDate(r.request_date || r.submitted_at))}</div>
      <span class="status" style="background:${statusBg[r.status]};color:${statusColor[r.status]};margin-top:4px;display:inline-block">${safe(PETTY_CASH_STATUS_LABELS[r.status])}</span>
    </div>
  </div>
  <button class="pbtn" onclick="window.print()">🖨 Print / Save as PDF</button>
  <div class="sec-title">Request Details</div>
  <div class="grid">
    <div><div class="fl">Company</div><div class="fv">${safe(r.company)}</div></div>
    <div><div class="fl">Payment Method</div><div class="fv">${r.payment_method==='bank_transfer'?'Bank Transfer':r.payment_method==='mpesa'?'M-Pesa':'Cash'}</div></div>
    <div><div class="fl">Voucher No.</div><div class="fv">${safe(r.voucher_no)||'—'}</div></div>
    <div><div class="fl">Request Date</div><div class="fv">${safe(fmtDate(r.request_date||r.submitted_at))}</div></div>
  </div>
  <div class="sec-title">Requestor</div>
  <div class="grid">
    <div><div class="fl">Employee Name</div><div class="fv">${safe(r.employee_name)}</div></div>
    <div><div class="fl">ID No.</div><div class="fv">${safe(r.employee_id_no)}</div></div>
    <div><div class="fl">Department</div><div class="fv">${safe(r.department)}</div></div>
    <div><div class="fl">HOD</div><div class="fv">${safe(r.hod_name)}</div></div>
    ${r.delegate_name?`<div><div class="fl">Delegate</div><div class="fv">${safe(r.delegate_name)}</div></div><div><div class="fl">Delegate ID No.</div><div class="fv">${safe(r.delegate_id_no)}</div></div>`:''}
  </div>
  <div class="sec-title">Items Requested</div>
  <table class="items">
    <thead><tr><th>Description</th><th style="text-align:center">Account No.</th><th style="text-align:right">Amount (KSH)</th></tr></thead>
    <tbody>
      ${itemRows}
      <tr class="tot"><td colspan="2" style="text-align:right">TOTAL</td><td style="text-align:right">${r.total_amount.toLocaleString('en-KE',{minimumFractionDigits:2})}</td></tr>
    </tbody>
  </table>
  ${r.amount_in_words?`<div style="margin-top:8px;font-size:10px;color:#6b7280"><em>Amount in words: ${safe(r.amount_in_words)}</em></div>`:''}
  <div class="sec-title">Approval Status</div>
  <div class="agrid">
    <div class="abox"><div class="fl">HOS (Krishna)</div><span class="status" style="margin-top:6px;background:${r.hos_approved_at?'#d1fae5':'#f3f4f6'};color:${r.hos_approved_at?'#065f46':'#6b7280'};display:inline-block">${r.hos_approved_at?'Approved · '+fmtDate(r.hos_approved_at):'Pending'}</span></div>
    <div class="abox"><div class="fl">HOD</div><span class="status" style="margin-top:6px;background:${r.hod_approved_at?'#d1fae5':'#f3f4f6'};color:${r.hod_approved_at?'#065f46':'#6b7280'};display:inline-block">${r.hod_approved_at?'Approved · '+fmtDate(r.hod_approved_at):'Pending'}</span></div>
    <div class="abox"><div class="fl">Finance (Andu)</div><span class="status" style="margin-top:6px;background:${r.finance_approved_at?'#d1fae5':'#f3f4f6'};color:${r.finance_approved_at?'#065f46':'#6b7280'};display:inline-block">${r.finance_approved_at?'Approved · '+fmtDate(r.finance_approved_at):'Pending'}</span></div>
  </div>
  ${r.rejection_reason?`<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:4px;padding:8px 12px;margin-top:8px;font-size:11px;color:#dc2626"><strong>Rejection Reason:</strong> ${safe(r.rejection_reason)}</div>`:''}
  <div class="sigs">
    <div class="sig">Requestor Signature &amp; Date</div>
    <div class="sig">HOS Signature &amp; Date</div>
    <div class="sig">HOD Signature &amp; Date</div>
    <div class="sig">Finance Signature &amp; Date</div>
  </div>
  </body></html>`)
  w.document.close()
}

// ── Main component ───────────────────────────────────────────────────────────
export default function FormsReports({ currentUser, leaveReqs, pcrReqs, canSeeLeaveFull, canSeePCRFull }: Props) {
  const [isMobile,       setIsMobile]       = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [tab,            setTab]            = useState<ReportTab>(canSeeLeaveFull ? 'leave' : 'pcr')
  const [localLeave,     setLocalLeave]     = useState<LeaveRequest[]>(leaveReqs)
  const [localPCR,       setLocalPCR]       = useState<PettyCashRequest[]>(pcrReqs)
  const isAdmin = currentUser.role === 'admin'

  // Filters
  const [dateFrom,    setDateFrom]    = useState('')
  const [dateTo,      setDateTo]      = useState('')
  const [filterStatus,setFilterStatus]= useState('')
  const [filterCo,    setFilterCo]    = useState('')
  const [filterType,  setFilterType]  = useState('')   // leave type only

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  function signOut() {
    fetch('/api/auth/logout', { method:'POST' }).then(() => { window.location.href = '/login' })
  }

  // ── Filtered datasets ────────────────────────────────────────────────────
  const filteredLeave = useMemo(() => localLeave.filter(r => {
    if (dateFrom && r.submitted_at.slice(0,10) < dateFrom) return false
    if (dateTo   && r.submitted_at.slice(0,10) > dateTo)   return false
    if (filterStatus && r.status !== filterStatus) return false
    if (filterCo     && r.company !== filterCo)    return false
    if (filterType   && r.leave_type !== filterType) return false
    return true
  }), [localLeave, dateFrom, dateTo, filterStatus, filterCo, filterType])

  const filteredPCR = useMemo(() => localPCR.filter(r => {
    const sub = r.submitted_at.slice(0,10)
    if (dateFrom && sub < dateFrom)               return false
    if (dateTo   && sub > dateTo)                 return false
    if (filterStatus && r.status !== filterStatus) return false
    if (filterCo     && r.company !== filterCo)    return false
    return true
  }), [localPCR, dateFrom, dateTo, filterStatus, filterCo])

  // ── Delete handlers (admin only) ─────────────────────────────────────────
  async function handleDeleteLeave(id: number) {
    if (!confirm('Permanently delete this leave request? This cannot be undone.')) return
    const res = await fetch(`/api/forms/leave/${id}`, { method: 'DELETE', credentials: 'include' })
    if (res.ok) setLocalLeave(prev => prev.filter(r => r.id !== id))
    else alert('Delete failed. You may not have permission.')
  }
  async function handleDeletePCR(id: number) {
    if (!confirm('Permanently delete this petty cash request? This cannot be undone.')) return
    const res = await fetch(`/api/forms/petty-cash/${id}`, { method: 'DELETE', credentials: 'include' })
    if (res.ok) setLocalPCR(prev => prev.filter(r => r.id !== id))
    else alert('Delete failed. You may not have permission.')
  }

  // Summary stats
  const leaveTotalDays = filteredLeave.reduce((s,r) => s + r.days_requested, 0)
  const pcrTotalAmt    = filteredPCR.reduce((s,r) => s + r.total_amount, 0)

  // Unique company lists for filters
  const leaveCompanies = useMemo(() => Array.from(new Set(leaveReqs.map(r=>r.company))).sort(), [leaveReqs])
  const pcrCompanies   = useMemo(() => Array.from(new Set(pcrReqs.map(r=>r.company))).sort(), [pcrReqs])

  const leaveStatuses: LeaveStatus[] = ['pending_supervisor','pending_hod','pending_hr','pending_director','pending_hk','approved','rejected']
  const pcrStatuses:   PettyCashStatus[] = ['pending_hos','pending_hod','pending_finance','approved','rejected']
  const leaveTypes     = Object.keys(LEAVE_TYPE_LABELS) as LeaveType[]

  function resetFilters() {
    setDateFrom(''); setDateTo(''); setFilterStatus(''); setFilterCo(''); setFilterType('')
  }

  const pill = (active: boolean): React.CSSProperties => ({
    padding:'6px 14px', borderRadius:16, fontSize:12, fontWeight:600, cursor:'pointer', border:'none',
    background: active ? '#1a3a2a' : '#f3f4f6', color: active ? 'white' : '#374151',
  })
  const selStyle: React.CSSProperties = {
    border:'1px solid #d1d5db', borderRadius:5, padding:'6px 10px', fontSize:12, background:'white', color:'#374151',
  }

  const initials = currentUser.name.split(/[\s&./]+/).map((w:string)=>w[0]).filter(Boolean).join('').toUpperCase().slice(0,2)

  const canReports = canSeeLeaveFull || canSeePCRFull

  // ── Nav link helper ──────────────────────────────────────────────────────
  const navLink = (label: string, href: string, active = false): React.CSSProperties => ({
    color: active ? 'white' : 'rgba(255,255,255,0.65)', textDecoration:'none', fontSize:12,
    fontWeight: active ? 600 : 400, borderBottom: active ? '2px solid #b5833a' : 'none', paddingBottom: active ? 2 : 0,
  })

  return (
    <div style={{minHeight:'100vh',background:'#f3f4f6',display:'flex',flexDirection:'column'}}>

      {/* NAV */}
      <div style={{background:'#1a3a2a',padding:'0 14px',display:'flex',alignItems:'center',gap:isMobile?8:12,height:50,flexShrink:0}}>
        <span style={{background:'#b5833a',color:'white',fontWeight:800,fontSize:11,padding:'4px 9px',borderRadius:4,letterSpacing:'1px'}}>PABARI</span>
        {!isMobile && <>
          <span style={{fontSize:13,fontWeight:700,color:'white'}}>PABARI GROUP</span>
          <div style={{width:1,height:20,background:'rgba(255,255,255,0.15)',margin:'0 4px'}}/>
          <a href="/" style={navLink('← Portal','/')}>← Portal</a>
          <div style={{width:1,height:14,background:'rgba(255,255,255,0.2)',margin:'0 2px'}}/>
          <a href="/forms/leave"     style={navLink('Leave','/forms/leave')}>Leave Requests</a>
          <a href="/forms/petty-cash" style={navLink('PCR','/forms/petty-cash')}>Petty Cash</a>
          {canReports && <a href="/forms/reports" style={navLink('Reports','/forms/reports',true)}>Reports</a>}
        </>}
        <div style={{flex:1}}/>
        {!isMobile && <>
          <span style={{fontSize:12,color:'rgba(255,255,255,0.7)',fontWeight:500}}>{currentUser.name}</span>
          <button onClick={signOut} style={{background:'rgba(255,255,255,0.08)',color:'rgba(255,255,255,0.7)',border:'1px solid rgba(255,255,255,0.15)',padding:'5px 11px',borderRadius:5,fontSize:11,cursor:'pointer'}}>Sign Out</button>
        </>}
        {isMobile && <>
          <div style={{width:28,height:28,borderRadius:'50%',background:'#2d3436',color:'white',fontSize:10,fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center'}}>{initials}</div>
          <button onClick={()=>setShowMobileMenu(true)} style={{background:'none',border:'1px solid rgba(255,255,255,0.3)',color:'white',borderRadius:4,padding:'4px 9px',fontSize:17,cursor:'pointer',lineHeight:1}}>☰</button>
        </>}
      </div>

      {isMobile && showMobileMenu && (
        <div style={{position:'fixed',inset:0,zIndex:600,background:'rgba(0,0,0,0.6)'}} onClick={()=>setShowMobileMenu(false)}>
          <div style={{background:'#1a3a2a',width:'100%'}} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 16px',borderBottom:'1px solid rgba(255,255,255,0.1)'}}>
              <div style={{color:'white',fontWeight:600,fontSize:14}}>{currentUser.name}</div>
              <button onClick={()=>setShowMobileMenu(false)} style={{background:'none',border:'none',color:'rgba(255,255,255,0.7)',fontSize:22,cursor:'pointer'}}>✕</button>
            </div>
            {[
              {label:'← Portal',href:'/'},
              {label:'Leave Requests',href:'/forms/leave'},
              {label:'Petty Cash',href:'/forms/petty-cash'},
              ...(canReports ? [{label:'Reports',href:'/forms/reports'}] : []),
            ].map(item=>(
              <a key={item.href} href={item.href} style={{display:'block',padding:'13px 16px',color:'rgba(255,255,255,0.85)',textDecoration:'none',fontSize:14,fontWeight:500,borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
                {item.label}
              </a>
            ))}
            <div style={{padding:'10px 12px'}}>
              <button onClick={signOut} style={{background:'rgba(255,255,255,0.08)',color:'rgba(255,255,255,0.8)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:6,padding:'10px 14px',fontSize:13,textAlign:'left',cursor:'pointer',width:'100%'}}>Sign Out</button>
            </div>
          </div>
        </div>
      )}

      {/* CONTENT */}
      <div style={{flex:1,padding: isMobile ? '12px 10px' : '24px 20px',maxWidth:1100,margin:'0 auto',width:'100%'}}>

        <div style={{fontSize:20,fontWeight:700,color:'#1a3a2a',marginBottom:4}}>Forms Reports</div>
        <div style={{fontSize:13,color:'#6b7280',marginBottom:20}}>Download filtered reports for leave and petty cash requests.</div>

        {/* Tab bar */}
        <div style={{display:'flex',gap:8,marginBottom:20}}>
          {canSeeLeaveFull && (
            <button style={pill(tab==='leave')} onClick={()=>{ setTab('leave'); resetFilters() }}>
              Leave Requests
            </button>
          )}
          {canSeePCRFull && (
            <button style={pill(tab==='pcr')} onClick={()=>{ setTab('pcr'); resetFilters() }}>
              Petty Cash Requests
            </button>
          )}
        </div>

        {/* Filter bar */}
        <div style={{background:'white',borderRadius:8,padding:'14px 18px',marginBottom:16,boxShadow:'0 1px 4px rgba(0,0,0,0.06)',display:'flex',flexWrap:'wrap',gap:10,alignItems:'flex-end'}}>
          <div>
            <div style={{fontSize:11,fontWeight:600,color:'#6b7280',marginBottom:3}}>FROM DATE</div>
            <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={selStyle} />
          </div>
          <div>
            <div style={{fontSize:11,fontWeight:600,color:'#6b7280',marginBottom:3}}>TO DATE</div>
            <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={selStyle} />
          </div>
          <div>
            <div style={{fontSize:11,fontWeight:600,color:'#6b7280',marginBottom:3}}>STATUS</div>
            <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={selStyle}>
              <option value="">All Statuses</option>
              {(tab==='leave' ? leaveStatuses : pcrStatuses).map(s=>(
                <option key={s} value={s}>
                  {tab==='leave' ? LEAVE_STATUS_LABELS[s as LeaveStatus] : PETTY_CASH_STATUS_LABELS[s as PettyCashStatus]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div style={{fontSize:11,fontWeight:600,color:'#6b7280',marginBottom:3}}>COMPANY</div>
            <select value={filterCo} onChange={e=>setFilterCo(e.target.value)} style={selStyle}>
              <option value="">All Companies</option>
              {(tab==='leave' ? leaveCompanies : pcrCompanies).map(c=>(
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          {tab==='leave' && (
            <div>
              <div style={{fontSize:11,fontWeight:600,color:'#6b7280',marginBottom:3}}>LEAVE TYPE</div>
              <select value={filterType} onChange={e=>setFilterType(e.target.value)} style={selStyle}>
                <option value="">All Types</option>
                {leaveTypes.map(t=><option key={t} value={t}>{LEAVE_TYPE_LABELS[t]}</option>)}
              </select>
            </div>
          )}
          <button onClick={resetFilters}
            style={{background:'#f3f4f6',color:'#374151',border:'none',padding:'7px 14px',borderRadius:5,fontSize:12,cursor:'pointer',alignSelf:'flex-end'}}>
            Reset
          </button>
        </div>

        {/* Summary + Download row */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12,flexWrap:'wrap',gap:10}}>
          <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>
            {tab==='leave' ? <>
              <Stat label="Total Requests" value={String(filteredLeave.length)} />
              <Stat label="Total Days" value={String(leaveTotalDays)} />
              <Stat label="Approved" value={String(filteredLeave.filter(r=>r.status==='approved').length)} color="#15803d" />
              <Stat label="Pending" value={String(filteredLeave.filter(r=>r.status!=='approved'&&r.status!=='rejected').length)} color="#b45309" />
              <Stat label="Rejected" value={String(filteredLeave.filter(r=>r.status==='rejected').length)} color="#b91c1c" />
            </> : <>
              <Stat label="Total Requests" value={String(filteredPCR.length)} />
              <Stat label="Total Amount" value={fmtAmt(pcrTotalAmt)} />
              <Stat label="Approved" value={String(filteredPCR.filter(r=>r.status==='approved').length)} color="#15803d" />
              <Stat label="Pending" value={String(filteredPCR.filter(r=>r.status!=='approved'&&r.status!=='rejected').length)} color="#b45309" />
              <Stat label="Rejected" value={String(filteredPCR.filter(r=>r.status==='rejected').length)} color="#b91c1c" />
            </>}
          </div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {(() => {
              const now = new Date().toISOString().slice(0,10)
              const csvRows  = tab==='leave' ? buildLeaveCSV(filteredLeave)  : buildPCRCSV(filteredPCR)
              const csvName  = tab==='leave' ? `leave-report-${now}.csv`     : `petty-cash-report-${now}.csv`
              const xlsName  = tab==='leave' ? `leave-report-${now}.xls`     : `petty-cash-report-${now}.xls`
              const pdfTitle = tab==='leave' ? `Leave Requests — ${now}`     : `Petty Cash Requests — ${now}`
              const btnStyle = (bg: string): React.CSSProperties => ({
                background: bg, color:'white', border:'none', padding:'9px 16px',
                borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:6,
              })
              return <>
                <button onClick={()=>downloadCSV(csvRows, csvName)}  style={btnStyle('#1a3a2a')}>⬇ CSV</button>
                <button onClick={()=>downloadExcel(csvRows, xlsName)} style={btnStyle('#15803d')}>⬇ Excel</button>
                <button onClick={()=>printPDF(pdfTitle, csvRows)}     style={btnStyle('#b5833a')}>🖨 PDF</button>
              </>
            })()}
          </div>
        </div>

        {/* Table */}
        <div style={{background:'white',borderRadius:8,boxShadow:'0 1px 4px rgba(0,0,0,0.06)',overflowX:'auto'}}>
          {tab==='leave' ? (
            <LeaveTable rows={filteredLeave} onDelete={isAdmin ? handleDeleteLeave : undefined} onPrint={printLeaveRecord} />
          ) : (
            <PCRTable rows={filteredPCR} onDelete={isAdmin ? handleDeletePCR : undefined} onPrint={printPCRRecord} />
          )}
        </div>

      </div>
    </div>
  )
}

// ── Stat chip ────────────────────────────────────────────────────────────────
function Stat({ label, value, color='#1a3a2a' }: { label:string; value:string; color?:string }) {
  return (
    <div style={{background:'white',borderRadius:6,padding:'7px 14px',boxShadow:'0 1px 3px rgba(0,0,0,0.06)',minWidth:90}}>
      <div style={{fontSize:10,color:'#9ca3af',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.5px'}}>{label}</div>
      <div style={{fontSize:16,fontWeight:700,color}}>{value}</div>
    </div>
  )
}

// ── Leave table ──────────────────────────────────────────────────────────────
function LeaveTable({ rows, onDelete, onPrint }: { rows: LeaveRequest[]; onDelete?: (id:number)=>void; onPrint?: (r:LeaveRequest)=>void }) {
  const STATUS_STYLE: Record<LeaveStatus,{bg:string;color:string}> = {
    pending_supervisor: {bg:'#e0f2fe',color:'#0369a1'},
    pending_hod:        {bg:'#fef9c3',color:'#854d0e'},
    pending_hr:         {bg:'#fef3c7',color:'#92400e'},
    pending_director:   {bg:'#ede9fe',color:'#5b21b6'},
    pending_hk:         {bg:'#ede9fe',color:'#5b21b6'},
    approved:           {bg:'#d1fae5',color:'#065f46'},
    rejected:           {bg:'#fee2e2',color:'#991b1b'},
  }
  const th: React.CSSProperties = {
    padding:'10px 14px', fontSize:11, fontWeight:700, color:'#6b7280',
    textTransform:'uppercase', letterSpacing:'0.5px', whiteSpace:'nowrap',
    borderBottom:'1px solid #e5e7eb', background:'#f9fafb', textAlign:'left',
  }
  const td: React.CSSProperties = {
    padding:'10px 14px', fontSize:12, color:'#374151', borderBottom:'1px solid #f3f4f6', whiteSpace:'nowrap',
  }
  if (!rows.length) return <div style={{padding:32,textAlign:'center',color:'#9ca3af',fontSize:13}}>No records match the current filters.</div>
  return (
    <table style={{width:'100%',borderCollapse:'collapse'}}>
      <thead>
        <tr>
          {['Submitted','Employee','Dept','Company','Leave Type','From','To','Days','Status','',...(onDelete?['']:[]  )].map((h,i)=>(
            <th key={i} style={{...th,width:h===''?50:undefined}}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(r=>{
          const ss = STATUS_STYLE[r.status]
          return (
            <tr key={r.id} style={{background:'white'}}>
              <td style={td}>{fmtDate(r.submitted_at)}</td>
              <td style={td}><div style={{fontWeight:600}}>{r.employee_name}</div><div style={{fontSize:10,color:'#9ca3af'}}>{r.employee_no}</div></td>
              <td style={td}>{r.department}</td>
              <td style={td} title={r.company}>{r.company.length>20?r.company.slice(0,18)+'…':r.company}</td>
              <td style={td}>{LEAVE_TYPE_LABELS[r.leave_type]}</td>
              <td style={td}>{fmtDate(r.date_from)}</td>
              <td style={td}>{fmtDate(r.date_to)}</td>
              <td style={{...td,fontWeight:700,textAlign:'center'}}>{r.days_requested}</td>
              <td style={td}>
                <span style={{background:ss.bg,color:ss.color,padding:'2px 8px',borderRadius:10,fontSize:11,fontWeight:600,whiteSpace:'nowrap'}}>
                  {LEAVE_STATUS_LABELS[r.status]}
                </span>
              </td>
              <td style={{...td,width:50}}>
                <button onClick={()=>onPrint?.(r)} title="Print / Save PDF"
                  style={{background:'none',border:'1px solid #d1d5db',color:'#374151',cursor:'pointer',fontSize:11,padding:'2px 7px',borderRadius:4,lineHeight:1.4}}>
                  🖨
                </button>
              </td>
              {onDelete && <td style={td}><button onClick={()=>onDelete(r.id)} style={{background:'none',border:'none',color:'#dc2626',cursor:'pointer',fontSize:13,padding:'2px 6px',borderRadius:4}} title="Delete">✕</button></td>}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ── PCR table ────────────────────────────────────────────────────────────────
function PCRTable({ rows, onDelete, onPrint }: { rows: PettyCashRequest[]; onDelete?: (id:number)=>void; onPrint?: (r:PettyCashRequest)=>void }) {
  const STATUS_STYLE: Record<PettyCashStatus,{bg:string;color:string}> = {
    pending_hos:     {bg:'#fef3c7',color:'#92400e'},
    pending_hod:     {bg:'#ede9fe',color:'#5b21b6'},
    pending_finance: {bg:'#dbeafe',color:'#1e40af'},
    approved:        {bg:'#fef9c3',color:'#854d0e'},
    disbursed:       {bg:'#d1fae5',color:'#065f46'},
    received:        {bg:'#bbf7d0',color:'#14532d'},
    rejected:        {bg:'#fee2e2',color:'#991b1b'},
  }
  const th: React.CSSProperties = {
    padding:'10px 14px', fontSize:11, fontWeight:700, color:'#6b7280',
    textTransform:'uppercase', letterSpacing:'0.5px', whiteSpace:'nowrap',
    borderBottom:'1px solid #e5e7eb', background:'#f9fafb', textAlign:'left',
  }
  const td: React.CSSProperties = {
    padding:'10px 14px', fontSize:12, color:'#374151', borderBottom:'1px solid #f3f4f6', whiteSpace:'nowrap',
  }
  if (!rows.length) return <div style={{padding:32,textAlign:'center',color:'#9ca3af',fontSize:13}}>No records match the current filters.</div>
  return (
    <table style={{width:'100%',borderCollapse:'collapse'}}>
      <thead>
        <tr>
          {['Req No.','Submitted','Employee','Company','Type','Amount (KSH)','Status','',...(onDelete?['']:[]  )].map((h,i)=>(
            <th key={i} style={{...th,width:h===''?50:undefined}}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(r=>{
          const ss = STATUS_STYLE[r.status]
          return (
            <tr key={r.id} style={{background:'white'}}>
              <td style={{...td,fontWeight:600,fontFamily:'monospace'}}>{r.req_no || '—'}</td>
              <td style={td}>{fmtDate(r.submitted_at)}</td>
              <td style={td}><div style={{fontWeight:600}}>{r.employee_name}</div><div style={{fontSize:10,color:'#9ca3af'}}>{r.department}</div></td>
              <td style={td} title={r.company}>{r.company.length>22?r.company.slice(0,20)+'…':r.company}</td>
              <td style={td}>{r.form_type==='kiscol'?'KISCOL':'General'}</td>
              <td style={{...td,fontWeight:700,textAlign:'right'}}>{r.total_amount.toLocaleString('en-KE',{minimumFractionDigits:2})}</td>
              <td style={td}>
                <span style={{background:ss.bg,color:ss.color,padding:'2px 8px',borderRadius:10,fontSize:11,fontWeight:600,whiteSpace:'nowrap'}}>
                  {PETTY_CASH_STATUS_LABELS[r.status]}
                </span>
              </td>
              <td style={{...td,width:50}}>
                <button onClick={()=>onPrint?.(r)} title="Print / Save PDF"
                  style={{background:'none',border:'1px solid #d1d5db',color:'#374151',cursor:'pointer',fontSize:11,padding:'2px 7px',borderRadius:4,lineHeight:1.4}}>
                  🖨
                </button>
              </td>
              {onDelete && <td style={td}><button onClick={()=>onDelete(r.id)} style={{background:'none',border:'none',color:'#dc2626',cursor:'pointer',fontSize:13,padding:'2px 6px',borderRadius:4}} title="Delete">✕</button></td>}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
