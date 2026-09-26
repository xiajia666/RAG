import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { api, streamChat } from '../api/client'
import type { KnowledgeBase, Message, Session, StreamMeta } from '../api/types'

const SUGGESTIONS = ['总结这份知识库的主要内容', '相关制度的关键要求是什么？', '帮我查找文档中的操作流程']

export default function Chat() {
  const [kbs, setKbs] = useState<KnowledgeBase[]>([])
  const [kbId, setKbId] = useState('')
  const [sessions, setSessions] = useState<Session[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const kb = kbs.find(item => item.id === kbId)

  useEffect(() => { api.get<KnowledgeBase[]>('/api/kbs').then(items => { setKbs(items); if (items.length) setKbId(items[0].id) }).catch(() => {}) }, [])
  useEffect(() => {
    if (!kbId) return
    setSessionId(null); setMessages([])
    api.get<Session[]>(`/api/kbs/${kbId}/sessions`).then(setSessions).catch(() => setSessions([]))
  }, [kbId])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, busy])

  async function openSession(id: string) {
    try {
      const loaded = await api.get<Session & { messages: Message[] }>(`/api/sessions/${id}`)
      setSessionId(id); setMessages(loaded.messages || [])
    } catch { setMessages([]) }
  }
  function newChat() { setSessionId(null); setMessages([]) }
  async function send(text = input) {
    const question = text.trim()
    if (!question || !kbId || busy) return
    setInput(''); setBusy(true)
    setMessages(previous => [...previous, { role: 'user', content: question }, { role: 'assistant', content: '', sources: [] }])
    const append = (update: (message: Message) => Message) => setMessages(previous => { const next = [...previous]; const last = next[next.length - 1]; if (last?.role === 'assistant') next[next.length - 1] = update(last); return next })
    try {
      await streamChat({ message: question, kb_id: kbId, session_id: sessionId }, {
        onMeta: (meta: StreamMeta) => { setSessionId(meta.session_id); append(message => ({ ...message, sources: meta.sources })) },
        onToken: token => append(message => ({ ...message, content: message.content + token })),
        onError: message => append(last => ({ ...last, content: `${last.content}\n\n⚠️ ${message}` })),
      })
    } catch (error) { append(message => ({ ...message, content: error instanceof Error ? `⚠️ ${error.message}` : '请求失败' })) }
    finally { setBusy(false); api.get<Session[]>(`/api/kbs/${kbId}/sessions`).then(setSessions).catch(() => {}) }
  }

  return <div className="flex-1 flex overflow-hidden">
    <aside className="w-56 hidden lg:flex flex-col shrink-0" style={{ background: 'var(--color-surface)', borderRight: '1px solid var(--color-border)' }}>
      <div className="p-4" style={{ borderBottom: '1px solid var(--color-border)' }}><button onClick={newChat} className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--color-cyan-dim)', color: 'var(--color-cyan)', border: '1px solid rgba(0,212,180,.25)' }}>＋ 新建对话</button></div>
      <div className="flex-1 overflow-y-auto p-2"><p className="px-2 py-2 text-xs" style={{ color: 'var(--color-text-3)' }}>历史会话</p>{sessions.map(item => <button key={item.id} onClick={() => openSession(item.id)} className="w-full text-left px-3 py-2 rounded-lg text-xs truncate" style={{ color: sessionId === item.id ? 'var(--color-cyan)' : 'var(--color-text-2)', background: sessionId === item.id ? 'var(--color-surface-2)' : 'transparent' }}>{item.title || '新会话'}<span className="block mt-1" style={{ color: 'var(--color-text-3)' }}>{String(item.created_at).slice(0, 16).replace('T', ' ')}</span></button>)}</div>
    </aside>
    <section className="flex-1 flex flex-col min-w-0">
      <header className="flex items-center gap-3 px-5 py-3" style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}><span className="text-sm">连接知识库：</span><select value={kbId} onChange={e => setKbId(e.target.value)} className="px-2 py-1 rounded-lg text-sm" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border-md)', color: 'var(--color-cyan)' }}>{kbs.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><span className="ml-auto text-xs" style={{ color: 'var(--color-text-3)' }}>{kb ? `${kb.document_count || 0} 份文档` : '先创建知识库以开始问答'}</span></header>
      <div className="flex-1 overflow-y-auto p-5 space-y-5">{!messages.length && <div className="max-w-2xl mx-auto mt-16 text-center"><div className="text-xl font-semibold mb-2">向知识库提问</div><p className="text-sm mb-6" style={{ color: 'var(--color-text-3)' }}>回答会基于当前知识库检索，并附上来源文档。</p><div className="flex flex-wrap justify-center gap-2">{SUGGESTIONS.map(suggestion => <button key={suggestion} onClick={() => send(suggestion)} disabled={!kbId} className="px-3 py-2 rounded-full text-xs" style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-2)' }}>{suggestion}</button>)}</div></div>}
        {messages.map((message, index) => <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className="max-w-3xl"><div className="px-4 py-3 rounded-2xl text-sm leading-7" style={{ background: message.role === 'user' ? 'var(--color-cyan)' : 'var(--color-surface)', color: message.role === 'user' ? 'var(--color-text-inv)' : 'var(--color-text)', border: message.role === 'assistant' ? '1px solid var(--color-border)' : 'none' }}>{message.role === 'assistant' ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content || (busy && index === messages.length - 1 ? '正在检索并生成回答…' : '')}</ReactMarkdown> : message.content}</div>{!!message.sources?.length && <details className="mt-2 text-xs" style={{ color: 'var(--color-text-3)' }}><summary className="cursor-pointer">来源溯源 · {message.sources.length} 个片段</summary><div className="mt-2 space-y-1">{message.sources.map((source, i) => <div key={i} className="p-2 rounded-lg" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>{source.filename} · 相关度 {Math.round(source.score * 100)}%</div>)}</div></details>}</div></div>)}<div ref={bottomRef} /></div>
      <form onSubmit={e => { e.preventDefault(); void send() }} className="flex gap-2 p-4" style={{ borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)' }}><input value={input} onChange={e => setInput(e.target.value)} disabled={!kbId || busy} placeholder={kbId ? '输入你的问题…' : '请先创建知识库'} className="flex-1 px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }} /><button disabled={!kbId || busy || !input.trim()} className="px-5 rounded-xl text-sm font-medium" style={{ background: 'var(--color-cyan)', color: 'var(--color-text-inv)', opacity: busy || !input.trim() ? .6 : 1 }}>发送</button></form>
    </section>
  </div>
}
