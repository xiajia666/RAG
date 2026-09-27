import { useState, useRef, useEffect } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
  time: string
}

interface Source {
  name: string
  page: number
  score: number
}

const KB_OPTIONS = ['产品手册库', '客服FAQ', '法务知识库', '人事制度库', '技术文档库']

const HISTORY_SESSIONS = [
  { id: '1', title: '产品退款政策查询', time: '今天 14:23', kb: '客服FAQ', count: 6 },
  { id: '2', title: '合同违约条款说明', time: '今天 10:15', kb: '法务知识库', count: 4 },
  { id: '3', title: 'API鉴权方式查询', time: '昨天 17:42', kb: '技术文档库', count: 12 },
  { id: '4', title: '年假申请流程', time: '昨天 09:30', kb: '人事制度库', count: 3 },
  { id: '5', title: '版本更新内容 v3.2', time: '9月23日', kb: '产品手册库', count: 8 },
]

const MOCK_RESPONSES: Record<string, { content: string; sources: Source[] }> = {
  default: {
    content: `根据知识库检索，为您找到了相关内容：

**核心答案**
该问题涉及多个文档中的条款。综合分析后，关键信息如下：退换货申请需在购买后 **30 天内**提交，商品需保持原包装完好。特殊品类（如定制商品、数字内容）不适用常规退换货政策。

**操作步骤**
1. 登录账户，进入"我的订单"页面
2. 找到对应订单，点击"申请售后"
3. 选择退款原因并上传凭证照片
4. 提交后等待客服 1-2 个工作日审核

如需进一步了解，可以告诉我具体场景。`,
    sources: [
      { name: '客服FAQ_v2.pdf', page: 14, score: 0.962 },
      { name: '退换货政策_2026.docx', page: 3, score: 0.841 },
      { name: '用户服务协议.pdf', page: 8, score: 0.723 },
    ],
  },
}

const SUGGESTED = [
  '退换货的时限是多少？',
  '如何申请开具发票？',
  '产品质保期有多长？',
  '如何联系人工客服？',
]

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-2">
      {[0, 1, 2].map(i => (
        <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-cyan)', animation: `typing 1.2s ${i * 0.2}s infinite` }}/>
      ))}
    </div>
  )
}

