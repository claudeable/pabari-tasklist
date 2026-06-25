// node scripts/reimport-tasks.js
// Full re-import from spreadsheet. Preserves status + hk_comment from live system.
const xlsx  = require('xlsx')
const fs    = require('fs')
const path  = require('path')

const XLS_PATH  = 'C:/Users/HomePC/Downloads/2026.04.11 Pending List - WK-15 - R1.xlsx'
const TASKS_OUT = path.join(__dirname, '..', 'data', 'tasks.json')

// ── Name normalisation ─────────────────────────────────────────────────────
function normResp(raw) {
  if (!raw) return ''
  return raw.trim()
    .replace(/\bKrishnan\b/g, 'Krishina')
    .replace(/\bKrishna\b/g,  'Krishina')
    .replace(/(?<!Eng\. )(?<!\w)Suresh\b/g, 'Eng. Suresh')  // bare Suresh → Eng. Suresh
    .replace(/Eng\.\s*Eng\./g, 'Eng.')                        // fix double Eng.
    .replace(/\byared\b/gi, 'Yared')
    .trim()
}

// ── Key for matching against existing tasks ────────────────────────────────
const normalize = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 25)

// ── Parse spreadsheet ──────────────────────────────────────────────────────
const wb   = xlsx.readFile(XLS_PATH)
const rows = []

for (const sheetName of wb.SheetNames) {
  const ws   = wb.Sheets[sheetName]
  const data = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null })
  const company = sheetName.replace(/^\d+\.\s*/, '').trim()
  let section = 'General'

  for (const row of data) {
    if (!row || row.every(c => c === null)) continue
    const col0 = row[0] ? String(row[0]).trim() : ''

    // Section header row: col0 is a letter code like A(i), B, C(ii)…
    if (/^[A-F](\([ivx]+\))?$/.test(col0) && row[1] && typeof row[1] === 'string') {
      section = String(row[1]).trim()
      continue
    }

    // Data row: col1 is a small integer SNO
    if (typeof row[1] !== 'number' || row[1] < 1 || row[1] > 999) continue

    // Skip rows with no particulars
    const particulars = row[5] ? String(row[5]).trim() : ''
    if (!particulars) continue

    // Date: Excel serial → readable string
    let dateStr = ''
    if (typeof row[2] === 'number') {
      const d = xlsx.SSF.parse_date_code(row[2])
      if (d) dateStr = `${d.d}-${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.m-1]}-${String(d.y).slice(2)}`
    } else if (row[2]) {
      dateStr = String(row[2]).trim()
    }

    rows.push({
      company,
      section,
      sno:         row[1],
      date:        dateStr,
      category:    row[4] ? String(row[4]).trim() : '',
      particulars,
      updates:     row[6] ? String(row[6]).trim().replace(/\r\n/g, ' ').replace(/\n/g, ' ') : '',
      responsible: normResp(row[7] ? String(row[7]).trim() : ''),
      payment:     row[8] ? String(row[8]).trim() : '',
      status_wk:   row[9] ? String(row[9]).trim().replace(/\r\n/g, ' ').replace(/\n/g, ' ') : '',
      hk_comment:  row[10] ? String(row[10]).trim().replace(/\r\n/g, ' ').replace(/\n/g, ' ') : '',
    })
  }
}

// ── Load existing tasks for live-data preservation ─────────────────────────
const existing = fs.existsSync(TASKS_OUT) ? JSON.parse(fs.readFileSync(TASKS_OUT, 'utf8')) : []

function findExisting(company, particulars) {
  const key = normalize(particulars)
  return existing.find(t => t.company === company && normalize(t.particulars) === key) || null
}

// ── Build new task list ────────────────────────────────────────────────────
const now   = new Date().toISOString()
const tasks = rows.map((r, i) => {
  const live = findExisting(r.company, r.particulars)
  return {
    id:          live ? live.id : (i + 1),
    sno:         r.sno,
    date:        r.date,
    company:     r.company,
    category:    r.category,
    section:     r.section,
    particulars: r.particulars,
    updates:     r.updates,
    responsible: r.responsible,
    payment:     r.payment,
    status:      live ? live.status : 'pending-discussion',
    status_wk:   r.status_wk,
    hk_comment:  live ? live.hk_comment : r.hk_comment,
    created_at:  live ? live.created_at : now,
    updated_at:  live ? live.updated_at : now,
  }
})

// ── Re-assign sequential IDs where no existing match ──────────────────────
let nextId = Math.max(0, ...existing.map(t => Number(t.id) || 0)) + 1
tasks.forEach(t => { if (!existing.find(e => e.id === t.id)) t.id = nextId++ })

fs.writeFileSync(TASKS_OUT, JSON.stringify(tasks, null, 2))

// ── Report ─────────────────────────────────────────────────────────────────
const preserved = tasks.filter(t => existing.find(e => e.id === t.id))
const added     = tasks.filter(t => !existing.find(e => e.id === t.id))
console.log(`✓ Written ${tasks.length} tasks → data/tasks.json`)
console.log(`  ${preserved.length} preserved from live system (status/comments kept)`)
console.log(`  ${added.length} newly imported from spreadsheet`)

// Report names seen
const names = new Set()
tasks.forEach(t => { if (t.responsible) t.responsible.split(/\s*[&/]\s*/).map(n=>n.trim()).filter(Boolean).forEach(n=>names.add(n)) })
console.log('\nAll responsible parties:', Array.from(names).sort().join(', '))

// Report still-missing responsible
const noResp = tasks.filter(t => !t.responsible)
if (noResp.length) {
  console.log('\nTasks with no responsible party:')
  noResp.forEach(t => console.log(`  ${t.company} #${t.sno}: ${t.particulars}`))
}
