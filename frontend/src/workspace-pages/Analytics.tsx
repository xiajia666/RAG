import { useEffect, useState } from 'react'
import { api } from '../api/client'

type AnalyticsData = {
  queries_this_month: number
  active_members: number
  trend: { date: string; count: number }[]
  knowledge_bases: { id: string; name: string; document_count: number; query_count: number }[]
  top_questions: { question: string; knowledge_base: string; count: number }[]
}

export default function Analytics() {
  const [data, setData] = useState<AnalyticsData>({ queries_this_month: 0, active_members: 0, trend: [], knowledge_bases: [], top_questions: [] })
  const [error, setError] = useState('')
  useEffect(() => { api.get<AnalyticsData>('/api/analytics').then(setData).catch(e => setError(e.message)) }, [])
  const max = Math.max(1, ...data.trend.map(item => item.count))
  const cards = [{ label: '本月总查询', value: data.queries_this_month }, { label: '活跃成员', value: data.active_members }, { label: '知识库数量', value: data.knowledge_bases.length }, { label: '热门问题', value: data.top_questions.length }]
  return <div className="flex-1 overflow-y-auto animate-fade-in" style={{ padding: '24px 28px' }}>
    <div className="mb-6"><h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.4rem' }}>数据分析</h1><p className="text-sm mt-1" style={{ color: 'var(--color-text-3)' }}>统计数据来自当前企业的真实问答与文档记录</p></div>
    {error && <p className="mb-4 text-sm" style={{ color: 'var(--color-red)' }}>{error}</p>}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">{cards.map(item => <div key={item.label} className="rounded-xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}><p className="text-xs" style={{ color: 'var(--color-text-3)' }}>{item.label}</p><p className="mt-2 text-2xl font-bold">{item.value.toLocaleString()}</p></div>)}</div>
    <div className="grid lg:grid-cols-3 gap-4 mb-4">
      <section className="lg:col-span-2 rounded-xl p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}><h2 className="font-semibold mb-5">查询量趋势</h2><div className="flex items-end gap-2 h-44">{data.trend.map(item => <div key={item.date} className="h-full flex-1 flex flex-col justify-end items-center gap-2"><div className="w-full rounded-t-sm" title={`${item.count} 次`} style={{ height: `${Math.max(item.count ? 4 : 1, item.count / max * 100)}%`, background: 'var(--color-cyan)' }} /><span className="text-xs" style={{ color: 'var(--color-text-3)' }}>{item.date.slice(5)}</span></div>)}</div></section>
      <section className="rounded-xl p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}><h2 className="font-semibold mb-5">知识库使用情况</h2><div className="space-y-4">{data.knowledge_bases.map(kb => { const pct = data.queries_this_month ? Math.round(kb.query_count / data.queries_this_month * 100) : 0; return <div key={kb.id}><div className="flex justify-between text-xs mb-1"><span>{kb.name}</span><span style={{ color: 'var(--color-cyan)' }}>{pct}% · {kb.query_count}</span></div><div className="h-1.5 rounded-full" style={{ background: 'var(--color-surface-3)' }}><div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: 'var(--color-cyan)' }} /></div></div> })}{!data.knowledge_bases.length && <p className="text-sm" style={{ color: 'var(--color-text-3)' }}>暂无数据</p>}</div></section>
    </div>
    <section className="rounded-xl p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}><h2 className="font-semibold mb-4">热门问题 Top 5</h2><div className="space-y-2">{data.top_questions.map((item, i) => <div key={`${item.question}-${i}`} className="flex items-center gap-3 px-3 py-3 rounded-lg" style={{ background: 'var(--color-surface-2)' }}><span className="text-xs" style={{ color: 'var(--color-text-3)' }}>#{i + 1}</span><span className="flex-1 text-sm">{item.question}</span><span className="text-xs px-2 py-1 rounded-full" style={{ background: 'var(--color-surface-3)', color: 'var(--color-text-2)' }}>{item.knowledge_base}</span><span className="text-xs" style={{ color: 'var(--color-cyan)' }}>{item.count} 次</span></div>)}{!data.top_questions.length && <p className="text-sm" style={{ color: 'var(--color-text-3)' }}>本月还没有问答记录</p>}</div></section>
  </div>
}
