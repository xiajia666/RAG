import { useState } from 'react'

type KBStatus = 'active' | 'indexing' | 'error'

interface KB {
  id: string
  name: string
  desc: string
  docs: number
  queries: number
  size: string
  status: KBStatus
  updated: string
  color: string
  members: number
  tags: string[]
}

const KBS: KB[] = [
  { id: '1', name: '产品手册库', desc: '产品使用说明、版本更新日志、功能介绍文档', docs: 234, queries: 4821, size: '1.2 GB', status: 'active', updated: '今天 14:32', color: 'var(--color-cyan)', members: 8, tags: ['产品', '文档'] },
  { id: '2', name: '客服FAQ', desc: '常见问题解答、退换货政策、售后流程手册', docs: 156, queries: 3241, size: '342 MB', status: 'active', updated: '今天 09:15', color: 'var(--color-blue)', members: 5, tags: ['客服', 'FAQ'] },
  { id: '3', name: '法务知识库', desc: '合同模板、法律法规、合规审查要点', docs: 89, queries: 1832, size: '788 MB', status: 'active', updated: '昨天 18:00', color: 'var(--color-violet)', members: 3, tags: ['法务', '合规'] },
  { id: '4', name: '人事制度库', desc: '员工手册、绩效考核标准、薪酬福利政策', docs: 67, queries: 1204, size: '215 MB', status: 'active', updated: '9月23日', color: 'var(--color-amber)', members: 4, tags: ['HR', '制度'] },
  { id: '5', name: '技术文档库', desc: '接口文档、架构设计说明、开发规范', docs: 312, queries: 987, size: '2.1 GB', status: 'indexing', updated: '索引中…', color: 'var(--color-green)', members: 12, tags: ['技术', 'API'] },
  { id: '6', name: '市场调研库', desc: '竞品分析报告、市场调研数据、行业趋势', docs: 43, queries: 234, size: '890 MB', status: 'error', updated: '9月20日', color: 'var(--color-red)', members: 2, tags: ['市场', '分析'] },
]

const KB_DOCS = [
  { name: '产品使用手册_v3.2.pdf', size: '12.4 MB', type: 'PDF', status: 'indexed', updated: '今天 14:32', pages: 187 },
  { name: '功能更新日志_2026Q3.docx', size: '2.1 MB', type: 'Word', status: 'indexed', updated: '今天 10:00', pages: 32 },
  { name: 'API集成指南.pdf', size: '8.7 MB', type: 'PDF', status: 'indexed', updated: '昨天 16:45', pages: 94 },
  { name: '常见问题解答_v2.xlsx', size: '1.3 MB', type: 'Excel', status: 'indexed', updated: '昨天 11:20', pages: 12 },
  { name: '产品路线图_2026.pptx', size: '24.6 MB', type: 'PPT', status: 'indexing', updated: '正在索引…', pages: 45 },
  { name: '用户调研报告_0921.pdf', size: '5.2 MB', type: 'PDF', status: 'indexed', updated: '9月21日', pages: 68 },
]

const KB_MEMBERS = [
  { name: '张小明', avatar: '张', role: '管理员', joined: '2026-01-10', queries: 1243 },
  { name: '李梅', avatar: '李', role: '编辑', joined: '2026-03-22', queries: 876 },
  { name: '王刚', avatar: '王', role: '只读', joined: '2026-05-14', queries: 432 },
  { name: '陈雨', avatar: '陈', role: '编辑', joined: '2026-06-01', queries: 289 },
  { name: '赵磊', avatar: '赵', role: '只读', joined: '2026-08-30', queries: 104 },
]

const ROLE_COLORS: Record<string, string> = {
  '管理员': 'var(--color-cyan)',
  '编辑': 'var(--color-blue)',
  '只读': 'var(--color-text-3)',
}

const STATUS_MAP: Record<KBStatus, { label: string; color: string; bg: string }> = {
  active:   { label: '正常', color: 'var(--color-green)', bg: 'var(--color-green-dim)' },
  indexing: { label: '索引中', color: 'var(--color-amber)', bg: 'var(--color-amber-dim)' },
  error:    { label: '异常', color: 'var(--color-red)', bg: 'var(--color-red-dim)' },
}

