import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, streamChat } from '../api/client'
import type { KnowledgeBase, Message, Session } from '../api/types'
import { useAuth } from '../store/auth'
import Sidebar from '../components/Sidebar'
import MessageList from '../components/MessageList'
import Composer from '../components/Composer'
import DocumentPanel from '../components/DocumentPanel'
import UserPanel from '../components/UserPanel'

export default function Chat() {
  const { user, logout } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [kbs, setKbs] = useState<KnowledgeBase[]>([])
  const [selectedKbId, setSelectedKbId] = useState<string | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [streaming, setStreaming] = useState(false)
  const [docOpen, setDocOpen] = useState(false)
  const [usersOpen, setUsersOpen] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  const kb = useMemo(
    () => kbs.find((k) => k.id === selectedKbId) ?? null,
    [kbs, selectedKbId],
  )

  const loadKbs = useCallback(async () => {
    try {
      const list = await api.get<KnowledgeBase[]>('/api/kbs')
      setKbs(list)
      if (list.length && !selectedKbId) {
        setSelectedKbId(list[0].id)
      }
    } catch {
      /* 401 由 client 处理 */
    }
  }, [selectedKbId])

  const loadSessions = useCallback(async (kbId: string) => {
    try {
      const list = await api.get<Session[]>(`/api/kbs/${kbId}/sessions`)
      setSessions(list)
    } catch {
      setSessions([])
    }
  }, [])

  useEffect(() => {
    loadKbs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 切换知识库时加载对应会话
  useEffect(() => {
    if (selectedKbId) {
      setCurrentSessionId(null)
      setMessages([])
      loadSessions(selectedKbId)
    }
  }, [selectedKbId, loadSessions])

  function selectKb(kbId: string) {
    setSelectedKbId(kbId)
    setMobileSidebarOpen(false)
  }

  async function selectSession(sessionId: string) {
    setCurrentSessionId(sessionId)
    setMobileSidebarOpen(false)
    try {
      const s = await api.get<{ messages: Message[] }>(`/api/sessions/${sessionId}`)
      setMessages(
        s.messages.map((m) => ({
          role: m.role,
          content: m.content,
          sources: m.sources ?? [],
        })),
      )
    } catch {
      setMessages([])
    }
  }

  function newChat() {
    setCurrentSessionId(null)
    setMessages([])
    setMobileSidebarOpen(false)
  }

  async function createKb(name: string) {
    await api.post('/api/kbs', { name })
    await loadKbs()
  }

  async function deleteKb(kbId: string) {
    await api.del(`/api/kbs/${kbId}`)
    if (selectedKbId === kbId) {
      setSelectedKbId(null)
      setCurrentSessionId(null)
      setMessages([])
    }
    await loadKbs()
  }

  async function deleteSession(sessionId: string) {
    await api.del(`/api/sessions/${sessionId}`)
    if (currentSessionId === sessionId) {
      newChat()
    }
    if (selectedKbId) await loadSessions(selectedKbId)
  }

  async function sendMessage(text: string) {
    if (!kb || !text.trim() || streaming) return
    const content = text.trim()
    setMessages((prev) => [
      ...prev,
      { role: 'user', content },
      { role: 'assistant', content: '', sources: [] },
    ])
    setStreaming(true)

    const appendLast = (fn: (m: Message) => Message) => {
      setMessages((prev) => {
        const next = [...prev]
        const last = next[next.length - 1]
        if (last && last.role === 'assistant') next[next.length - 1] = fn(last)
        return next
      })
    }

    try {
      await streamChat(
        { message: content, kb_id: kb.id, session_id: currentSessionId },
        {
          onMeta: (meta) => {
            if (meta.session_id && meta.session_id !== currentSessionId) {
              setCurrentSessionId(meta.session_id)
            }
            appendLast((m) => ({ ...m, sources: meta.sources }))
          },
          onToken: (t) => appendLast((m) => ({ ...m, content: m.content + t })),
          onError: (msg) =>
            appendLast((m) => ({ ...m, content: m.content + `\n\n⚠️ ${msg}` })),
        },
      )
    } catch (err) {
      appendLast((m) => ({
        ...m,
        content: `⚠️ ${err instanceof Error ? err.message : '请求失败'}`,
      }))
    } finally {
      setStreaming(false)
      if (kb) loadSessions(kb.id)
    }
  }

  return (
    <div className="app">
      <Sidebar
        kbs={kbs}
        selectedKbId={selectedKbId}
        sessions={sessions}
        currentSessionId={currentSessionId}
        isAdmin={isAdmin}
        username={user?.username ?? ''}
        role={user?.role ?? 'user'}
        mobileOpen={mobileSidebarOpen}
        onToggleMobile={() => setMobileSidebarOpen((v) => !v)}
        onSelectKb={selectKb}
        onCreateKb={createKb}
        onDeleteKb={deleteKb}
        onSelectSession={selectSession}
        onNewChat={newChat}
        onDeleteSession={deleteSession}
        onOpenUsers={() => setUsersOpen(true)}
        onLogout={logout}
      />

      <div className="main">
        <header className="main-header">
          <div className="header-left">
            <button
              className="menu-btn"
              onClick={() => setMobileSidebarOpen((v) => !v)}
              aria-label="菜单"
            >
              ☰
            </button>
            <span className="kb-title">
              {kb ? kb.name : '请选择或创建一个知识库'}
            </span>
          </div>
          <div className="actions">
            {kb && (
              <button className="btn" onClick={() => setDocOpen(true)}>
                文档管理
              </button>
            )}
            {isAdmin && (
              <button className="btn" onClick={() => setUsersOpen(true)}>
                用户管理
              </button>
            )}
          </div>
        </header>

        <MessageList messages={messages} streaming={streaming} kbName={kb?.name} />

        {kb && <Composer onSend={sendMessage} disabled={streaming} />}
      </div>

      {kb && (
        <DocumentPanel
          kbId={kb.id}
          open={docOpen}
          isAdmin={isAdmin}
          onClose={() => setDocOpen(false)}
        />
      )}

      {isAdmin && (
        <UserPanel open={usersOpen} onClose={() => setUsersOpen(false)} />
      )}
    </div>
  )
}
