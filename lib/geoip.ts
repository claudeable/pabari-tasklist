const LOCAL_PREFIXES = ['127.', '::1', '192.168.', '10.', '172.16.', '172.17.', '172.18.',
  '172.19.', '172.20.', '172.21.', '172.22.', '172.23.', '172.24.', '172.25.',
  '172.26.', '172.27.', '172.28.', '172.29.', '172.30.', '172.31.']

function isPrivate(ip: string) {
  return LOCAL_PREFIXES.some(p => ip.startsWith(p))
}

export async function resolveLocation(ip: string): Promise<string> {
  if (!ip || isPrivate(ip)) return `${ip} (local network)`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 3000)

  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`, {
      headers: { 'User-Agent': 'Pabari-ERP/1.0' },
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!res.ok) return ip

    const d = await res.json()
    if (d.error) return ip

    const city    = d.city        ?? ''
    const country = d.country_name ?? ''
    const org     = (d.org ?? '').replace(/^AS\d+\s*/, '') // strip AS number prefix

    const parts = [city, country, org].filter(Boolean)
    return parts.length ? `${parts.join(', ')} · ${ip}` : ip
  } catch {
    clearTimeout(timer)
    return ip
  }
}
