const MONTH_DATA = [
  { label: '9月1日', queries: 320, docs: 12 },
  { label: '9月5日', queries: 580, docs: 28 },
  { label: '9月10日', queries: 490, docs: 15 },
  { label: '9月15日', queries: 820, docs: 40 },
  { label: '9月20日', queries: 710, docs: 22 },
  { label: '9月25日', queries: 960, docs: 35 },
]

const TOP_QUERIES = [
  { q: '如何申请退款？', count: 342, kb: '客服FAQ', trend: '+12%' },
  { q: '产品质保期多久？', count: 287, kb: '产品手册库', trend: '+5%' },
  { q: '合同违约责任如何界定？', count: 198, kb: '法务知识库', trend: '+28%' },
  { q: '年假如何计算？', count: 164, kb: '人事制度库', trend: '-3%' },
  { q: 'API 限流规则是什么？', count: 143, kb: '技术文档库', trend: '+41%' },
]

const KB_USAGE = [
  { name: '产品手册库', pct: 82, color: 'var(--color-cyan)' },
  { name: '客服FAQ', pct: 68, color: 'var(--color-blue)' },
  { name: '法务知识库', pct: 41, color: 'var(--color-violet)' },
  { name: '人事制度库', pct: 29, color: 'var(--color-amber)' },
  { name: '技术文档库', pct: 22, color: 'var(--color-green)' },
]

const SUMMARY = [
  { label: '本月总查询', value: '18,294', delta: '+28.4%', up: true },
  { label: '平均响应时长', value: '1.2s', delta: '-0.3s', up: true },
  { label: '无效回答率', value: '3.8%', delta: '-0.6%', up: true },
  { label: '活跃用户数', value: '47', delta: '+8', up: true },
]

export default function Analytics() {
  const maxQ = Math.max(...MONTH_DATA.map(d => d.queries))

  return (
    <div className="flex-1 overflow-y-auto animate-fade-in" style={{ padding: '24px 28px' }}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.4rem', letterSpacing: '-0.02em' }}>数据分析</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-3)' }}>2026年9月 · 实时更新</p>
        </div>
        <select className="text-sm px-3 py-2 rounded-lg" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-2)' }}>
          <option>本月</option>
          <option>上月</option>
          <option>最近90天</option>
        </select>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {SUMMARY.map(({ label, value, delta, up }) => (
          <div key={label} className="rounded-xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <div className="text-xs mb-2" style={{ color: 'var(--color-text-3)', fontFamily: 'var(--font-mono)' }}>{label}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.6rem', letterSpacing: '-0.02em', color: 'var(--color-text)' }}>{value}</div>
            <div className="text-xs mt-1" style={{ color: up ? 'var(--color-green)' : 'var(--color-red)', fontFamily: 'var(--font-mono)' }}>{up ? '↑' : '↓'} {delta}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        {/* Line / bar chart */}
        <div className="lg:col-span-2 rounded-xl p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.95rem', marginBottom: 20 }}>查询量趋势</div>
          <div className="relative h-40">
            {/* Y grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map(pct => (
              <div key={pct} className="absolute w-full" style={{ bottom: `${pct * 100}%`, borderTop: '1px dashed var(--color-border)', opacity: 0.5 }}>
                <span className="absolute -top-2.5 -left-1 text-xs" style={{ color: 'var(--color-text-3)', fontFamily: 'var(--font-mono)', fontSize: '0.6rem' }}>
                  {Math.round(pct * maxQ)}
                </span>
              </div>
            ))}
            {/* Bars */}
            <div className="absolute inset-0 flex items-end gap-1 pl-6">
              {MONTH_DATA.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                  <div className="w-full rounded-t-sm transition-all" title={`${d.queries} 次`} style={{ height: `${(d.queries / maxQ) * 100}%`, background: i === MONTH_DATA.length - 1 ? 'var(--color-cyan)' : 'var(--color-surface-3)', minHeight: 4 }}/>
                  <span className="text-xs" style={{ color: 'var(--color-text-3)', fontFamily: 'var(--font-mono)', fontSize: '0.6rem', whiteSpace: 'nowrap' }}>{d.label.replace('9月', '')}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* KB usage */}
        <div className="rounded-xl p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.95rem', marginBottom: 20 }}>知识库使用率</div>
          <div className="space-y-4">
            {KB_USAGE.map(({ name, pct, color }) => (
              <div key={name}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span style={{ color: 'var(--color-text-2)' }}>{name}</span>
                  <span style={{ color, fontFamily: 'var(--font-mono)' }}>{pct}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-3)' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top queries */}
      <div className="rounded-xl p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.95rem', marginBottom: 16 }}>热门问题 Top 5</div>
        <div className="space-y-2">
          {TOP_QUERIES.map(({ q, count, kb, trend }, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3 rounded-xl" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--color-text-3)', minWidth: 20 }}>#{i + 1}</span>
              <span className="flex-1 text-sm">{q}</span>
              <span className="text-xs px-2 py-0.5 rounded-full shrink-0" style={{ background: 'var(--color-surface-3)', color: 'var(--color-text-2)' }}>{kb}</span>
              <span className="text-xs shrink-0" style={{ color: 'var(--color-text-3)', fontFamily: 'var(--font-mono)' }}>{count} 次</span>
              <span className="text-xs shrink-0" style={{ color: trend.startsWith('+') ? 'var(--color-green)' : 'var(--color-red)', fontFamily: 'var(--font-mono)' }}>{trend}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
