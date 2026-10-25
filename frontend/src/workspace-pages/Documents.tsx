import { useEffect, useMemo, useState } from 'react'
import { api, downloadDocument, reparseDocument, type ParseMethod } from '../api/client'
import type { Document, KnowledgeBase } from '../api/types'
import { useAuth } from '../store/auth'
import ChunkingUploadFlow from '../components/ChunkingUploadFlow'

type ListedDocument = Document & { knowledge_base_name: string }
type Preview = { document: ListedDocument; chunks: { chunk_index: number; content: string }[] }
type UploadQueue = { kbId: string; files: File[] }

export default function Documents() {
  const { user } = useAuth()
  const [docs, setDocs] = useState<ListedDocument[]>([])
  const [kbs, setKbs] = useState<KnowledgeBase[]>([])
  const [search, setSearch] = useState('')
  const [kbFilter, setKbFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [preview, setPreview] = useState<Preview | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [drag, setDrag] = useState(false)
  const [uploadQueue, setUploadQueue] = useState<UploadQueue | null>(null)
  const [parseTarget, setParseTarget] = useState<ListedDocument | null>(null)
  const [parseMethod, setParseMethod] = useState<ParseMethod>('plain')
  const [parsing, setParsing] = useState(false)

  async function refresh() {
    const [documents, knowledgeBases] = await Promise.all([api.get<ListedDocument[]>('/api/documents'), api.get<KnowledgeBase[]>('/api/kbs')])
    setDocs(documents); setKbs(knowledgeBases)
  }
  useEffect(() => { refresh().catch(e => setError(e.message)) }, [])
  const filtered = useMemo(() => docs.filter(doc => doc.filename.toLowerCase().includes(search.toLowerCase()) && (!kbFilter || doc.kb_id === kbFilter) && (!typeFilter || extension(doc.filename) === typeFilter)), [docs, search, kbFilter, typeFilter])
  const writableKbs = kbs.filter(kb => kb.access_role === 'admin' || kb.access_role === 'editor')

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files)
    if (!list.length) return
    const targetKb = kbFilter || writableKbs[0]?.id
    if (!targetKb) { setError('请先创建知识库，再上传文档'); return }
    if (!writableKbs.some(kb => kb.id === targetKb)) { setError('你没有所选知识库的编辑权限'); return }
    setError('')
    setUploadQueue({ kbId: targetKb, files: list })
  }
  async function remove(ids: string[]) {
    const writableIds = new Set(writableKbs.map(kb => kb.id))
    if (user?.role !== 'admin' && ids.some(id => { const doc = docs.find(item => item.id === id); return !doc || !writableIds.has(doc.kb_id) })) { setError('所选文档中包含你没有编辑权限的知识库'); return }
    if (!ids.length || !window.confirm(`确定删除选中的 ${ids.length} 份文档吗？`)) return
    setBusy(true); setError('')
    try { if (ids.length === 1) await api.del(`/api/documents/${ids[0]}`); else await api.post('/api/documents/bulk-delete', { document_ids: ids }); setSelected(new Set()); setPreview(null); await refresh() }
    catch (e) { setError(e instanceof Error ? e.message : '删除失败') }
    finally { setBusy(false) }
  }
  async function showPreview(doc: ListedDocument) {
    try { setPreview(await api.get<Preview>(`/api/documents/${doc.id}/preview`)) }
    catch (e) { setError(e instanceof Error ? e.message : '加载预览失败') }
  }
  function openParse(doc: ListedDocument) {
    setParseMethod('plain')
    setParseTarget(doc)
    setError('')
  }
  async function doParse() {
    if (!parseTarget) return
    setParsing(true); setError('')
    try { await reparseDocument(parseTarget.id, parseMethod); setParseTarget(null); await refresh() }
    catch (e) { setError(e instanceof Error ? e.message : '解析失败') }
    finally { setParsing(false) }
  }

  return <div className="flex-1 flex overflow-hidden animate-fade-in">
    <main className="flex-1 overflow-y-auto p-6"><div className="flex items-center justify-between mb-5"><div><h1 className="text-2xl font-bold">文档管理</h1><p className="text-sm mt-1" style={{ color: 'var(--color-text-3)' }}>{filtered.length} 份文档</p></div><label className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer" style={{ background: 'var(--color-cyan)', color: 'var(--color-text-inv)', opacity: writableKbs.length ? 1 : .5 }}>{writableKbs.length ? '＋ 上传文档' : '无可编辑知识库'}<input type="file" multiple accept=".pdf,.docx,.txt,.md" disabled={!writableKbs.length} className="hidden" onChange={e => { if (e.target.files) void uploadFiles(e.target.files); e.currentTarget.value = '' }} /></label></div>
      <label onDragOver={e => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)} onDrop={e => { e.preventDefault(); setDrag(false); void uploadFiles(e.dataTransfer.files) }} className="block rounded-xl border-2 border-dashed p-6 text-center mb-5" style={{ borderColor: drag ? 'var(--color-cyan)' : 'var(--color-border)', background: drag ? 'var(--color-cyan-dim)' : 'transparent', color: 'var(--color-text-3)' }}><span className="text-sm">{busy ? '正在处理文档…' : '将文件拖到此处上传（上传到当前筛选的知识库或第一个知识库）'}</span><span className="block text-xs mt-1">支持 PDF、DOCX、TXT、Markdown</span></label>
      {error && <div className="mb-4 text-sm" style={{ color: 'var(--color-red)' }}>{error}</div>}
      <div className="flex flex-wrap gap-2 mb-4"><input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索文档名…" className="flex-1 min-w-48 px-3 py-2 rounded-lg text-sm" style={{ color: 'var(--color-text)', background: 'var(--color-surface)', border: '1px solid var(--color-border)' }} /><select value={kbFilter} onChange={e => setKbFilter(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={{ color: 'var(--color-text-2)', background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}><option value="">全部知识库</option>{kbs.map(kb => <option key={kb.id} value={kb.id}>{kb.name}</option>)}</select><select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={{ color: 'var(--color-text-2)', background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}><option value="">全部类型</option>{['PDF', 'DOCX', 'TXT', 'MD'].map(type => <option key={type}>{type}</option>)}</select></div>
      {!!selected.size && <div className="flex items-center gap-3 p-3 mb-3 rounded-lg" style={{ background: 'var(--color-cyan-dim)' }}><span className="text-sm" style={{ color: 'var(--color-cyan)' }}>已选 {selected.size} 份</span><button onClick={() => void remove([...selected])} className="text-sm" style={{ color: 'var(--color-red)' }}>批量删除</button><button onClick={() => setSelected(new Set())} className="ml-auto text-xs">取消</button></div>}
      <div className="rounded-xl overflow-x-auto" style={{ border: '1px solid var(--color-border)' }}><table className="w-full text-sm"><thead><tr style={{ background: 'var(--color-surface)', color: 'var(--color-text-3)' }}><th className="p-3"><input type="checkbox" checked={filtered.length > 0 && filtered.every(doc => selected.has(doc.id))} onChange={e => setSelected(e.target.checked ? new Set(filtered.map(doc => doc.id)) : new Set())} /></th>{['文件名', '知识库', '大小', '切片', '添加时间', '操作'].map(label => <th key={label} className="p-3 text-left text-xs">{label}</th>)}</tr></thead><tbody>{filtered.map(doc => <tr key={doc.id} style={{ borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)' }}><td className="p-3"><input type="checkbox" checked={selected.has(doc.id)} onChange={e => setSelected(old => { const next = new Set(old); e.target.checked ? next.add(doc.id) : next.delete(doc.id); return next })} /></td><td className="p-3 cursor-pointer" onClick={() => showPreview(doc)}>{doc.filename}<span className="mt-1 flex items-center gap-1.5"><span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: doc.chunk_count > 0 ? 'var(--color-green)' : 'var(--color-amber)' }} /><span className="text-xs" style={{ color: doc.chunk_count > 0 ? 'var(--color-green)' : 'var(--color-amber)' }}>{doc.chunk_count > 0 ? '已解析' : '未解析'}</span></span></td><td className="p-3 text-xs">{doc.knowledge_base_name}</td><td className="p-3 text-xs" style={{ color: 'var(--color-text-3)' }}>{formatSize(doc.size)}</td><td className="p-3 text-xs">{doc.chunk_count}</td><td className="p-3 text-xs" style={{ color: 'var(--color-text-3)' }}>{String(doc.created_at).slice(0, 10)}</td><td className="p-3"><div className="flex gap-3 text-xs"><button onClick={() => showPreview(doc)} style={{ color: 'var(--color-cyan)' }}>预览</button><button onClick={() => void downloadDocument(doc.id, doc.filename).catch(e => setError(e.message))} style={{ color: 'var(--color-text-2)' }}>下载</button><button disabled={user?.role !== 'admin' && !writableKbs.some(kb => kb.id === doc.kb_id)} onClick={() => openParse(doc)} style={{ color: 'var(--color-text-2)', opacity: user?.role !== 'admin' && !writableKbs.some(kb => kb.id === doc.kb_id) ? .4 : 1 }}>解析</button><button disabled={user?.role !== 'admin' && !writableKbs.some(kb => kb.id === doc.kb_id)} onClick={() => void remove([doc.id])} style={{ color: 'var(--color-red)' }}>删除</button></div></td></tr>)}</tbody></table>{!filtered.length && <p className="p-8 text-center text-sm" style={{ color: 'var(--color-text-3)' }}>暂无文档</p>}</div>
    </main>
    {preview && <aside className="flex min-h-0 w-80 max-w-[42vw] shrink-0 flex-col overflow-hidden p-4" style={{ background: 'var(--color-surface)', borderLeft: '1px solid var(--color-border)' }}><div className="mb-4 flex shrink-0 items-start justify-between gap-2"><div className="font-semibold break-all">{preview.document.filename}</div><button onClick={() => setPreview(null)} className="shrink-0 text-xs">关闭</button></div><div className="mb-5 shrink-0 space-y-2 text-xs" style={{ color: 'var(--color-text-3)' }}><p>知识库：{preview.document.knowledge_base_name}</p><p>大小：{formatSize(preview.document.size)}</p><p>切片：{preview.document.chunk_count}</p></div><h2 className="mb-3 shrink-0 text-sm font-medium">切片预览</h2><div className="min-h-0 flex-1 space-y-2 overflow-y-auto">{preview.chunks.map(chunk => <article key={chunk.chunk_index} className="rounded-lg p-3 text-xs leading-6" style={{ color: 'var(--color-text-2)', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}><div className="mb-1" style={{ color: 'var(--color-cyan)' }}>片段 #{chunk.chunk_index + 1}</div>{chunk.content}</article>)}</div></aside>}
    {parseTarget && <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ background: 'rgba(7,11,18,.82)', backdropFilter: 'blur(6px)' }}>
      <section className="w-full max-w-md overflow-hidden rounded-2xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-md)' }}>
        <header className="flex items-start justify-between gap-3 border-b p-4" style={{ borderColor: 'var(--color-border)' }}>
          <div className="min-w-0">
            <h3 className="text-base font-semibold">解析文档</h3>
            <p className="mt-1 truncate text-sm" style={{ color: 'var(--color-text-3)' }} title={parseTarget.filename}>{parseTarget.filename}</p>
          </div>
          <button onClick={() => setParseTarget(null)} className="shrink-0 text-sm" style={{ color: 'var(--color-text-3)' }}>关闭</button>
        </header>
        <div className="space-y-3 p-4">
          <p className="text-xs" style={{ color: 'var(--color-text-3)' }}>选择解析方式后重新解析；解析会重新提取文本并重建索引。</p>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl p-3.5" style={{ background: parseMethod === 'plain' ? 'var(--color-cyan-dim)' : 'var(--color-surface-2)', border: `1px solid ${parseMethod === 'plain' ? 'var(--color-cyan)' : 'var(--color-border)'}` }}>
            <input type="radio" name="parse-method" checked={parseMethod === 'plain'} onChange={() => setParseMethod('plain')} className="mt-0.5 accent-cyan-400" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">纯文本解析</span>
              <span className="mt-1 block text-xs leading-5" style={{ color: 'var(--color-text-3)' }}>直接提取文档内嵌文本，适合常规文字型 PDF / Word。</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl p-3.5" style={{ background: parseMethod === 'deepdoc' ? 'var(--color-cyan-dim)' : 'var(--color-surface-2)', border: `1px solid ${parseMethod === 'deepdoc' ? 'var(--color-cyan)' : 'var(--color-border)'}` }}>
            <input type="radio" name="parse-method" checked={parseMethod === 'deepdoc'} onChange={() => setParseMethod('deepdoc')} className="mt-0.5 accent-cyan-400" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-sm font-medium">DeepDocs 解析 <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ color: 'var(--color-amber)', background: 'var(--color-amber-dim)' }}>即将上线</span></span>
              <span className="mt-1 block text-xs leading-5" style={{ color: 'var(--color-text-3)' }}>版面分析 + OCR + 表格结构还原，适合扫描件、复杂排版。当前暂未开放。</span>
            </span>
          </label>
        </div>
        <footer className="flex justify-end gap-2 border-t p-4" style={{ borderColor: 'var(--color-border)' }}>
          <button onClick={() => setParseTarget(null)} className="rounded-lg px-4 py-2 text-sm" style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-2)' }}>取消</button>
          <button disabled={parsing} onClick={() => void doParse()} className="rounded-lg px-4 py-2 text-sm font-medium" style={{ color: 'var(--color-text-inv)', background: 'var(--color-cyan)', opacity: parsing ? .5 : 1 }}>{parsing ? '解析中…' : '确认解析'}</button>
        </footer>
      </section>
    </div>}
    {uploadQueue && <ChunkingUploadFlow key={uploadQueue.kbId} kbId={uploadQueue.kbId} files={uploadQueue.files} onClose={() => { setUploadQueue(null); void refresh().catch(e => setError(e.message)) }} onComplete={refresh} />}
  </div>
}

function extension(name: string) { const suffix = name.split('.').pop()?.toUpperCase() || ''; return suffix === 'DOC' ? 'DOCX' : suffix }
function formatSize(size: number) { if (size < 1024) return `${size} B`; if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`; return `${(size / 1024 / 1024).toFixed(1)} MB` }
