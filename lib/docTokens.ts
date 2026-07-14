interface TokenEntry { documentId: number; expiresAt: number }

const tokens = new Map<string, TokenEntry>()

export function createViewToken(documentId: number): string {
  const now = Date.now()
  for (const [k, v] of tokens) if (v.expiresAt < now) tokens.delete(k)
  const token = crypto.randomUUID()
  tokens.set(token, { documentId, expiresAt: now + 24 * 60 * 60 * 1000 }) // 24 hours
  return token
}

export function validateViewToken(token: string): number | null {
  const entry = tokens.get(token)
  if (!entry) return null
  if (entry.expiresAt < Date.now()) { tokens.delete(token); return null }
  return entry.documentId
}
