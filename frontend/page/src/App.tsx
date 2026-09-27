import { useState } from 'react'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import KnowledgeBases from './pages/KnowledgeBases'
import Chat from './pages/Chat'
import Documents from './pages/Documents'
import Analytics from './pages/Analytics'
import Team from './pages/Team'
import Settings from './pages/Settings'

export default function App() {
  const [page, setPage] = useState('dashboard')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const navigate = (p: string) => setPage(p)

  const renderPage = () => {
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
      <Sidebar
        current={page}
        onNavigate={navigate}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(c => !c)}
      />
      <main className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--color-bg)' }}>
        {/* Top bar */}
        <header className="flex items-center justify-between px-6 py-3 shrink-0" style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)', minHeight: 52 }}>
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-3)' }}>
            <span>NeuralRAG</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
            <span style={{ color: 'var(--color-text-2)' }}>{pageTitle(page)}</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Global search */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text-3)', width: 220 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <span>全局搜索…</span>
              <span className="ml-auto text-xs px-1 rounded" style={{ background: 'var(--color-surface-3)', fontFamily: 'var(--font-mono)' }}>⌘K</span>
            </div>
            {/* Notification */}
            <button className="relative w-8 h-8 flex items-center justify-center rounded-lg transition-colors" style={{ color: 'var(--color-text-3)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-cyan)' }}/>
            </button>
            {/* Avatar */}
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold cursor-pointer" style={{ background: 'var(--color-violet-dim)', color: 'var(--color-violet)', border: '1px solid rgba(139,92,246,0.25)' }}>张</div>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 flex overflow-hidden">
          {renderPage()}
        </div>
      </main>
    </div>
  )
}

function pageTitle(page: string): string {
  if (page === 'dashboard') return '仪表盘'
  if (page.startsWith('kbs')) return '知识库'
  if (page === 'chat') return '智能问答'
  if (page === 'docs') return '文档管理'
  if (page === 'analytics') return '数据分析'
  if (page === 'team') return '团队管理'
  if (page === 'settings') return '设置'
  return ''
}
