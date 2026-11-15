import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './store/auth'
import Sidebar from './components/WorkspaceSidebar'
import Dashboard from './workspace-pages/Dashboard'
import KnowledgeBases from './workspace-pages/KnowledgeBases'
import Chat from './workspace-pages/Chat'
import Documents from './workspace-pages/Documents'
import Analytics from './workspace-pages/Analytics'
import Team from './workspace-pages/Team'
import Settings from './workspace-pages/Settings'
import { WORKSPACE_PATHS, workspacePageFrom, workspacePathFor } from './workspaceRoutes'

export default function WorkspaceShell() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const routerNavigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const page = workspacePageFrom(location.pathname)

  if (!page) {
    return <Navigate to={WORKSPACE_PATHS.dashboard} replace />
  }

  const currentPage = page
  const navigate = (next: string) => routerNavigate(workspacePathFor(next))
  const title = pageTitle(currentPage)

  function renderPage() {
    if (currentPage === 'dashboard') return <Dashboard onNavigate={navigate} />
    if (currentPage === 'kbs' || currentPage === 'kbs/new' || currentPage.startsWith('kbs/')) {
      const kbId = currentPage.startsWith('kbs/') && currentPage !== 'kbs/new' ? currentPage.split('/')[1] : undefined
      return <KnowledgeBases initialKbId={kbId} showNew={currentPage === 'kbs/new'} onNavigate={navigate} />
    }
    if (currentPage === 'chat') return <Chat />
    if (currentPage === 'docs') return <Documents />
    if (currentPage === 'analytics') return <Analytics />
    if (currentPage === 'team') return <Team />
    if (currentPage === 'settings') return <Settings />
    return <Dashboard onNavigate={navigate} />
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--color-bg)' }}>
      <Sidebar current={currentPage} onNavigate={navigate} collapsed={collapsed} onToggle={() => setCollapsed(value => !value)} username={user?.nickname || user?.username || ''} role={user?.role || 'user'} onLogout={logout} />
      <main className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--color-bg)' }}>
        <header className="flex items-center justify-between px-6 py-3 shrink-0" style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)', minHeight: 52 }}>
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-3)' }}>
            <span>知微知识库</span><span aria-hidden="true">›</span><span style={{ color: 'var(--color-text-2)' }}>{title}</span>
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