const TYPE_COLORS: Record<string, string> = {
  PDF: 'var(--color-red)', Word: 'var(--color-blue)', Excel: 'var(--color-green)', PPT: 'var(--color-amber)',
}

// ── New KB Wizard ──────────────────────────────────────────────────────────
function NewKBWizard({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [model, setModel] = useState('text-embedding-3-large')
  const MODELS = ['text-embedding-3-large', 'text-embedding-3-small', '自定义模型']

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(7,11,18,0.85)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-lg rounded-2xl p-0 overflow-hidden animate-fade-in" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-md)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>新建知识库</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-3)' }}>步骤 {step + 1} / 3</div>
          </div>
          <button onClick={onClose} style={{ color: 'var(--color-text-3)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        {/* Steps indicator */}
        <div className="flex px-6 pt-5 gap-2 mb-6">
          {['基本信息', '选择模型', '导入数据'].map((s, i) => (
            <div key={s} className="flex-1 flex flex-col gap-1">
              <div className="h-1 rounded-full transition-all" style={{ background: i <= step ? 'var(--color-cyan)' : 'var(--color-surface-3)' }}/>
              <span className="text-xs" style={{ color: i === step ? 'var(--color-cyan)' : 'var(--color-text-3)' }}>{s}</span>
            </div>
          ))}
        </div>

        <div className="px-6 pb-6">
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs block mb-1.5" style={{ color: 'var(--color-text-2)' }}>知识库名称 *</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="例如：产品手册库" className="w-full px-3 py-2.5 rounded-lg text-sm" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border-md)', color: 'var(--color-text)' }}/>
              </div>
              <div>
                <label className="text-xs block mb-1.5" style={{ color: 'var(--color-text-2)' }}>描述</label>
                <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} placeholder="简要描述知识库用途…" className="w-full px-3 py-2.5 rounded-lg text-sm resize-none" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border-md)', color: 'var(--color-text)' }}/>
              </div>
              <div>
                <label className="text-xs block mb-2" style={{ color: 'var(--color-text-2)' }}>访问权限</label>
                <div className="flex gap-2">
                  {['仅自己', '团队', '企业全员'].map(p => (
                    <button key={p} className="flex-1 py-2 rounded-lg text-xs transition-all" style={{ background: p === '团队' ? 'var(--color-cyan-dim)' : 'var(--color-surface-2)', border: `1px solid ${p === '团队' ? 'rgba(0,212,180,0.3)' : 'var(--color-border)'}`, color: p === '团队' ? 'var(--color-cyan)' : 'var(--color-text-2)' }}>{p}</button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm" style={{ color: 'var(--color-text-2)' }}>选择用于生成向量嵌入的模型，影响检索质量和成本</p>
              {MODELS.map(m => (
                <button key={m} onClick={() => setModel(m)} className="w-full flex items-center gap-3 p-3.5 rounded-xl text-left transition-all" style={{ background: model === m ? 'var(--color-cyan-dim)' : 'var(--color-surface-2)', border: `1px solid ${model === m ? 'rgba(0,212,180,0.3)' : 'var(--color-border)'}` }}>
                  <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ border: `2px solid ${model === m ? 'var(--color-cyan)' : 'var(--color-text-3)'}` }}>
                    {model === m && <div className="w-2 h-2 rounded-full" style={{ background: 'var(--color-cyan)' }}/>}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{m}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-3)' }}>{m.includes('large') ? '高精度 · 推荐' : m.includes('small') ? '低成本 · 快速' : '联系销售获取'}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-center h-32 rounded-xl border-2 border-dashed text-sm" style={{ borderColor: 'var(--color-border-md)', color: 'var(--color-text-3)' }}>
                <div className="text-center">
                  <div className="mb-2">
                    <svg className="mx-auto" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/></svg>
                  </div>
                  拖拽文件或 <span style={{ color: 'var(--color-cyan)' }}>点击上传</span>
                  <div className="text-xs mt-1">支持 PDF · Word · Excel · Markdown · 网页</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {['Notion 同步', 'Confluence', 'Google Drive', '飞书文档'].map(s => (
                  <button key={s} className="px-3 py-1.5 rounded-lg text-xs transition-all" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text-2)' }}>
                    + {s}
                  </button>
                ))}
              </div>
              <p className="text-xs" style={{ color: 'var(--color-text-3)' }}>也可稍后添加，现在点击"完成"直接创建空白知识库</p>
            </div>
          )}

          <div className="flex gap-2 mt-6">
            {step > 0 && <button onClick={() => setStep(s => s - 1)} className="px-4 py-2 rounded-lg text-sm" style={{ border: '1px solid var(--color-border-md)', color: 'var(--color-text-2)' }}>上一步</button>}
            <button
              onClick={() => step < 2 ? setStep(s => s + 1) : onClose()}
              className="flex-1 py-2 rounded-lg text-sm font-medium"
              style={{ background: 'var(--color-cyan)', color: 'var(--color-text-inv)' }}
              disabled={step === 0 && !name}
            >
              {step < 2 ? '下一步' : '完成创建'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── KB Detail ──────────────────────────────────────────────────────────────
function KBDetail({ kb, onBack }: { kb: KB; onBack: () => void }) {
  const [tab, setTab] = useState<'docs' | 'members' | 'settings'>('docs')
  const [search, setSearch] = useState('')

  const TABS = [
    { id: 'docs', label: '文档列表' },
    { id: 'members', label: '成员权限' },
    { id: 'settings', label: '知识库设置' },
  ] as const

  const filtered = KB_DOCS.filter(d => d.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="flex-1 overflow-y-auto animate-fade-in" style={{ padding: '24px 28px' }}>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm mb-6" style={{ color: 'var(--color-text-3)' }}>
        <button onClick={onBack} style={{ color: 'var(--color-cyan)' }}>知识库</button>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
        <span style={{ color: 'var(--color-text)' }}>{kb.name}</span>
      </div>

      {/* KB Header */}
      <div className="rounded-xl p-5 mb-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: kb.color + '18', border: `1px solid ${kb.color}30` }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={kb.color} strokeWidth="1.8"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3"/></svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.2rem', letterSpacing: '-0.02em' }}>{kb.name}</h1>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: STATUS_MAP[kb.status].bg, color: STATUS_MAP[kb.status].color, fontFamily: 'var(--font-mono)' }}>{STATUS_MAP[kb.status].label}</span>
            </div>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-2)' }}>{kb.desc}</p>
            <div className="flex flex-wrap gap-4 mt-3 text-xs" style={{ color: 'var(--color-text-3)', fontFamily: 'var(--font-mono)' }}>
              <span>{kb.docs} 文档</span>
              <span>{kb.size}</span>
              <span>{kb.queries.toLocaleString()} 次查询</span>
              <span>更新于 {kb.updated}</span>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button className="px-3 py-1.5 rounded-lg text-xs" style={{ border: '1px solid var(--color-border-md)', color: 'var(--color-text-2)' }}>导出</button>
            <button className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: kb.color, color: 'var(--color-text-inv)' }}>+ 上传文档</button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 mb-5 rounded-lg overflow-hidden" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', display: 'inline-flex' }}>
        {TABS.map(({ id, label }) => (
          <button key={id} onClick={() => setTab(id)} className="px-4 py-2 text-sm transition-all" style={{ background: tab === id ? 'var(--color-surface-3)' : 'transparent', color: tab === id ? 'var(--color-cyan)' : 'var(--color-text-2)', fontWeight: tab === id ? 500 : 400 }}>
            {label}
          </button>
        ))}
      </div>

      {/* Tab: Docs */}
      {tab === 'docs' && (
        <div className="animate-fade-in">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ color: 'var(--color-text-3)' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索文档…" className="flex-1 bg-transparent text-sm" style={{ color: 'var(--color-text)' }}/>
            </div>
            <select className="px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-2)' }}>
              <option>全部类型</option>
              <option>PDF</option>
              <option>Word</option>
              <option>Excel</option>
            </select>
          </div>
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
                  {['文件名', '类型', '大小', '页数', '状态', '更新时间', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--color-text-3)', fontFamily: 'var(--font-mono)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((doc, i) => (
                  <tr key={i} className="transition-colors" style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-surface)')}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-1.5 py-0.5 rounded font-bold" style={{ background: TYPE_COLORS[doc.type] + '18', color: TYPE_COLORS[doc.type], fontFamily: 'var(--font-mono)' }}>{doc.type}</span>
                        <span className="truncate max-w-48">{doc.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--color-text-3)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{doc.type}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--color-text-3)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{doc.size}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--color-text-3)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{doc.pages}页</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: doc.status === 'indexed' ? 'var(--color-green-dim)' : 'var(--color-amber-dim)', color: doc.status === 'indexed' ? 'var(--color-green)' : 'var(--color-amber)', fontFamily: 'var(--font-mono)' }}>
                        {doc.status === 'indexed' ? '已索引' : '索引中'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-3)' }}>{doc.updated}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button className="text-xs" style={{ color: 'var(--color-cyan)' }}>预览</button>
                        <button className="text-xs" style={{ color: 'var(--color-text-3)' }}>删除</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Members */}
      {tab === 'members' && (
        <div className="animate-fade-in space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm" style={{ color: 'var(--color-text-2)' }}>共 {KB_MEMBERS.length} 位成员</p>
            <button className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'var(--color-cyan)', color: 'var(--color-text-inv)' }}>+ 邀请成员</button>
          </div>
          {KB_MEMBERS.map(({ name, avatar, role, joined, queries }) => (
            <div key={name} className="flex items-center gap-3 p-4 rounded-xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold shrink-0" style={{ background: 'var(--color-violet-dim)', color: 'var(--color-violet)', border: '1px solid rgba(139,92,246,0.2)' }}>{avatar}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: ROLE_COLORS[role] + '18', color: ROLE_COLORS[role], fontFamily: 'var(--font-mono)' }}>{role}</span>
                </div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-3)' }}>加入于 {joined} · {queries} 次查询</div>
              </div>
              <select className="text-xs px-2 py-1 rounded-lg" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text-2)' }}>
                <option>管理员</option>
                <option>编辑</option>
                <option>只读</option>
                <option>移除</option>
              </select>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Settings */}
      {tab === 'settings' && (
        <div className="animate-fade-in max-w-xl space-y-5">
          {[
            { label: '知识库名称', value: kb.name, type: 'text' },
            { label: '描述', value: kb.desc, type: 'textarea' },
          ].map(({ label, value, type }) => (
            <div key={label}>
              <label className="text-xs block mb-1.5" style={{ color: 'var(--color-text-2)' }}>{label}</label>
              {type === 'textarea'
                ? <textarea defaultValue={value} rows={3} className="w-full px-3 py-2.5 rounded-lg text-sm resize-none" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-md)', color: 'var(--color-text)' }}/>
                : <input defaultValue={value} className="w-full px-3 py-2.5 rounded-lg text-sm" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-md)', color: 'var(--color-text)' }}/>
              }
            </div>
          ))}
          <div>
            <label className="text-xs block mb-1.5" style={{ color: 'var(--color-text-2)' }}>切片大小（tokens）</label>
            <input type="range" min="256" max="2048" defaultValue={512} className="w-full"/>
            <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--color-text-3)', fontFamily: 'var(--font-mono)' }}>
              <span>256</span><span>512（当前）</span><span>2048</span>
            </div>
          </div>
          <div>
            <label className="text-xs block mb-2" style={{ color: 'var(--color-text-2)' }}>召回策略</label>
            <div className="flex gap-2">
              {['语义检索', '混合检索', '关键词检索'].map((s, i) => (
                <button key={s} className="flex-1 py-2 rounded-lg text-xs" style={{ background: i === 1 ? 'var(--color-cyan-dim)' : 'var(--color-surface)', border: `1px solid ${i === 1 ? 'rgba(0,212,180,0.3)' : 'var(--color-border)'}`, color: i === 1 ? 'var(--color-cyan)' : 'var(--color-text-2)' }}>{s}</button>
              ))}
            </div>
          </div>
          <button className="px-5 py-2 rounded-lg text-sm font-medium" style={{ background: 'var(--color-cyan)', color: 'var(--color-text-inv)' }}>保存设置</button>
          <div className="pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
            <div className="text-sm font-medium mb-1" style={{ color: 'var(--color-red)' }}>危险区域</div>
            <button className="px-4 py-2 rounded-lg text-sm" style={{ border: '1px solid var(--color-red)', color: 'var(--color-red)' }}>删除知识库</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── KB List ────────────────────────────────────────────────────────────────
