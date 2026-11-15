export const WORKSPACE_PATHS = {
  dashboard: '/dashboard',
  knowledgeBases: '/knowledge-bases',
  chat: '/chat',
  documents: '/documents',
  analytics: '/analytics',
  team: '/team',
  settings: '/settings',
} as const

export function workspacePathFor(page: string) {
  if (page === 'dashboard') return WORKSPACE_PATHS.dashboard
  if (page === 'kbs') return WORKSPACE_PATHS.knowledgeBases
  if (page === 'kbs/new') return `${WORKSPACE_PATHS.knowledgeBases}/new`
  if (page.startsWith('kbs/')) {
    const kbId = page.slice('kbs/'.length)
    return `${WORKSPACE_PATHS.knowledgeBases}/${encodeURIComponent(kbId)}`
  }
  if (page === 'chat') return WORKSPACE_PATHS.chat
  if (page === 'docs') return WORKSPACE_PATHS.documents
  if (page === 'analytics') return WORKSPACE_PATHS.analytics
  if (page === 'team') return WORKSPACE_PATHS.team
  if (page === 'settings') return WORKSPACE_PATHS.settings
  return WORKSPACE_PATHS.dashboard
}

export function workspacePageFrom(pathname: string) {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname

  if (path === WORKSPACE_PATHS.dashboard) return 'dashboard'
  if (path === WORKSPACE_PATHS.knowledgeBases) return 'kbs'
  if (path === `${WORKSPACE_PATHS.knowledgeBases}/new`) return 'kbs/new'
  if (path.startsWith(`${WORKSPACE_PATHS.knowledgeBases}/`)) {
    const encodedKbId = path.slice(`${WORKSPACE_PATHS.knowledgeBases}/`.length)
    if (!encodedKbId || encodedKbId.includes('/')) return null
    try {
      return `kbs/${decodeURIComponent(encodedKbId)}`
    } catch {
      return null
    }
  }
  if (path === WORKSPACE_PATHS.chat) return 'chat'
  if (path === WORKSPACE_PATHS.documents) return 'docs'
  if (path === WORKSPACE_PATHS.analytics) return 'analytics'
  if (path === WORKSPACE_PATHS.team) return 'team'
  if (path === WORKSPACE_PATHS.settings) return 'settings'
  return null
}
