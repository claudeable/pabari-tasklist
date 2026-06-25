export interface ParsedEntry { label: string; text: string; isHK: boolean }

const DATE_RE = /(\d{1,2}[/.]\d{1,2}(?:[/.]\d{2,4})?:|HK:)/

export function parseUpdatesServer(updates: string): ParsedEntry[] {
  if (!updates?.trim()) return []
  const parts = updates.split(DATE_RE)
  const result: ParsedEntry[] = []
  if (parts[0].trim()) result.push({ label: '', text: parts[0].trim(), isHK: false })
  for (let i = 1; i + 1 < parts.length; i += 2) {
    const label = parts[i].replace(':', '').trim()
    const text  = (parts[i + 1] || '').trim()
    if (text) result.push({ label, text, isHK: label === 'HK' })
  }
  return result
}
