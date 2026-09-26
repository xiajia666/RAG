type Page = string

interface SidebarProps {
  current: Page
  onNavigate: (p: Page) => void
  collapsed: boolean
  onToggle: () => void
  username: string
  role: string
  onLogout: () => void
}

const NAV = [
  {
    group: '核心',
    items: [
      { id: 'dashboard', label: '仪表盘', icon: <GridIcon /> },
      { id: 'kbs', label: '知识库', icon: <DatabaseIcon /> },
      { id: 'chat', label: '智能问答', icon: <ChatIcon />, badge: '新' },
      { id: 'docs', label: '文档管理', icon: <FolderIcon /> },
    ],
  },
  {
    group: '运营',
    items: [
      { id: 'analytics', label: '数据分析', icon: <BarIcon /> },
      { id: 'team', label: '团队管理', icon: <TeamIcon /> },
    ],
  },
  {
    group: '系统',
    items: [
      { id: 'settings', label: '设置', icon: <SettingsIcon /> },
    ],
  },
]

export default function Sidebar({ current, onNavigate, collapsed, onToggle, username, role, onLogout }: SidebarProps) {
  return (
    <aside
      className="flex flex-col h-full transition-all duration-200 shrink-0"
      style={{
        width: collapsed ? 56 : 220,
        background: 'var(--color-surface)',
        borderRight: '1px solid var(--color-border)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-3.5 py-4" style={{ borderBottom: '1px solid var(--color-border)', minHeight: 56 }}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--color-cyan)' }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="2.5" fill="var(--color-text-inv)"/>
            <path d="M7 1.5v1M7 11.5v1M1.5 7h1M11.5 7h1M3.4 3.4l.7.7M9.9 9.9l.7.7M9.9 3.4l-.7.7M3.4 9.9l.7.7" stroke="var(--color-text-inv)" strokeWidth="1.1" strokeLinecap="round"/>
          </svg>
        </div>
        {!collapsed && (
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
            NeuralRAG
          </span>
        )}
        <button
          onClick={onToggle}
          className="ml-auto shrink-0 rounded p-1 transition-colors"
          style={{ color: 'var(--color-text-3)' }}
          title={collapsed ? '展开' : '收起'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            {collapsed
              ? <path d="M9 18l6-6-6-6"/>
              : <path d="M15 18l-6-6 6-6"/>}
          </svg>
        </button>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-4">
        {NAV.map(({ group, items }) => (
          <div key={group}>
            {!collapsed && (
              <div className="px-3.5 mb-1 text-xs font-medium" style={{ color: 'var(--color-text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>{group}</div>
            )}
            {items.map(({ id, label, icon, badge }) => {
              const active = current === id || current.startsWith(id + '/')
              return (
                <button
                  key={id}
                  onClick={() => onNavigate(id)}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm transition-all relative"
                  style={{
                    color: active ? 'var(--color-cyan)' : 'var(--color-text-2)',
                    background: active ? 'var(--color-cyan-dim)' : 'transparent',
                    borderLeft: active ? '2px solid var(--color-cyan)' : '2px solid transparent',
                    fontWeight: active ? 500 : 400,
                  }}
                  title={collapsed ? label : undefined}
                >
                  <span className="shrink-0 w-4 h-4 flex items-center justify-center">{icon}</span>
                  {!collapsed && <span className="truncate">{label}</span>}
                  {!collapsed && badge && (
                    <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'var(--color-cyan-dim)', color: 'var(--color-cyan)', fontFamily: 'var(--font-mono)', fontSize: '0.65rem' }}>{badge}</span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="px-3 py-3" style={{ borderTop: '1px solid var(--color-border)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs font-bold" style={{ background: 'var(--color-violet-dim)', color: 'var(--color-violet)', border: '1px solid rgba(139,92,246,0.25)' }}>{username.slice(0, 1).toUpperCase() || 'U'}</div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate" style={{ lineHeight: 1.3 }}>{username}</div>
              <div className="text-xs truncate" style={{ color: 'var(--color-text-3)' }}>{role === 'admin' ? '管理员' : role === 'operator' ? '运营人员' : '成员'}</div>
            </div>
          )}
          {!collapsed && <button onClick={onLogout} className="text-xs" style={{ color: 'var(--color-text-3)' }}>退出</button>}
        </div>
      </div>
    </aside>
  )
}

// Icons
function GridIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
}
function DatabaseIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3"/></svg>
}
function ChatIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
}
function FolderIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
}
function BarIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
}
function TeamIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
}
function SettingsIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
}
