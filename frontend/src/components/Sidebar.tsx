import { useState } from 'react'
import type { KnowledgeBase, Session } from '../api/types'

interface Props {
  kbs: KnowledgeBase[]
  selectedKbId: string | null
  sessions: Session[]
  currentSessionId: string | null
  isAdmin: boolean
  username: string
  role: string
  mobileOpen: boolean
  onToggleMobile: () => void
  onSelectKb: (id: string) => void
  onCreateKb: (name: string) => void
  onDeleteKb: (id: string) => void
  onSelectSession: (id: string) => void
  onNewChat: () => void
  onDeleteSession: (id: string) => void
  onOpenUsers: () => void
  onLogout: () => void
}

export default function Sidebar(props: Props) {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')

  function submitCreate() {
    const n = name.trim()
    if (n) {
      props.onCreateKb(n)
      setName('')
      setCreating(false)
    }
  }

  return (
    <aside className={`sidebar ${props.mobileOpen ? '' : 'hidden'}`}>
      <div className="sidebar-header">
        <span className="sidebar-brand">
          <span className="dot">●</span>小微企业知识库
        </span>
        <div className="sidebar-user">
          <span className="name">{props.username}</span>
          <span className="role">{props.role === 'admin' ? '管理员' : '成员'}</span>
          <button className="logout" onClick={props.onLogout} title="退出登录">
            退出
          </button>
        </div>
      </div>

      <div className="sidebar-scroll">
        <section className="sidebar-section">
          <h2>
            知识库
            {props.isAdmin && (
              <button
                className="icon-btn"
                title="新建知识库"
                onClick={() => setCreating((v) => !v)}
              >
                ＋
              </button>
            )}
          </h2>
          {creating && props.isAdmin && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="知识库名称"
                onKeyDown={(e) => e.key === 'Enter' && submitCreate()}
                autoFocus
              />
              <button className="btn btn-primary" onClick={submitCreate}>
                创建
              </button>
            </div>
          )}
          {props.kbs.length === 0 ? (
            <div className="empty-hint">
              {props.isAdmin ? '点击 ＋ 创建第一个知识库' : '暂无知识库'}
            </div>
          ) : (
            <ul className="kb-list">
              {props.kbs.map((kb) => (
                <li
                  key={kb.id}
                  className={kb.id === props.selectedKbId ? 'active' : ''}
                  onClick={() => props.onSelectKb(kb.id)}
                >
                  <span className="label">{kb.name}</span>
                  <span className="sub">{kb.document_count ?? 0}</span>
                  {props.isAdmin && (
                    <button
                      className="del"
                      title="删除知识库"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (confirm(`删除知识库「${kb.name}」及其全部文档？`)) {
                          props.onDeleteKb(kb.id)
                        }
                      }}
                    >
                      ✕
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {props.selectedKbId && (
          <section className="sidebar-section">
            <h2>
              会话
              <button className="icon-btn" title="新建会话" onClick={props.onNewChat}>
                ＋
              </button>
            </h2>
            {props.sessions.length === 0 ? (
              <div className="empty-hint">暂无会话，直接提问即可开始</div>
            ) : (
              <ul className="session-list">
                {props.sessions.map((s) => (
                  <li
                    key={s.id}
                    className={s.id === props.currentSessionId ? 'active' : ''}
                    onClick={() => props.onSelectSession(s.id)}
                  >
                    <span className="label">{s.title || '未命名会话'}</span>
                    <button
                      className="del"
                      title="删除会话"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (confirm('删除该会话？')) props.onDeleteSession(s.id)
                      }}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </aside>
  )
}
