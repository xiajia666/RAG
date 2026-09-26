import { useState } from 'react'
import { useAuth } from './store/auth'
import Sidebar from './components/WorkspaceSidebar'
import Dashboard from './workspace-pages/Dashboard'
import KnowledgeBases from './workspace-pages/KnowledgeBases'
import Chat from './workspace-pages/Chat'
import Documents from './workspace-pages/Documents'
import Analytics from './workspace-pages/Analytics'
import Team from './workspace-pages/Team'
import Settings from './workspace-pages/Settings'

export default function WorkspaceShell() {
  const { user, logout } = useAuth()
  const [page, setPage] = useState('dashboard')
  const [collapsed, setCollapsed] = useState(false)
  const navigate = (next: string) => setPage(next)
  const title = pageTitle(page)

  function renderPage() {
    if (page === 'dashboard') return <Dashboard onNavigate={navigate} />
    if (page === 'kbs' || page === 'kbs/new' || page.startsWith('kbs/')) {
      const kbId = page.startsWith('kbs/') && page !== 'kbs/new' ? page.split('/')[1] : undefined
      return <KnowledgeBases initialKbId={kbId} showNew={page === 'kbs/new'} onNavigate={navigate} />
    }
    if (page === 'chat') return <Chat />
    if (page === 'docs') return <Documents />
    if (page === 'analytics') return <Analytics />
    if (page === 'team') return <Team />
    if (page === 'settings') return <Settings />
    return <Dashboard onNavigate={navigate} />
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--color-bg)' }}>
      <Sidebar current={page} onNavigate={navigate} collapsed={collapsed} onToggle={() => setCollapsed(value => !value)} username={user?.nickname || user?.username || ''} role={user?.role || 'user'} onLogout={logout} />
      <main className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--color-bg)' }}>
        <header className="flex items-center justify-between px-6 py-3 shrink-0" style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)', minHeight: 52 }}>
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-3)' }}>
            <span>NeuralRAG</span><span aria-hidden="true">›</span><span style={{ color: 'var(--color-text-2)' }}>{title}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:block text-sm" style={{ color: 'var(--color-text-3)' }}>{user?.username}</div>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'var(--color-violet-dim)', color: 'var(--color-violet)', border: '1px solid rgba(139,92,246,0.25)' }}>{(user?.nickname || user?.username || 'U').slice(0, 1).toUpperCase()}</div>
          </div>
        </header>
        <div className="flex-1 flex overflow-hidden">{renderPage()}</div>
      </main>
    </div>
  )
}

function pageTitle(page: string) {
  if (page === 'dashboard') return '仪表盘'
  if (page.startsWith('kbs')) return '知识库'
  if (page === 'chat') return '智能问答'
  if (page === 'docs') return '文档管理'
  if (page === 'analytics') return '数据分析'
  if (page === 'team') return '团队管理'
  if (page === 'settings') return '设置'
  return ''
}
