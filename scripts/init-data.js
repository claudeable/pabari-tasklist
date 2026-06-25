const fs = require('fs')
const path = require('path')

const DATA_DIR = process.env.DATA_DIR
if (!DATA_DIR) {
  console.log('init-data: DATA_DIR not set, skipping (local mode)')
  process.exit(0)
}

const SEED_DIR = path.join(process.cwd(), 'data')
fs.mkdirSync(DATA_DIR, { recursive: true })

// users.json — always overwrite so role/account changes take effect on deploy
const usersSrc  = path.join(SEED_DIR, 'users.json')
const usersDest = path.join(DATA_DIR, 'users.json')
if (fs.existsSync(usersSrc)) {
  fs.copyFileSync(usersSrc, usersDest)
  console.log('init-data: updated users.json')
}

// tasks.json — only seed if missing (preserve live task data)
const tasksSrc  = path.join(SEED_DIR, 'tasks.json')
const tasksDest = path.join(DATA_DIR, 'tasks.json')
if (!fs.existsSync(tasksDest)) {
  if (fs.existsSync(tasksSrc)) {
    fs.copyFileSync(tasksSrc, tasksDest)
    console.log('init-data: seeded tasks.json')
  }
} else {
  console.log('init-data: tasks.json already exists, keeping live data')
}