export default function KnowledgeBases({ initialKbId, showNew, onNavigate }: { initialKbId?: string; showNew?: boolean; onNavigate: (p: string) => void }) {
  const [selectedKB, setSelectedKB] = useState<KB | null>(initialKbId ? KBS.find(k => k.id === initialKbId) ?? null : null)
  const [wizardOpen, setWizardOpen] = useState(!!showNew)
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'grid' | 'list'>('grid')

  const filtered = KBS.filter(kb =>
    kb.name.toLowerCase().includes(search.toLowerCase()) ||
    kb.desc.toLowerCase().includes(search.toLowerCase())
  )

  if (selectedKB) {
    return <KBDetail kb={selectedKB} onBack={() => setSelectedKB(null)} />
  }

  return (
    <div className="flex-1 overflow-y-auto animate-fade-in" style={{ padding: '24px 28px' }}>
      {wizardOpen && <NewKBWizard onClose={() => setWizardOpen(false)} />}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.4rem', letterSpacing: '-0.02em' }}>知识库</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-3)' }}>共 {KBS.length} 个知识库</p>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <button onClick={() => setView('grid')} className="p-1.5 rounded-md transition-all" style={{ background: view === 'grid' ? 'var(--color-surface-3)' : 'transparent', color: view === 'grid' ? 'var(--color-cyan)' : 'var(--color-text-3)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
            </button>
            <button onClick={() => setView('list')} className="p-1.5 rounded-md transition-all" style={{ background: view === 'list' ? 'var(--color-surface-3)' : 'transparent', color: view === 'list' ? 'var(--color-cyan)' : 'var(--color-text-3)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            </button>
          </div>
          <button onClick={() => setWizardOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium" style={{ background: 'var(--color-cyan)', color: 'var(--color-text-inv)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            新建
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg mb-6" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ color: 'var(--color-text-3)' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索知识库…" className="flex-1 bg-transparent text-sm" style={{ color: 'var(--color-text)' }}/>
      </div>

      {view === 'grid' ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(kb => (
            <div key={kb.id} onClick={() => setSelectedKB(kb)} className="rounded-xl p-5 cursor-pointer transition-all group" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = kb.color + '40')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: kb.color + '15', border: `1px solid ${kb.color}25` }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={kb.color} strokeWidth="1.8"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3"/></svg>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: STATUS_MAP[kb.status].bg, color: STATUS_MAP[kb.status].color, fontFamily: 'var(--font-mono)' }}>{STATUS_MAP[kb.status].label}</span>
              </div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.95rem', marginBottom: 6 }}>{kb.name}</h3>
              <p className="text-xs leading-relaxed mb-4" style={{ color: 'var(--color-text-2)' }}>{kb.desc}</p>
              <div className="flex gap-3 text-xs" style={{ color: 'var(--color-text-3)', fontFamily: 'var(--font-mono)' }}>
                <span>{kb.docs} 文档</span>
                <span>{kb.size}</span>
                <span>{kb.members} 成员</span>
              </div>
            </div>
          ))}
          {/* Add new card */}
          <button onClick={() => setWizardOpen(true)} className="rounded-xl p-5 flex flex-col items-center justify-center gap-2 transition-all h-48" style={{ border: '2px dashed var(--color-border)', color: 'var(--color-text-3)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(0,212,180,0.3)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-cyan)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-3)' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span className="text-sm">新建知识库</span>
          </button>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
          {filtered.map((kb, i) => (
            <div key={kb.id} onClick={() => setSelectedKB(kb)} className="flex items-center gap-4 px-5 py-4 cursor-pointer transition-all" style={{ background: 'var(--color-surface)', borderBottom: i < filtered.length - 1 ? '1px solid var(--color-border)' : 'none' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-surface)')}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: kb.color + '15' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={kb.color} strokeWidth="1.8"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3"/></svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{kb.name}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: STATUS_MAP[kb.status].bg, color: STATUS_MAP[kb.status].color, fontFamily: 'var(--font-mono)' }}>{STATUS_MAP[kb.status].label}</span>
                </div>
                <p className="text-xs truncate mt-0.5" style={{ color: 'var(--color-text-2)' }}>{kb.desc}</p>
              </div>
              <div className="flex gap-6 text-xs shrink-0" style={{ color: 'var(--color-text-3)', fontFamily: 'var(--font-mono)' }}>
                <span>{kb.docs} 文档</span>
                <span>{kb.queries.toLocaleString()} 查询</span>
                <span>{kb.updated}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