export default function Chat() {
  const [selectedKB, setSelectedKB] = useState('客服FAQ')
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: '你好！我已连接到**客服FAQ**知识库。请直接提问，我会基于知识库内容给出精准有据的回答。',
      time: '14:20',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeSession, setActiveSession] = useState<string | null>(null)
  const [showSources, setShowSources] = useState<number | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const now = () => new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  const send = (text?: string) => {
    const q = (text ?? input).trim()
    if (!q || loading) return
    setInput('')
    setMessages(m => [...m, { role: 'user', content: q, time: now() }])
    setLoading(true)
    setTimeout(() => {
      const resp = MOCK_RESPONSES.default
      setMessages(m => [...m, { role: 'assistant', content: resp.content, sources: resp.sources, time: now() }])
      setLoading(false)
    }, 1600)
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* History sidebar */}
      <div className="w-56 flex-col hidden lg:flex shrink-0" style={{ background: 'var(--color-surface)', borderRight: '1px solid var(--color-border)' }}>
        <div className="p-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm justify-center" style={{ background: 'var(--color-cyan-dim)', border: '1px solid rgba(0,212,180,0.25)', color: 'var(--color-cyan)' }}
            onClick={() => { setMessages([{ role: 'assistant', content: `你好！我已连接到**${selectedKB}**知识库。请直接提问，我会基于知识库内容给出精准有据的回答。`, time: now() }]); setActiveSession(null) }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            新建对话
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          <div className="px-3 mb-2 text-xs" style={{ color: 'var(--color-text-3)', fontFamily: 'var(--font-mono)' }}>历史对话</div>
          {HISTORY_SESSIONS.map(s => (
            <button key={s.id} onClick={() => setActiveSession(s.id)} className="w-full text-left px-3 py-2.5 rounded-lg mx-1 transition-all" style={{ background: activeSession === s.id ? 'var(--color-surface-2)' : 'transparent', width: 'calc(100% - 8px)' }}>
              <div className="text-xs font-medium truncate">{s.title}</div>
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-xs" style={{ color: 'var(--color-text-3)' }}>{s.time}</span>
                <span className="text-xs px-1 rounded" style={{ background: 'var(--color-surface-3)', color: 'var(--color-text-3)', fontFamily: 'var(--font-mono)' }}>{s.count}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main chat */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <div className="flex items-center gap-3 px-5 py-3 shrink-0" style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-cyan)" strokeWidth="1.8"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3"/></svg>
          <span className="text-sm font-medium">连接知识库：</span>
          <select value={selectedKB} onChange={e => setSelectedKB(e.target.value)} className="text-sm px-2 py-1 rounded-lg" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border-md)', color: 'var(--color-cyan)' }}>
            {KB_OPTIONS.map(k => <option key={k}>{k}</option>)}
          </select>
          <div className="ml-auto flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-green)', animation: 'pulse-dot 2s infinite' }}/>
            <span className="text-xs" style={{ color: 'var(--color-text-3)' }}>已连接</span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto py-6 px-5 space-y-5">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mr-2.5 mt-0.5" style={{ background: 'var(--color-cyan-dim)', border: '1px solid rgba(0,212,180,0.25)' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" fill="var(--color-cyan)"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2" stroke="var(--color-cyan)" strokeWidth="2" strokeLinecap="round"/></svg>
                </div>
              )}
              <div style={{ maxWidth: '72%' }}>
                <div
                  className="px-4 py-3 rounded-2xl text-sm leading-relaxed"
                  style={{
                    background: msg.role === 'user' ? 'var(--color-cyan)' : 'var(--color-surface)',
                    color: msg.role === 'user' ? 'var(--color-text-inv)' : 'var(--color-text)',
                    border: msg.role === 'assistant' ? '1px solid var(--color-border)' : 'none',
                    borderRadius: msg.role === 'user' ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                  }}
                >
                  {msg.content.split('\n').map((line, li) => {
                    const boldLine = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    if (line.startsWith('**') && line.endsWith('**')) {
                      return <p key={li} className="font-semibold mt-2 mb-1" dangerouslySetInnerHTML={{ __html: boldLine }}/>
                    }
                    if (line.match(/^\d\./)) return <p key={li} className="ml-2 mt-0.5" dangerouslySetInnerHTML={{ __html: boldLine }}/>
                    if (line === '') return <br key={li}/>
                    return <p key={li} dangerouslySetInnerHTML={{ __html: boldLine }}/>
                  })}
                </div>

                {/* Sources */}
                {msg.sources && (
                  <div className="mt-2">
                    <button onClick={() => setShowSources(showSources === i ? null : i)} className="text-xs flex items-center gap-1.5 transition-all" style={{ color: 'var(--color-text-3)' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      {msg.sources.length} 个来源
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: showSources === i ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}><path d="M6 9l6 6 6-6"/></svg>
                    </button>
                    {showSources === i && (
                      <div className="mt-2 space-y-1.5 animate-fade-in">
                        {msg.sources.map((s, si) => (
                          <div key={si} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                            <span className="font-mono text-xs px-1 rounded" style={{ background: 'var(--color-red-dim)', color: 'var(--color-red)' }}>PDF</span>
                            <span className="flex-1 truncate" style={{ color: 'var(--color-text-2)' }}>{s.name}</span>
                            <span style={{ color: 'var(--color-text-3)', fontFamily: 'var(--font-mono)' }}>第 {s.page} 页</span>
                            <span className="px-1.5 py-0.5 rounded" style={{ background: 'var(--color-cyan-dim)', color: 'var(--color-cyan)', fontFamily: 'var(--font-mono)' }}>{(s.score * 100).toFixed(1)}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="text-xs mt-1" style={{ color: 'var(--color-text-3)', textAlign: msg.role === 'user' ? 'right' : 'left' }}>{msg.time}</div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start animate-fade-in">
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mr-2.5" style={{ background: 'var(--color-cyan-dim)', border: '1px solid rgba(0,212,180,0.25)' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" fill="var(--color-cyan)"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2" stroke="var(--color-cyan)" strokeWidth="2" strokeLinecap="round"/></svg>
              </div>
              <div className="px-4 py-2 rounded-2xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '4px 16px 16px 16px' }}>
                <TypingDots />
              </div>
            </div>
          )}
          <div ref={bottomRef}/>
        </div>

        {/* Suggestions */}
        {messages.length <= 1 && (
          <div className="px-5 pb-3 flex flex-wrap gap-2">
            {SUGGESTED.map(s => (
              <button key={s} onClick={() => send(s)} className="px-3 py-1.5 rounded-full text-xs transition-all" style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-2)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(0,212,180,0.3)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-cyan)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-2)' }}
              >{s}</button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="px-5 pb-5 shrink-0">
          <div className="flex items-end gap-2 rounded-xl p-3" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-md)' }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="向知识库提问… (Enter 发送，Shift+Enter 换行)"
              rows={1}
              className="flex-1 bg-transparent text-sm resize-none"
              style={{ color: 'var(--color-text)', maxHeight: 120, lineHeight: 1.6 }}
            />
            <button onClick={() => send()} disabled={!input.trim() || loading} className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all" style={{ background: input.trim() ? 'var(--color-cyan)' : 'var(--color-surface-3)', color: input.trim() ? 'var(--color-text-inv)' : 'var(--color-text-3)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
          <p className="text-xs text-center mt-2" style={{ color: 'var(--color-text-3)' }}>AI 回答基于所选知识库内容生成，请以实际文件为准</p>
        </div>
      </div>
    </div>
  )
}
