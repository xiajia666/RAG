import { useState } from 'react'

const ALL_DOCS = [
  { id: '1', name: '产品使用手册_v3.2.pdf', kb: '产品手册库', type: 'PDF', size: '12.4 MB', status: 'indexed', updated: '今天 14:32', pages: 187, uploader: '李梅' },
  { id: '2', name: '功能更新日志_2026Q3.docx', kb: '产品手册库', type: 'Word', size: '2.1 MB', status: 'indexed', updated: '今天 10:00', pages: 32, uploader: '张小明' },
  { id: '3', name: '客服常见问题汇总_v2.xlsx', kb: '客服FAQ', type: 'Excel', size: '1.3 MB', status: 'indexed', updated: '昨天 16:45', pages: 12, uploader: '陈雨' },
  { id: '4', name: '退换货政策说明_2026版.pdf', kb: '客服FAQ', type: 'PDF', size: '892 KB', status: 'indexed', updated: '昨天 11:20', pages: 8, uploader: '陈雨' },
  { id: '5', name: '劳动合同模板_标准版.docx', kb: '法务知识库', type: 'Word', size: '340 KB', status: 'indexed', updated: '9月23日', pages: 24, uploader: '赵磊' },
  { id: '6', name: '数据安全合规手册.pdf', kb: '法务知识库', type: 'PDF', size: '5.6 MB', status: 'indexed', updated: '9月22日', pages: 94, uploader: '赵磊' },
  { id: '7', name: '员工手册_2026修订版.pdf', kb: '人事制度库', type: 'PDF', size: '4.2 MB', status: 'indexed', updated: '9月21日', pages: 76, uploader: '王刚' },
  { id: '8', name: '接口设计规范v4.md', kb: '技术文档库', type: 'MD', size: '128 KB', status: 'indexing', updated: '今天 15:10', pages: 42, uploader: '张小明' },
  { id: '9', name: '产品路线图_2026.pptx', kb: '产品手册库', type: 'PPT', size: '24.6 MB', status: 'indexing', updated: '今天 15:05', pages: 45, uploader: '李梅' },
  { id: '10', name: '竞品分析报告_0921.pdf', kb: '市场调研库', type: 'PDF', size: '8.1 MB', status: 'error', updated: '9月20日', pages: 68, uploader: '王刚' },
]

const TYPE_COLORS: Record<string, string> = {
  PDF: 'var(--color-red)', Word: 'var(--color-blue)', Excel: 'var(--color-green)', PPT: 'var(--color-amber)', MD: 'var(--color-cyan)',
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  indexed:  { label: '已索引', color: 'var(--color-green)', bg: 'var(--color-green-dim)' },
  indexing: { label: '索引中', color: 'var(--color-amber)', bg: 'var(--color-amber-dim)' },
  error:    { label: '失败', color: 'var(--color-red)', bg: 'var(--color-red-dim)' },
}

const KBS = ['全部知识库', '产品手册库', '客服FAQ', '法务知识库', '人事制度库', '技术文档库', '市场调研库']
const TYPES = ['全部类型', 'PDF', 'Word', 'Excel', 'PPT', 'MD']

