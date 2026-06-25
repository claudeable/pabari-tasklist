/**
 * Runs before `next start` on Railway.
 * If DATA_DIR is set and the data files don't exist there yet,
 * copies the bundled seed files so the first deploy has data.
 */
const fs = require('fs')
const path = require('path')

const DATA_DIR = process.env.DATA_DIR
if (!DATA_DIR) {
  console.log('init-data: DATA_DIR not set, skipping (local mode)')
  process.exit(0)
}

const SEED_DIR = path.join(process.cwd(), 'data')
const FILES = ['tasks.json', 'users.json']

fs.mkdirSync(DATA_DIR, { recursive: true })

for (const file of FILES) {
  const dest = path.join(DATA_DIR, file)
  const src = path.join(SEED_DIR, file)
  if (!fs.existsSync(dest)) {
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest)
      console.log(`init-data: seeded ${file}`)
    } else {
      console.warn(`init-data: seed file missing: ${src}`)
    }
  } else {
    console.log(`init-data: ${file} already exists, skipping`)
  }
}
