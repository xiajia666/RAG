import { useState } from 'react'

const NAV_LINKS = ['产品', '解决方案', '定价', '文档', '博客']

const FEATURES = [
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="#00e5c8" strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M2 17l10 5 10-5" stroke="#00e5c8" strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M2 12l10 5 10-5" stroke="#00e5c8" strokeWidth="1.5" strokeLinejoin="round"/>
      </svg>
    ),
    label: '语义检索引擎',
    desc: '基于向量嵌入的深度语义理解，跨越关键词局限，精准定位知识边界内的答案。',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="3" stroke="#00e5c8" strokeWidth="1.5"/>
        <circle cx="4" cy="6" r="2" stroke="#00e5c8" strokeWidth="1.5"/>
        <circle cx="20" cy="6" r="2" stroke="#00e5c8" strokeWidth="1.5"/>
        <circle cx="4" cy="18" r="2" stroke="#00e5c8" strokeWidth="1.5"/>
        <circle cx="20" cy="18" r="2" stroke="#00e5c8" strokeWidth="1.5"/>
        <path d="M6 7l4 3.5M18 7l-4 3.5M6 17l4-3.5M18 17l-4-3.5" stroke="#00e5c8" strokeWidth="1.2" strokeOpacity="0.6"/>
      </svg>
    ),
    label: '知识图谱融合',
    desc: '自动构建实体关联网络，将碎片文档转化为结构化知识图谱，提升推理链路深度。',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="7" height="5" rx="1" stroke="#00e5c8" strokeWidth="1.5"/>
        <rect x="14" y="3" width="7" height="5" rx="1" stroke="#00e5c8" strokeWidth="1.5"/>
        <rect x="3" y="16" width="7" height="5" rx="1" stroke="#00e5c8" strokeWidth="1.5"/>
        <rect x="14" y="16" width="7" height="5" rx="1" stroke="#00e5c8" strokeWidth="1.5"/>
        <path d="M6.5 8v3M17.5 8v3M12 11H6.5M12 11h5.5M12 11v5" stroke="#00e5c8" strokeWidth="1.2" strokeOpacity="0.7"/>
      </svg>
    ),
    label: '多源文档接入',
    desc: '兼容 PDF、Word、Notion、Confluence、网页等 40+ 数据源，统一索引，一键同步。',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#00e5c8" strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M9 12l2 2 4-4" stroke="#00e5c8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    label: '权限隔离沙箱',
    desc: '数据在私有环境中处理，端到端加密存储，满足金融、医疗、政务等合规要求。',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke="#00e5c8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    label: '实时增量更新',
    desc: '文档变更后秒级同步至向量库，知识库始终保持最新状态，无需手动重建索引。',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="#00e5c8" strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M8 10h8M8 14h5" stroke="#00e5c8" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.7"/>
      </svg>
    ),
    label: '溯源引用标注',
    desc: '每条回答附带精确来源段落与置信度分数，AI 不再是黑盒，每个结论有据可查。',
  },
]

const STATS = [
  { value: '98.4%', label: '检索准确率' },
  { value: '<120ms', label: '平均响应延迟' },
  { value: '10亿+', label: '日处理 Token 量' },
  { value: '500+', label: '企业级客户' },
]

const PLANS = [
  {
    name: '开发者',
    price: '免费',
    period: '',
    desc: '适合个人开发者探索与原型验证',
    features: ['5 个知识库', '100MB 文档存储', '每月 10,000 次查询', '社区支持', 'REST API 接入'],
    cta: '立即开始',
    highlighted: false,
  },
  {
    name: '专业版',
    price: '¥599',
    period: '/月',
    desc: '适合成长型团队与业务场景落地',
    features: ['无限知识库', '50GB 文档存储', '每月 500,000 次查询', '优先邮件支持', '高级向量模型', 'Webhook & SDK', '数据分析面板'],
    cta: '开始免费试用',
    highlighted: true,
  },
  {
    name: '企业版',
    price: '定制',
    period: '',
    desc: '私有部署、合规审计、专属 SLA',
    features: ['私有化部署方案', '不限存储容量', '无限查询次数', '24/7 专属客服', '自定义嵌入模型', 'SSO / LDAP 集成', '审计日志 & 合规'],
    cta: '联系销售',
    highlighted: false,
  },
]

