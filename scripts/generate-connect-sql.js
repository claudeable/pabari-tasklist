/**
 * Generates a single SQL file for bulk-importing pabari_contacts.xlsx.
 * Run: node scripts/generate-connect-sql.js <xlsx> > import.sql
 * Then: psql "$DATABASE_URL" -f import.sql
 */
const XLSX = require('xlsx')
const path = require('path')

const filePath = process.argv[2]
if (!filePath) { console.error('Usage: node generate-connect-sql.js <xlsx>'); process.exit(1) }

const KEYWORD_MAP = [
  [/freight|logistics|cargo|warehouse|shipping|transport/i, 'Logistics'],
  [/pharma|medical|clinic|health|hospital|diabetes/i,       'Healthcare'],
  [/advocate|law|legal|notary|attorney/i,                   'Legal'],
  [/travel|safari|tour|hotel|hilton|doubletree|lodge/i,     'Travel & Hospitality'],
  [/insurance/i,                                             'Insurance'],
  [/bank|financial|capital|credit|finance|microfinance/i,   'Banking'],
  [/ministry|authority|government|revenue|pipeline|county|municipal/i, 'Government'],
  [/energy|solar|power|grid|petroleum|oil/i,                'Energy'],
  [/construction|build|contractor/i,                        'Construction'],
  [/auto|spare|vehicle|motor/i,                             'Manufacturing'],
  [/pack|printing|label/i,                                  'Packaging'],
  [/tech|software|it |digital|telecom/i,                   'Technology'],
  [/agri|farm|crop|seed|harvest/i,                          'Agriculture'],
  [/beverage|drinks|brewery|distill/i,                      'Beverage'],
  [/manufactur|factory|industrial/i,                        'Manufacturing'],
]

function guessCategory(institute, designation, rawCategory) {
  if (rawCategory === 'Banking')    return 'Banking'
  if (rawCategory === 'Government') return 'Government'
  const haystack = `${institute} ${designation}`
  for (const [pat, cat] of KEYWORD_MAP) { if (pat.test(haystack)) return cat }
  return 'Other'
}

function esc(v) {
  if (v == null || v === '') return 'NULL'
  return `'${String(v).replace(/'/g, "''")}'`
}

const wb = XLSX.readFile(filePath)
const sheet = wb.Sheets['All Contacts']
if (!sheet) { console.error('Sheet "All Contacts" not found'); process.exit(1) }

const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' }).map(r => ({
  name:          String(r['Name'] || '').trim(),
  institute:     String(r['Company / Institute'] || '').trim(),
  designation:   String(r['Designation'] || '').trim(),
  phone:         String(r['Phone'] || '').trim(),
  email:         String(r['Email'] || '').trim(),
  country:       String(r['Country'] || '').trim(),
  address:       String(r['Address'] || '').trim(),
  category:      String(r['Category'] || '').trim(),
  source:        String(r['Source'] || '').trim(),
  dupGroup:      String(r['Duplicate Group'] || '').trim(),
})).filter(r => r.name)

// Collect unique companies and categories
const companies = new Map()  // lower(name) -> { name, country }
const categories = new Set()

for (const r of rows) {
  if (r.institute) {
    const k = r.institute.toLowerCase()
    if (!companies.has(k)) companies.set(k, { name: r.institute, country: r.country || null })
  }
  categories.add(guessCategory(r.institute, r.designation, r.category))
}

const lines = []
lines.push('BEGIN;')
lines.push('')
lines.push('-- Categories')
for (const cat of [...categories].sort()) {
  lines.push(`INSERT INTO connect_categories (name) VALUES (${esc(cat)}) ON CONFLICT (name) DO NOTHING;`)
}
lines.push('')
lines.push('-- Companies (temp table to hold generated IDs)')
lines.push(`CREATE TEMP TABLE _co (lower_name TEXT PRIMARY KEY, id INTEGER);`)
for (const [lower, { name, country }] of companies) {
  lines.push(`INSERT INTO connect_companies (name, country) VALUES (${esc(name)}, ${esc(country)}) ON CONFLICT (LOWER(name)) DO UPDATE SET updated_at = now() RETURNING id;`)
}
// Use a DO block to populate temp table
lines.push('')
lines.push('-- Populate temp company lookup')
lines.push(`DO $$ BEGIN`)
lines.push(`  INSERT INTO _co (lower_name, id)`)
lines.push(`  SELECT LOWER(name), id FROM connect_companies;`)
lines.push(`END $$;`)

lines.push('')
lines.push('-- Contacts + category links')
lines.push(`DO $$ DECLARE _cid INT; _cat_id INT; _co_id INT; BEGIN`)
for (const r of rows) {
  const source = (r.source === 'Photo scan' || r.source === 'Photo scan (verified)') ? 'ocr-scan' : 'imported-xlsx'
  const catName = guessCategory(r.institute, r.designation, r.category)
  const coLower = r.institute ? r.institute.toLowerCase() : null

  lines.push(`  -- ${r.name.replace(/'/g, "\\'")}`)
  if (coLower) {
    lines.push(`  SELECT id INTO _co_id FROM _co WHERE lower_name = ${esc(coLower)};`)
  } else {
    lines.push(`  _co_id := NULL;`)
  }
  lines.push(`  INSERT INTO connect_contacts (company_id,full_name,position,phone,email,country,address,source,duplicate_group)`)
  lines.push(`  VALUES (_co_id,${esc(r.name)},${esc(r.designation||null)},${esc(r.phone||null)},${esc(r.email||null)},${esc(r.country||null)},${esc(r.address||null)},${esc(source)},${esc(r.dupGroup||null)})`)
  lines.push(`  RETURNING id INTO _cid;`)
  lines.push(`  SELECT id INTO _cat_id FROM connect_categories WHERE name=${esc(catName)};`)
  lines.push(`  INSERT INTO connect_contact_categories (contact_id,category_id) VALUES (_cid,_cat_id) ON CONFLICT DO NOTHING;`)
  if (coLower) {
    lines.push(`  INSERT INTO connect_company_categories (company_id,category_id) VALUES (_co_id,_cat_id) ON CONFLICT DO NOTHING;`)
  }
}
lines.push(`END $$;`)
lines.push('')
lines.push('COMMIT;')
lines.push('')
lines.push(`SELECT COUNT(*) AS total_contacts FROM connect_contacts;`)

process.stdout.write(lines.join('\n') + '\n')
process.stderr.write(`Generated SQL for ${rows.length} contacts from ${companies.size} companies.\n`)
