/**
 * Pabari Connect — legacy contact import
 *
 * Reads pabari_contacts.xlsx (the "All Contacts" sheet — 1,430 rows, already verified)
 * and loads it into the new connect_companies / connect_contacts tables, grouping by
 * company name so each company appears once with all of its contacts attached.
 *
 * Usage:
 *   npm install pg xlsx
 *   DATABASE_URL=postgres://... node scripts/import-legacy-contacts.js path/to/pabari_contacts.xlsx
 *
 * Safe to re-run: company lookup is case-insensitive on name (unique index in the
 * migration), contacts are matched on (full_name, company_id) before inserting so
 * running this twice won't duplicate rows.
 */

const path = require('path');
const XLSX = require('xlsx');
const { Pool } = require('pg');

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node import-legacy-contacts.js <path-to-pabari_contacts.xlsx>');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Maps the current 3-bucket category (Banking / Government / General) onto the
// fuller Connect taxonomy. "General" contacts get a best-guess keyword pass;
// anything that doesn't match a keyword falls back to "Other" and is left for
// manual re-categorization later (same pattern as the review-flag workflow).
const KEYWORD_CATEGORY_MAP = [
  [/freight|logistics|cargo|warehouse|shipping/i, 'Logistics'],
  [/pharma|medical|clinic|health|hospital|diabetes/i, 'Healthcare'],
  [/advocate|law|legal|notary/i, 'Legal'],
  [/travel|safari|tour|hotel|hilton|doubletree/i, 'Travel & Hospitality'],
  [/insurance/i, 'Insurance'],
  [/auction/i, 'Legal'],
  [/bank|financial|capital|credit/i, 'Banking'],
  [/ministry|authority|government|revenue|pipeline|county/i, 'Government'],
  [/energy|solar|power|grid/i, 'Energy'],
  [/construction|build/i, 'Construction'],
  [/auto|spare|vehicle/i, 'Manufacturing'],
];

function guessCategory(row) {
  if (row.category === 'Banking') return 'Banking';
  if (row.category === 'Government') return 'Government';
  const haystack = `${row.institute} ${row.designation}`;
  for (const [pattern, category] of KEYWORD_CATEGORY_MAP) {
    if (pattern.test(haystack)) return category;
  }
  return 'Other';
}

async function getOrCreateCategory(client, name) {
  const { rows } = await client.query(
    `INSERT INTO connect_categories (name) VALUES ($1)
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [name]
  );
  return rows[0].id;
}

async function getOrCreateCompany(client, name, country) {
  if (!name) return null;
  const { rows } = await client.query(
    `INSERT INTO connect_companies (name, country)
     VALUES ($1, $2)
     ON CONFLICT (LOWER(name)) DO UPDATE SET updated_at = now()
     RETURNING id`,
    [name, country || null]
  );
  return rows[0].id;
}

async function contactExists(client, fullName, companyId) {
  const { rows } = await client.query(
    `SELECT id FROM connect_contacts WHERE full_name = $1 AND company_id IS NOT DISTINCT FROM $2`,
    [fullName, companyId]
  );
  return rows[0]?.id ?? null;
}

async function main() {
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets['All Contacts'];
  if (!sheet) throw new Error('Could not find the "All Contacts" sheet in the workbook.');

  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' }).map((r) => ({
    name: String(r['Name'] || '').trim(),
    institute: String(r['Company / Institute'] || '').trim(),
    designation: String(r['Designation'] || '').trim(),
    phone: String(r['Phone'] || '').trim(),
    email: String(r['Email'] || '').trim(),
    country: String(r['Country'] || '').trim(),
    address: String(r['Address'] || '').trim(),
    category: String(r['Category'] || '').trim(),
    source: String(r['Source'] || '').trim(),
    duplicateGroup: String(r['Duplicate Group'] || '').trim(),
  }));

  console.log(`Read ${rows.length} rows from "${filePath}"`);

  const client = await pool.connect();
  let inserted = 0;
  let skipped = 0;

  try {
    await client.query('BEGIN');

    for (const row of rows) {
      if (!row.name) continue;

      const companyId = await getOrCreateCompany(client, row.institute, row.country);
      const existingId = await contactExists(client, row.name, companyId);
      if (existingId) {
        skipped++;
        continue;
      }

      const source =
        row.source === 'Photo scan' || row.source === 'Photo scan (verified)'
          ? 'ocr-scan'
          : 'imported-xlsx';

      const { rows: inserted_rows } = await client.query(
        `INSERT INTO connect_contacts
           (company_id, full_name, position, phone, email, country, address,
            source, duplicate_group)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING id`,
        [
          companyId,
          row.name,
          row.designation || null,
          row.phone || null,
          row.email || null,
          row.country || null,
          row.address || null,
          source,
          row.duplicateGroup || null,
        ]
      );
      const contactId = inserted_rows[0].id;

      const categoryName = guessCategory(row);
      const categoryId = await getOrCreateCategory(client, categoryName);
      await client.query(
        `INSERT INTO connect_contact_categories (contact_id, category_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [contactId, categoryId]
      );
      if (companyId) {
        await client.query(
          `INSERT INTO connect_company_categories (company_id, category_id)
           VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [companyId, categoryId]
        );
      }

      inserted++;
    }

    await client.query('COMMIT');
    console.log(`Done. Inserted ${inserted} contacts, skipped ${skipped} already-present.`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