const STEPS = [
  { num: '01', title: '上传文档', desc: '拖拽上传 PDF、Word、网页链接，或通过 API 批量导入，系统自动解析结构。' },
  { num: '02', title: '向量索引', desc: '文档被切片、嵌入，生成高维语义向量，构建可检索的知识空间。' },
  { num: '03', title: '智能检索', desc: '用户提问后，系统召回最相关片段，结合大语言模型生成精准有据的答案。' },
]

// Neural network SVG illustration
function NeuralGraph() {
  const nodes = [
    { cx: 80, cy: 120 }, { cx: 80, cy: 200 }, { cx: 80, cy: 280 },
    { cx: 220, cy: 80 }, { cx: 220, cy: 160 }, { cx: 220, cy: 240 }, { cx: 220, cy: 320 },
    { cx: 360, cy: 120 }, { cx: 360, cy: 200 }, { cx: 360, cy: 280 },
    { cx: 480, cy: 160 }, { cx: 480, cy: 240 },
  ]
  const edges = [
    [0,3],[0,4],[1,3],[1,4],[1,5],[2,4],[2,5],[2,6],
    [3,7],[3,8],[4,7],[4,8],[4,9],[5,8],[5,9],[6,8],[6,9],
    [7,10],[7,11],[8,10],[8,11],[9,11],
  ]
  return (
    <svg viewBox="0 0 560 400" className="w-full h-full" fill="none">
      <defs>
        <radialGradient id="nodeGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#00e5c8" stopOpacity="0.9"/>
          <stop offset="100%" stopColor="#00e5c8" stopOpacity="0.3"/>
        </radialGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      {edges.map(([a, b], i) => (
        <line
          key={i}
          x1={nodes[a].cx} y1={nodes[a].cy}
          x2={nodes[b].cx} y2={nodes[b].cy}
          stroke="#00e5c8" strokeOpacity="0.12" strokeWidth="1"
        />
      ))}
      {nodes.map((n, i) => (
        <g key={i}>
          <circle cx={n.cx} cy={n.cy} r="14" fill="rgba(0,229,200,0.06)" stroke="#00e5c8" strokeOpacity="0.3" strokeWidth="1"/>
          <circle cx={n.cx} cy={n.cy} r="5" fill="url(#nodeGrad)" filter="url(#glow)"/>
        </g>
      ))}
      <rect x="190" y="130" width="60" height="30" rx="4" fill="rgba(0,229,200,0.08)" stroke="#00e5c8" strokeOpacity="0.3" strokeWidth="1"/>
      <text x="220" y="150" textAnchor="middle" fill="#00e5c8" fontSize="9" fontFamily="JetBrains Mono">EMBED</text>
      <rect x="330" y="170" width="60" height="30" rx="4" fill="rgba(0,229,200,0.08)" stroke="#00e5c8" strokeOpacity="0.3" strokeWidth="1"/>
      <text x="360" y="190" textAnchor="middle" fill="#00e5c8" fontSize="9" fontFamily="JetBrains Mono">RETRIEV</text>
    </svg>
  )
}

