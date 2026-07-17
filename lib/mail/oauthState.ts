import type { DataCenter } from './zoho'

const pendingStates = new Map<string, { userId: string; dc: DataCenter; createdAt: number }>()

function prune() {
  const cutoff = Date.now() - 10 * 60 * 1000
  Array.from(pendingStates.entries()).forEach(([k, v]) => {
    if (v.createdAt < cutoff) pendingStates.delete(k)
  })
}

export function registerState(state: string, userId: string, dc: DataCenter) {
  prune()
  pendingStates.set(state, { userId, dc, createdAt: Date.now() })
}

export function verifyState(state: string): { userId: string; dc: DataCenter } | null {
  const entry = pendingStates.get(state)
  if (!entry) return null
  if (Date.now() - entry.createdAt > 10 * 60 * 1000) { pendingStates.delete(state); return null }
  pendingStates.delete(state)
  return { userId: entry.userId, dc: entry.dc }
}
