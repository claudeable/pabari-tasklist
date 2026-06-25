// Run: node scripts/seed-users.js
const bcrypt = require('bcryptjs')
const fs    = require('fs')
const path  = require('path')
const { randomUUID } = require('crypto')

const USERS = [
  { name: 'Admin',       email: 'admin@usm.co.ke',        role: 'admin'    },
  { name: 'Pedro',       email: 'hpedro@usc.co.ke',      role: 'staff'    },
  { name: 'Harshil',     email: 'harshil@usc.co.ke',     role: 'director' },
  { name: 'Sabina',      email: 'sabina@usc.co.ke',      role: 'manager'  },
  { name: 'Ahmad',       email: 'ahmad@usc.co.ke',       role: 'manager'  },
  { name: 'Eng. Suresh', email: 'suresh@usc.co.ke',      role: 'manager'  },
  { name: 'Paul',        email: 'paul@usc.co.ke',        role: 'manager'  },
  { name: 'Krishina',    email: 'krishnan@usc.co.ke',    role: 'manager'  },
  { name: 'Ashok',       email: 'ashok@usc.co.ke',       role: 'manager'  },
  { name: 'Yalelet',     email: 'yalelet@usc.co.ke',     role: 'staff'    },
  { name: 'Andu',        email: 'andu@usc.co.ke',        role: 'staff'    },
  { name: 'Yared',       email: 'yared@usc.co.ke',       role: 'staff'    },
  { name: 'Benson',      email: 'benson@usc.co.ke',      role: 'manager'  },
  { name: 'Simon',       email: 'simon@usc.co.ke',       role: 'staff'    },
  { name: 'Binal',       email: 'binal@usc.co.ke',       role: 'manager'  },
  { name: 'Mungai',      email: 'mungai@usc.co.ke',      role: 'manager'  },
  { name: 'Lazarus',     email: 'lazarus@usc.co.ke',     role: 'manager'  },
]

async function main() {
  const seeded = await Promise.all(USERS.map(async u => ({
    id:            randomUUID(),
    name:          u.name,
    email:         u.email,
    role:          u.role,
    password_hash: await bcrypt.hash('changeme123', 10),
    created_at:    new Date().toISOString(),
  })))

  const outPath = path.join(__dirname, '..', 'data', 'users.json')
  fs.writeFileSync(outPath, JSON.stringify(seeded, null, 2))
  console.log(`✓ Seeded ${seeded.length} users → data/users.json`)
  seeded.forEach(u => console.log(`  ${u.role.padEnd(9)} ${u.email}`))
}

main().catch(err => { console.error(err); process.exit(1) })
