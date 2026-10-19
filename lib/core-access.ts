type CoreUser = { email: string; role: string; portals?: string[] }

export function hasKenyaCoreEmail(email: string): boolean {
  const parts = email.trim().toLowerCase().split('@')
  return parts.length === 2 && parts[0].length > 0 &&
    ['usm.co.ke', 'kwale-group.com'].includes(parts[1])
}

export function canAccessCore(user: CoreUser, branch: string = 'kenya'): boolean {
  return user.role === 'admin' || (branch === 'kenya' && hasKenyaCoreEmail(user.email))
}

export function canAccessTaskPortal(user: CoreUser, branch: string = 'kenya'): boolean {
  const portals = user.portals ?? []
  return canAccessCore(user, branch) || portals.length === 0 || portals.includes('tasks')
}
