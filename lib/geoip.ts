const LOCAL_PREFIXES = ['127.', '::1', '192.168.', '10.', '172.16.', '172.17.', '172.18.',
  '172.19.', '172.20.', '172.21.', '172.22.', '172.23.', '172.24.', '172.25.',
  '172.26.', '172.27.', '172.28.', '172.29.', '172.30.', '172.31.']

// Known office / site IPs — add more here as needed
const KNOWN_LOCATIONS: Record<string, string> = {
  '196.201.225.58': '📍 EPPL Office, Baba Dogo Rd, Nairobi',
}

function isPrivate(ip: string) {
  return LOCAL_PREFIXES.some(p => ip.startsWith(p))
}

export async function resolveLocation(ip: string): Promise<string> {
  if (!ip || isPrivate(ip)) return `In Office · ${ip}`

  // Known office IPs — return office label immediately
  if (KNOWN_LOCATIONS[ip]) return `In Office · ${KNOWN_LOCATIONS[ip]}`

  // Any unrecognised IP = out of office
  return `Out of Office · ${ip}`
}
