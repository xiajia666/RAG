const STATS = [
  { label: '知识库总数', value: '12', delta: '+2', color: 'var(--color-cyan)', dimColor: 'var(--color-cyan-dim)', icon: <DBIcon /> },
  { label: '文档总量', value: '3,847', delta: '+124', color: 'var(--color-blue)', dimColor: 'var(--color-blue-dim)', icon: <DocIcon /> },
  { label: '本月问答次数', value: '18,294', delta: '+8.3%', color: 'var(--color-violet)', dimColor: 'var(--color-violet-dim)', icon: <ChatStatIcon /> },
  { label: '检索准确率', value: '96.2%', delta: '+0.4%', color: 'var(--color-green)', dimColor: 'var(--color-green-dim)', icon: <AccuracyIcon /> },
]

const RECENT_ACTIVITY = [
  { type: 'upload', user: '李梅', avatar: '李', action: '上传了 32 份合规文件至', target: '法务知识库', time: '10分钟前' },
  { type: 'query', user: '王刚', avatar: '王', action: '在', target: '产品手册库', time: '23分钟前', extra: '进行了问答' },
  { type: 'create', user: '张小明', avatar: '张', action: '创建了新知识库', target: '客服FAQ', time: '1小时前' },
  { type: 'share', user: '陈雨', avatar: '陈', action: '将', target: '人事制度库', time: '2小时前', extra: '分享给了团队' },
  { type: 'upload', user: '赵磊', avatar: '赵', action: '更新了', target: '技术文档库', time: '3小时前', extra: '中的 5 份文档' },
]

const TOP_KBS = [
  { name: '产品手册库', docs: 234, queries: 4821, rate: 97.3, color: 'var(--color-cyan)' },
  { name: '客服FAQ', docs: 156, queries: 3241, rate: 95.1, color: 'var(--color-blue)' },
  { name: '法务知识库', docs: 89, queries: 1832, rate: 98.8, color: 'var(--color-violet)' },
  { name: '人事制度库', docs: 67, queries: 1204, rate: 94.2, color: 'var(--color-amber)' },
]

const WEEK_DATA = [420, 580, 490, 710, 650, 920, 840]
const WEEK_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

const QUICK_ACTIONS = [
  { label: '新建知识库', desc: '从模板或空白开始', icon: <PlusIcon />, color: 'var(--color-cyan)' },
  { label: '上传文档', desc: '支持 PDF · Word · Excel', icon: <UploadIcon />, color: 'var(--color-blue)' },
  { label: '邀请成员', desc: '协作管理知识库', icon: <InviteIcon />, color: 'var(--color-violet)' },
  { label: '接入 API', desc: '嵌入到现有系统', icon: <ApiIcon />, color: 'var(--color-amber)' },
]

export default function Dashboard({ onNavigate }: { onNavigate: (p: string) => void }) {
  const maxQ = Math.max(...WEEK_DATA)

  return (
    <div className="flex-1 overflow-y-auto animate-fade-in" style={{ padding: '24px 28px' }}>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.5rem', letterSpacing: '-0.02em', marginBottom: 4 }}>
            早上好，张小明 👋
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-2)' }}>以下是你的知识库概览 · 2026年9月25日</p>
        </div>
        <button
          onClick={() => onNavigate('kbs/new')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
          style={{ background: 'var(--color-cyan)', color: 'var(--color-text-inv)' }}
        >
          <PlusIcon /> 新建知识库
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {STATS.map(({ label, value, delta, color, dimColor, icon }) => (
          <div key={label} className="rounded-xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: dimColor, color }}>{icon}</div>
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--color-green-dim)', color: 'var(--color-green)', fontFamily: 'var(--font-mono)' }}>{delta}</span>
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.5rem', color, letterSpacing: '-0.02em' }}>{value}</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-3)' }}>{label}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        {/* Weekly chart */}
        <div className="lg:col-span-2 rounded-xl p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.95rem' }}>本周问答趋势</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-3)' }}>次 / 天</div>
            </div>
            <div className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg" style={{ background: 'var(--color-cyan-dim)', color: 'var(--color-cyan)', fontFamily: 'var(--font-mono)' }}>
              ↑ 28.4% vs 上周
            </div>
          </div>
          <div className="flex items-end gap-2 h-28">
            {WEEK_DATA.map((v, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-t-md transition-all"
                  style={{
                    height: `${(v / maxQ) * 100}%`,
                    background: i === 5
                      ? 'var(--color-cyan)'
                      : 'var(--color-surface-3)',
                    minHeight: 4,
                  }}
                  title={`${v} 次`}
                />
                <span className="text-xs" style={{ color: 'var(--color-text-3)', fontFamily: 'var(--font-mono)', fontSize: '0.65rem' }}>{WEEK_LABELS[i]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div className="rounded-xl p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.95rem', marginBottom: 16 }}>快捷操作</div>
          <div className="space-y-2.5">
            {QUICK_ACTIONS.map(({ label, desc, icon, color }) => (
              <button
                key={label}
                className="w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all"
                style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-border-md)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
              >
                <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: color + '18', color }}>{icon}</div>
                <div>
                  <div className="text-sm font-medium" style={{ lineHeight: 1.3 }}>{label}</div>
                  <div className="text-xs" style={{ color: 'var(--color-text-3)' }}>{desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Top KBs */}
        <div className="rounded-xl p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <div className="flex items-center justify-between mb-4">
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.95rem' }}>热门知识库</div>
            <button className="text-xs" style={{ color: 'var(--color-cyan)' }} onClick={() => onNavigate('kbs')}>查看全部 →</button>
          </div>
          <div className="space-y-3">
            {TOP_KBS.map(({ name, docs, queries, rate, color }) => (
              <div key={name} className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color }}/>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm truncate">{name}</span>
                    <span className="text-xs ml-2 shrink-0" style={{ color, fontFamily: 'var(--font-mono)' }}>{rate}%</span>
                  </div>
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-3)' }}>
                    <div className="h-full rounded-full" style={{ width: `${rate}%`, background: color, opacity: 0.7 }}/>
                  </div>
                  <div className="flex gap-3 mt-1 text-xs" style={{ color: 'var(--color-text-3)', fontFamily: 'var(--font-mono)' }}>
                    <span>{docs} 文档</span>
                    <span>{queries.toLocaleString()} 次查询</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent activity */}
        <div className="rounded-xl p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.95rem', marginBottom: 16 }}>最近动态</div>
          <div className="space-y-3">
            {RECENT_ACTIVITY.map(({ user, avatar, action, target, time, extra }, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5" style={{ background: 'var(--color-violet-dim)', color: 'var(--color-violet)', border: '1px solid rgba(139,92,246,0.2)' }}>{avatar}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug">
                    <span className="font-medium">{user}</span>
                    <span style={{ color: 'var(--color-text-2)' }}> {action} </span>
                    <span style={{ color: 'var(--color-cyan)' }}>{target}</span>
                    {extra && <span style={{ color: 'var(--color-text-2)' }}> {extra}</span>}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-3)', fontFamily: 'var(--font-mono)' }}>{time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function DBIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3"/></svg> }
function DocIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> }
function ChatStatIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> }
function AccuracyIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> }
function PlusIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> }
function UploadIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/></svg> }
function InviteIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></svg> }
function ApiIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg> }
