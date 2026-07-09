const store = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(ip: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const rec = store.get(ip)
  if (!rec || now > rec.resetAt) {
    store.set(ip, { count: 1, resetAt: now + windowMs })
    return false
  }
  if (rec.count >= limit) return true
  rec.count++
  return false
}