export default function Documents() {
  const [search, setSearch] = useState('')
  const [kbFilter, setKbFilter] = useState('全部知识库')
  const [typeFilter, setTypeFilter] = useState('全部类型')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [preview, setPreview] = useState<typeof ALL_DOCS[0] | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const filtered = ALL_DOCS.filter(d => {
    const matchSearch = d.name.toLowerCase().includes(search.toLowerCase())
    const matchKB = kbFilter === '全部知识库' || d.kb === kbFilter
    const matchType = typeFilter === '全部类型' || d.type === typeFilter
    return matchSearch && matchKB && matchType
  })

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="flex-1 flex overflow-hidden animate-fade-in">
      {/* Main */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '24px 28px' }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.4rem', letterSpacing: '-0.02em' }}>文档管理</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-3)' }}>{filtered.length} 份文档</p>
          </div>
          <label className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer" style={{ background: 'var(--color-cyan)', color: 'var(--color-text-inv)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/></svg>
            上传文档
            <input type="file" multiple className="hidden"/>
          </label>
        </div>

        {/* Upload drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false) }}
          className="rounded-xl border-2 border-dashed p-6 text-center mb-5 transition-all"
          style={{ borderColor: dragOver ? 'var(--color-cyan)' : 'var(--color-border)', background: dragOver ? 'var(--color-cyan-dim)' : 'transparent' }}
        >
          <div className="text-sm" style={{ color: dragOver ? 'var(--color-cyan)' : 'var(--color-text-3)' }}>
            {dragOver ? '松开鼠标上传文件' : '将文件拖拽到此处，或点击右上角上传按钮'}
          </div>
          <div className="text-xs mt-1" style={{ color: 'var(--color-text-3)' }}>支持 PDF · Word · Excel · PPT · Markdown · TXT，单文件最大 100MB</div>
        </div>

        {/* Filters & search */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg flex-1 min-w-48" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ color: 'var(--color-text-3)' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索文档名…" className="bg-transparent text-sm flex-1" style={{ color: 'var(--color-text)' }}/>
          </div>
          <select value={kbFilter} onChange={e => setKbFilter(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-2)' }}>
            {KBS.map(k => <option key={k}>{k}</option>)}
          </select>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-2)' }}>
            {TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>

        {/* Batch actions */}
        {selected.size > 0 && (
          <div className="flex items-center gap-3 mb-3 px-4 py-2 rounded-lg animate-fade-in" style={{ background: 'var(--color-cyan-dim)', border: '1px solid rgba(0,212,180,0.25)' }}>
            <span className="text-sm" style={{ color: 'var(--color-cyan)' }}>已选 {selected.size} 份</span>
            <button className="text-xs px-2 py-1 rounded" style={{ background: 'var(--color-surface)', color: 'var(--color-text-2)' }}>移动至知识库</button>
            <button className="text-xs px-2 py-1 rounded" style={{ background: 'var(--color-surface)', color: 'var(--color-text-2)' }}>重新索引</button>
            <button className="text-xs px-2 py-1 rounded" style={{ background: 'var(--color-red-dim)', color: 'var(--color-red)' }}>批量删除</button>
            <button className="ml-auto text-xs" style={{ color: 'var(--color-text-3)' }} onClick={() => setSelected(new Set())}>取消</button>
          </div>
        )}

        {/* Table */}
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
                <th className="px-4 py-3 w-10">
                  <input type="checkbox" onChange={e => e.target.checked ? setSelected(new Set(filtered.map(d => d.id))) : setSelected(new Set())}/>
                </th>
                {['文件名', '知识库', '大小', '状态', '上传者', '更新时间', '操作'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--color-text-3)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((doc) => (
                <tr key={doc.id} className="transition-colors cursor-pointer" style={{ borderBottom: '1px solid var(--color-border)', background: selected.has(doc.id) ? 'var(--color-cyan-dim)' : 'var(--color-surface)' }}
                  onMouseEnter={e => { if (!selected.has(doc.id)) (e.currentTarget as HTMLTableRowElement).style.background = 'var(--color-surface-2)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = selected.has(doc.id) ? 'var(--color-cyan-dim)' : 'var(--color-surface)' }}
                >
                  <td className="px-4 py-3" onClick={e => { e.stopPropagation(); toggleSelect(doc.id) }}>
                    <input type="checkbox" checked={selected.has(doc.id)} onChange={() => toggleSelect(doc.id)}/>
                  </td>
                  <td className="px-4 py-3" onClick={() => setPreview(doc)}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-1.5 py-0.5 rounded font-bold" style={{ background: TYPE_COLORS[doc.type] + '18', color: TYPE_COLORS[doc.type], fontFamily: 'var(--font-mono)' }}>{doc.type}</span>
                      <span className="truncate max-w-52">{doc.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--color-surface-3)', color: 'var(--color-text-2)' }}>{doc.kb}</span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-3)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{doc.size}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: STATUS_META[doc.status].bg, color: STATUS_META[doc.status].color, fontFamily: 'var(--font-mono)' }}>{STATUS_META[doc.status].label}</span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-3)' }}>{doc.uploader}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-3)', whiteSpace: 'nowrap' }}>{doc.updated}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3 text-xs">
                      <button style={{ color: 'var(--color-cyan)' }} onClick={() => setPreview(doc)}>预览</button>
                      <button style={{ color: 'var(--color-text-3)' }}>下载</button>
                      <button style={{ color: 'var(--color-red)' }}>删除</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Preview panel */}
      {preview && (
        <div className="w-72 flex flex-col shrink-0 animate-slide-right" style={{ background: 'var(--color-surface)', borderLeft: '1px solid var(--color-border)' }}>
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
            <span className="text-sm font-medium">文档详情</span>
            <button onClick={() => setPreview(null)} style={{ color: 'var(--color-text-3)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {/* File icon */}
            <div className="flex flex-col items-center py-6 rounded-xl" style={{ background: 'var(--color-surface-2)' }}>
              <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-3 text-lg font-bold" style={{ background: TYPE_COLORS[preview.type] + '18', color: TYPE_COLORS[preview.type] }}>{preview.type}</div>
              <div className="text-sm font-medium text-center px-4 leading-snug">{preview.name}</div>
            </div>
            {/* Meta */}
            {[
              { label: '所属知识库', value: preview.kb },
              { label: '文件大小', value: preview.size },
              { label: '页数', value: `${preview.pages} 页` },
              { label: '上传者', value: preview.uploader },
              { label: '最后更新', value: preview.updated },
              { label: '索引状态', value: STATUS_META[preview.status].label },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between text-sm">
                <span style={{ color: 'var(--color-text-3)' }}>{label}</span>
                <span style={{ color: 'var(--color-text-2)' }}>{value}</span>
              </div>
            ))}
            {/* Chunk preview */}
            <div>
              <div className="text-xs mb-2" style={{ color: 'var(--color-text-3)', fontFamily: 'var(--font-mono)' }}>切片预览（共 {Math.floor(preview.pages * 2.3)} 片）</div>
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="p-3 rounded-lg text-xs" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--color-text-2)', lineHeight: 1.6 }}>
                    <div className="text-xs mb-1" style={{ color: 'var(--color-text-3)', fontFamily: 'var(--font-mono)' }}>chunk #{i} · 第 {i * 3} 页</div>
                    这是文档第 {i * 3} 页的内容摘要，包含了该章节的关键信息和相关条款说明…
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="p-4 space-y-2" style={{ borderTop: '1px solid var(--color-border)' }}>
            <button className="w-full py-2 rounded-lg text-sm font-medium" style={{ background: 'var(--color-cyan)', color: 'var(--color-text-inv)' }}>重新索引</button>
            <button className="w-full py-2 rounded-lg text-sm" style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-2)' }}>下载原文件</button>
          </div>
        </div>
      )}
    </div>
  )
}
