import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../store/auth'

type DashboardData = {
  stats: { knowledge_bases: number; documents: number; queries_this_month: number; members: number }
  trend: { date: string; count: number }[]
  top_knowledge_bases: { id: string; name: string; document_count: number; query_count: number }[]
  activity: { type: string; target: string; actor: string; created_at: string }[]
}

const EMPTY: DashboardData = { stats: { knowledge_bases: 0, documents: 0, queries_this_month: 0, members: 0 }, trend: [], top_knowledge_bases: [], activity: [] }

export default function Dashboard({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { user } = useAuth()
  const [data, setData] = useState(EMPTY)
  const [error, setError] = useState('')
  useEffect(() => { api.get<DashboardData>('/api/dashboard').then(setData).catch(e => setError(e.message)) }, [])
  const max = Math.max(1, ...data.trend.map(item => item.count))
  const stats = [
    { label: '知识库总数', value: data.stats.knowledge_bases, color: 'var(--color-cyan)', icon: '▤' },
    { label: '文档总量', value: data.stats.documents, color: 'var(--color-blue)', icon: '▧' },
    { label: '本月问答次数', value: data.stats.queries_this_month, color: 'var(--color-violet)', icon: '◌' },
    { label: '团队成员', value: data.stats.members, color: 'var(--color-green)', icon: '♙' },
  ]
  const actions = [
    { label: '新建知识库', target: 'kbs/new', icon: '+', color: 'var(--color-cyan)' },
    { label: '上传文档', target: 'docs', icon: '↑', color: 'var(--color-blue)' },
    { label: '开始问答', target: 'chat', icon: '✳', color: 'var(--color-violet)' },
    { label: '团队管理', target: 'team', icon: '♙', color: 'var(--color-amber)' },
  ]
  return (
    <div className="flex-1 overflow-y-auto animate-fade-in" style={{ padding: '24px 28px' }}>
      <div className="flex items-start justify-between mb-8">
        <div><h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.5rem' }}>你好，{user?.nickname || user?.username} 👋</h1><p className="text-sm mt-1" style={{ color: 'var(--color-text-2)' }}>这是你的企业知识库概览</p></div>
        <button onClick={() => onNavigate('kbs/new')} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: 'var(--color-cyan)', color: 'var(--color-text-inv)' }}>＋ 新建知识库</button>
      </div>
      {error && <div className="mb-4 text-sm" style={{ color: 'var(--color-red)' }}>{error}</div>}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map(item => <div key={item.label} className="rounded-xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}><div className="flex justify-between items-center"><span className="text-xs" style={{ color: 'var(--color-text-3)' }}>{item.label}</span><span style={{ color: item.color }}>{item.icon}</span></div><div className="mt-3 text-3xl font-bold" style={{ color: item.color }}>{item.value.toLocaleString()}</div></div>)}
      </div>
      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <section className="lg:col-span-2 rounded-xl p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <h2 className="font-semibold mb-5">本周问答趋势</h2>
          <div className="flex items-end gap-2 h-36">{data.trend.map((item, index) => <div key={item.date} className="flex-1 h-full flex flex-col justify-end items-center gap-2"><div className="w-full rounded-t-md" title={`${item.count} 次`} style={{ height: `${Math.max(3, item.count / max * 100)}%`, background: index === data.trend.length - 1 ? 'var(--color-cyan)' : 'var(--color-surface-3)' }} /><span className="text-xs" style={{ color: 'var(--color-text-3)' }}>{item.date.slice(5)}</span></div>)}</div>
        </section>
        <section className="rounded-xl p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}><h2 className="font-semibold mb-4">快捷操作</h2><div className="space-y-2">{actions.map(item => <button key={item.label} onClick={() => onNavigate(item.target)} className="w-full flex items-center gap-3 p-3 rounded-lg text-left" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}><span style={{ color: item.color }}>{item.icon}</span><span className="text-sm">{item.label}</span><span className="ml-auto" style={{ color: 'var(--color-text-3)' }}>→</span></button>)}</div></section>
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <section className="rounded-xl p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}><div className="flex justify-between mb-4"><h2 className="font-semibold">热门知识库</h2><button className="text-xs" style={{ color: 'var(--color-cyan)' }} onClick={() => onNavigate('kbs')}>查看全部 →</button></div><div className="space-y-4">{data.top_knowledge_bases.map((kb, index) => <button key={kb.id} className="w-full flex items-center gap-3 text-left" onClick={() => onNavigate(`kbs/${kb.id}`)}><span style={{ color: ['var(--color-cyan)', 'var(--color-blue)', 'var(--color-violet)', 'var(--color-amber)', 'var(--color-green)'][index % 5] }}>●</span><span className="flex-1 min-w-0"><span className="block text-sm truncate">{kb.name}</span><span className="text-xs" style={{ color: 'var(--color-text-3)' }}>{kb.document_count} 份文档 · {kb.query_count} 次问答</span></span></button>)}{!data.top_knowledge_bases.length && <p className="text-sm" style={{ color: 'var(--color-text-3)' }}>还没有知识库，先创建一个吧。</p>}</div></section>
        <section className="rounded-xl p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}><h2 className="font-semibold mb-4">最近动态</h2><div className="space-y-3">{data.activity.map((event, i) => <div key={`${event.type}-${i}`} className="flex gap-3 text-sm"><span style={{ color: 'var(--color-cyan)' }}>{event.type === 'upload' ? '↑' : '+'}</span><span className="min-w-0"><b>{event.actor}</b><span style={{ color: 'var(--color-text-2)' }}>{event.type === 'upload' ? ' 上传了 ' : ' 创建了 '}</span><span>{event.target}</span><span className="block text-xs mt-1" style={{ color: 'var(--color-text-3)' }}>{String(event.created_at).slice(0, 16).replace('T', ' ')}</span></span></div>)}{!data.activity.length && <p className="text-sm" style={{ color: 'var(--color-text-3)' }}>暂无活动</p>}</div></section>
      </div>
    </div>
  )
}
