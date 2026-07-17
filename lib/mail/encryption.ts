import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGO = 'aes-256-cbc'

function getKey(): Buffer {
  const hex = process.env.MAIL_ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error('MAIL_ENCRYPTION_KEY must be a 64-char hex string (32 bytes). Generate with: openssl rand -hex 32')
  }
  return Buffer.from(hex, 'hex')
}

// Returns "ivHex:ciphertextHex"
export function encryptToken(plaintext: string): string {
  const key = getKey()
  const iv  = randomBytes(16)
  const cipher = createCipheriv(ALGO, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`
}

// Accepts "ivHex:ciphertextHex"
export function decryptToken(encryptedText: string): string {
  const key = getKey()
  const [ivHex, encHex] = encryptedText.split(':')
  if (!ivHex || !encHex) throw new Error('Invalid encrypted token format')
  const iv  = Buffer.from(ivHex, 'hex')
  const enc = Buffer.from(encHex, 'hex')
  const decipher = createDecipheriv(ALGO, key, iv)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
}