function QueryDemo() {
  const [query, setQuery] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const MOCK_ANSWERS: Record<string, string> = {
    default: '根据知识库中的 3 份文档（合同_v2.pdf · 第4页，技术规范.docx · 第12页，会议纪要_0921.md · 第2段），检索到 **置信度 94.7%** 的相关内容：\n\n该条款明确规定了数据处理的合规边界，适用于跨境数据传输场景下的主合同附件约定…',
  }

  const handleSearch = () => {
    if (!query.trim()) return
    setLoading(true)
    setAnswer(null)
    setTimeout(() => {
      setLoading(false)
      setAnswer(MOCK_ANSWERS.default)
    }, 1400)
  }

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
      <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}>
        <div className="w-2 h-2 rounded-full bg-red-500 opacity-60"/>
        <div className="w-2 h-2 rounded-full bg-yellow-500 opacity-60"/>
        <div className="w-2 h-2 rounded-full" style={{ background: 'var(--color-cyan)', opacity: 0.6 }}/>
        <span className="ml-2 text-xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-muted)' }}>knowledge-query.ts</span>
      </div>
      <div className="p-5 space-y-4">
        <div className="flex gap-2">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="向知识库提问，例如：合同中的数据条款如何规定？"
            className="flex-1 px-4 py-2.5 rounded-lg text-sm outline-none transition-all"
            style={{
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border-strong)',
              color: 'var(--color-text)',
              fontFamily: 'var(--font-body)',
            }}
          />
          <button
            onClick={handleSearch}
            className="px-4 py-2.5 rounded-lg text-sm font-medium transition-all"
            style={{ background: 'var(--color-cyan)', color: '#080c14', fontFamily: 'var(--font-body)' }}
          >
            检索
          </button>
        </div>
        {loading && (
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-muted-2)', fontFamily: 'var(--font-mono)' }}>
            <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--color-cyan)' }}/>
            正在向量检索 · 召回中…
          </div>
        )}
        {answer && (
          <div className="rounded-lg p-4 text-sm leading-relaxed" style={{ background: 'rgba(0,229,200,0.05)', border: '1px solid rgba(0,229,200,0.15)', color: 'var(--color-muted-2)', fontFamily: 'var(--font-body)' }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(0,229,200,0.12)', color: 'var(--color-cyan)', fontFamily: 'var(--font-mono)' }}>RAG · 3 sources</span>
            </div>
            <p style={{ color: 'var(--color-text)' }}>{answer.split('**置信度 94.7%**')[0]}<strong style={{ color: 'var(--color-cyan)' }}>置信度 94.7%</strong>{answer.split('**置信度 94.7%**')[1]}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function App() {
  const [activeNav, setActiveNav] = useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div style={{ background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-body)' }} className="min-h-screen overflow-x-hidden">

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 py-4" style={{ backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--color-border)', background: 'rgba(8,12,20,0.85)' }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: 'var(--color-cyan)' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="3" fill="#080c14"/>
              <path d="M8 2v1M8 13v1M2 8h1M13 8h1M4.22 4.22l.7.7M11.08 11.08l.7.7M11.08 4.22l-.7.7M4.22 11.08l-.7.7" stroke="#080c14" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem', color: 'var(--color-text)', letterSpacing: '-0.02em' }}>NeuralRAG</span>
        </div>

        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map(link => (
            <a key={link} href="#" className="text-sm transition-colors" style={{ color: activeNav === link ? 'var(--color-cyan)' : 'var(--color-muted-2)' }} onMouseEnter={() => setActiveNav(link)} onMouseLeave={() => setActiveNav(null)}>{link}</a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <button className="text-sm px-4 py-2 rounded-lg transition-all" style={{ color: 'var(--color-muted-2)', border: '1px solid var(--color-border)' }}>登录</button>
          <button className="text-sm px-4 py-2 rounded-lg font-medium transition-all" style={{ background: 'var(--color-cyan)', color: '#080c14' }}>免费开始</button>
        </div>

        <button className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)} style={{ color: 'var(--color-muted-2)' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
        </button>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 pt-16" style={{ background: 'rgba(8,12,20,0.97)', backdropFilter: 'blur(20px)' }}>
          <div className="flex flex-col items-center gap-6 pt-10">
            {NAV_LINKS.map(link => (
              <a key={link} href="#" className="text-lg" style={{ color: 'var(--color-muted-2)' }} onClick={() => setMobileOpen(false)}>{link}</a>
            ))}
            <button className="mt-4 px-8 py-3 rounded-xl font-medium" style={{ background: 'var(--color-cyan)', color: '#080c14', fontFamily: 'var(--font-display)' }}>免费开始</button>
          </div>
        </div>
      )}

      {/* HERO */}
      <section className="relative pt-32 pb-20 md:pt-44 md:pb-32 px-6 md:px-12 overflow-hidden">
        {/* Background glow blobs */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full opacity-20 pointer-events-none" style={{ background: 'radial-gradient(ellipse, rgba(0,229,200,0.3) 0%, transparent 70%)', filter: 'blur(60px)' }}/>
        <div className="absolute top-40 right-0 w-[300px] h-[300px] rounded-full opacity-10 pointer-events-none" style={{ background: 'radial-gradient(ellipse, #3b6fd4 0%, transparent 70%)', filter: 'blur(80px)' }}/>

        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs" style={{ border: '1px solid rgba(0,229,200,0.25)', background: 'rgba(0,229,200,0.07)', color: 'var(--color-cyan)', fontFamily: 'var(--font-mono)' }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--color-cyan)' }}/>
              v2.4 · 支持 Llama 3.1 & GPT-4o
            </div>

            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(2.2rem, 5vw, 3.8rem)', lineHeight: 1.1, letterSpacing: '-0.03em', color: 'var(--color-text)' }}>
              让企业知识库<br/>
              <span style={{ color: 'var(--color-cyan)' }}>真正</span>能被检索
            </h1>

            <p className="text-base leading-relaxed" style={{ color: 'var(--color-muted-2)', maxWidth: '480px' }}>
              NeuralRAG 将分散的文档转化为可查询的语义知识网络。接入你的数据源，10 分钟内部署企业级 RAG 问答系统。
            </p>

            <div className="flex flex-wrap gap-3">
              <button className="px-6 py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-90" style={{ background: 'var(--color-cyan)', color: '#080c14', fontFamily: 'var(--font-display)' }}>
                免费开始 →
              </button>
              <button className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm transition-all" style={{ border: '1px solid var(--color-border-strong)', color: 'var(--color-muted-2)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/><polygon points="10 8 16 12 10 16 10 8" fill="currentColor"/></svg>
                观看演示
              </button>
            </div>

            <div className="flex items-center gap-6 pt-2">
              {[['无需信用卡', true], ['私有部署可选', true], ['5 分钟接入', true]].map(([t]) => (
                <div key={t as string} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-muted)' }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#00e5c8" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  {t}
                </div>
              ))}
            </div>
          </div>

          <div className="relative h-72 md:h-96 animate-float">
            <NeuralGraph />
            {/* Floating chip labels */}
            <div className="absolute top-4 right-4 px-3 py-1.5 rounded-lg text-xs" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', fontFamily: 'var(--font-mono)', color: 'var(--color-cyan)' }}>
              sim: 0.9741
            </div>
            <div className="absolute bottom-6 left-0 px-3 py-1.5 rounded-lg text-xs" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', fontFamily: 'var(--font-mono)', color: 'var(--color-muted-2)' }}>
              chunks: 2,847
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="px-6 md:px-12 py-12" style={{ borderTop: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)' }}>
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map(({ value, label }) => (
            <div key={label} className="text-center">
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '2rem', color: 'var(--color-cyan)', letterSpacing: '-0.03em' }}>{value}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="px-6 md:px-12 py-20 md:py-28">
        <div className="max-w-6xl mx-auto">
          <div className="mb-16 max-w-xl">
            <div className="text-xs mb-3" style={{ color: 'var(--color-cyan)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>// HOW IT WORKS</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(1.6rem, 3.5vw, 2.6rem)', letterSpacing: '-0.03em', lineHeight: 1.2 }}>三步构建企业知识问答</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {STEPS.map(({ num, title, desc }) => (
              <div key={num} className="relative p-6 rounded-xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '3rem', fontWeight: 700, color: 'rgba(0,229,200,0.1)', lineHeight: 1, marginBottom: '1rem' }}>{num}</div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1.1rem', marginBottom: '0.5rem' }}>{title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--color-muted-2)' }}>{desc}</p>
                <div className="absolute top-4 right-4 w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-cyan)', opacity: 0.4 }}/>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DEMO */}
      <section className="px-6 md:px-12 py-12 md:py-20" style={{ background: 'var(--color-surface)' }}>
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <div className="text-xs mb-3" style={{ color: 'var(--color-cyan)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>// LIVE DEMO</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(1.6rem, 3.5vw, 2.4rem)', letterSpacing: '-0.03em' }}>亲自体验 RAG 检索</h2>
            <p className="mt-3 text-sm" style={{ color: 'var(--color-muted-2)' }}>向示例知识库提问，感受语义检索与引用溯源能力</p>
          </div>
          <QueryDemo />
        </div>
      </section>

      {/* FEATURES */}
      <section className="px-6 md:px-12 py-20 md:py-28">
        <div className="max-w-6xl mx-auto">
          <div className="mb-16 max-w-xl">
            <div className="text-xs mb-3" style={{ color: 'var(--color-cyan)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>// FEATURES</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(1.6rem, 3.5vw, 2.6rem)', letterSpacing: '-0.03em', lineHeight: 1.2 }}>为企业级 RAG 场景<br/>深度打磨</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(({ icon, label, desc }) => (
              <div key={label} className="group p-5 rounded-xl transition-all" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(0,229,200,0.25)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ background: 'rgba(0,229,200,0.08)' }}>{icon}</div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1rem', marginBottom: '0.5rem' }}>{label}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--color-muted-2)' }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="px-6 md:px-12 py-20 md:py-28" style={{ background: 'var(--color-surface)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="text-xs mb-3" style={{ color: 'var(--color-cyan)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>// PRICING</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(1.6rem, 3.5vw, 2.6rem)', letterSpacing: '-0.03em' }}>透明定价，按需扩展</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6 items-start">
            {PLANS.map(({ name, price, period, desc, features, cta, highlighted }) => (
              <div
                key={name}
                className="rounded-xl p-7 relative"
                style={{
                  background: highlighted ? 'linear-gradient(135deg, rgba(0,229,200,0.08) 0%, rgba(0,229,200,0.03) 100%)' : 'var(--color-bg)',
                  border: highlighted ? '1px solid rgba(0,229,200,0.3)' : '1px solid var(--color-border)',
                }}
              >
                {highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-medium" style={{ background: 'var(--color-cyan)', color: '#080c14', fontFamily: 'var(--font-mono)' }}>最受欢迎</div>
                )}
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1rem', marginBottom: '0.5rem' }}>{name}</div>
                <div className="flex items-end gap-0.5 mb-2">
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '2rem', color: highlighted ? 'var(--color-cyan)' : 'var(--color-text)', letterSpacing: '-0.03em' }}>{price}</span>
                  {period && <span className="mb-1 text-sm" style={{ color: 'var(--color-muted)' }}>{period}</span>}
                </div>
                <p className="text-sm mb-6" style={{ color: 'var(--color-muted-2)' }}>{desc}</p>
                <ul className="space-y-3 mb-8">
                  {features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm" style={{ color: 'var(--color-muted-2)' }}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7l3.5 3.5 6.5-6.5" stroke="#00e5c8" strokeWidth="1.5" strokeLinecap="round"/></svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    background: highlighted ? 'var(--color-cyan)' : 'transparent',
                    color: highlighted ? '#080c14' : 'var(--color-muted-2)',
                    border: highlighted ? 'none' : '1px solid var(--color-border-strong)',
                    fontFamily: 'var(--font-display)',
                  }}
                >
                  {cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA BANNER */}
      <section className="px-6 md:px-12 py-20 md:py-28 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, rgba(0,229,200,0.07) 0%, transparent 70%)' }}/>
        <div className="max-w-2xl mx-auto text-center relative">
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(1.8rem, 4vw, 3rem)', letterSpacing: '-0.03em', lineHeight: 1.15, marginBottom: '1.5rem' }}>
            让知识真正<br/>为你所用
          </h2>
          <p className="text-sm mb-8 leading-relaxed" style={{ color: 'var(--color-muted-2)' }}>
            加入 500+ 家企业，用 NeuralRAG 将沉睡文档转化为即时智能。无需 ML 背景，今天就可以上线。
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button className="px-8 py-3.5 rounded-xl font-semibold text-sm" style={{ background: 'var(--color-cyan)', color: '#080c14', fontFamily: 'var(--font-display)' }}>
              免费创建知识库
            </button>
            <button className="px-8 py-3.5 rounded-xl text-sm" style={{ border: '1px solid var(--color-border-strong)', color: 'var(--color-muted-2)' }}>
              预约技术演示
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="px-6 md:px-12 py-10" style={{ borderTop: '1px solid var(--color-border)' }}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'var(--color-cyan)' }}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="3" fill="#080c14"/><path d="M8 2v1M8 13v1M2 8h1M13 8h1" stroke="#080c14" strokeWidth="1.2" strokeLinecap="round"/></svg>
            </div>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.95rem' }}>NeuralRAG</span>
          </div>
          <div className="flex flex-wrap gap-6 text-xs" style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-body)' }}>
            {['隐私政策', '服务条款', '文档中心', 'GitHub', '联系我们'].map(l => (
              <a key={l} href="#" className="transition-colors hover:text-current">{l}</a>
            ))}
          </div>
          <div className="text-xs" style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>© 2026 NeuralRAG Inc.</div>
        </div>
      </footer>

    </div>
  )
}
