import fs from 'fs'
import path from 'path'
import { UserRole } from './auth'

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), 'data')
const FILE = path.join(DATA_DIR, 'users.json')

export interface StoredUser {
  id: string
  name: string
  email: string
  role: UserRole
  password_hash: string
  created_at: string
}

export function getUsers(): StoredUser[] {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf-8')) as StoredUser[]
  } catch {
    return []
  }
}

export function getUserByEmail(email: string): StoredUser | undefined {
  return getUsers().find(u => u.email.toLowerCase() === email.toLowerCase())
}

export function getPublicUsers() {
  return getUsers().map(({ id, name, email, role }) => ({ id, name, email, role }))
}

export function updateUserPassword(userId: string, newHash: string): boolean {
  try {
    const users = getUsers()
    const idx = users.findIndex(u => u.id === userId)
    if (idx === -1) return false
    users[idx].password_hash = newHash
    fs.writeFileSync(FILE, JSON.stringify(users, null, 2))
    return true
  } catch {
    return false
  }
}
