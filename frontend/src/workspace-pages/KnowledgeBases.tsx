import { useEffect, useState } from 'react'
import { api, uploadDocument } from '../api/client'
import type { Document, KnowledgeBase } from '../api/types'
import { useAuth } from '../store/auth'

type Props = { initialKbId?: string; showNew?: boolean; onNavigate: (page: string) => void }
type Preview = { document: Document; chunks: { chunk_index: number; content: string }[] }
type ModelInfo = { embedding_model: string; embedding_configured: boolean }
type KbMember = { user_id: string; username: string; email?: string | null; tenant_role: string; kb_role: 'editor' | 'reader' | null }

export default function KnowledgeBases({ initialKbId, showNew, onNavigate }: Props) {
  const { user } = useAuth()
  const [items, setItems] = useState<KnowledgeBase[]>([])
  const [selected, setSelected] = useState<KnowledgeBase | null>(null)
  const [docs, setDocs] = useState<Document[]>([])
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [wizard, setWizard] = useState(!!showNew && user?.role === 'admin')
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [preview, setPreview] = useState<Preview | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftDescription, setDraftDescription] = useState('')
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null)
  const [accessMode, setAccessMode] = useState<'tenant' | 'restricted'>('tenant')
  const [members, setMembers] = useState<KbMember[]>([])

  async function load() {
    const list = await api.get<KnowledgeBase[]>('/api/kbs')
    setItems(list)
    if (initialKbId) {
      const found = list.find(item => item.id === initialKbId)
      if (found) setSelected(found)
    }
  }
  useEffect(() => { load().catch(e => setError(e.message)); api.get<ModelInfo>('/api/models').then(setModelInfo).catch(() => {}) }, [])
  useEffect(() => {
    if (!selected) return
    setDraftName(selected.name); setDraftDescription(selected.description || '')
    api.get<Document[]>(`/api/kbs/${selected.id}/documents`).then(setDocs).catch(e => setError(e.message))
    if (user?.role === 'admin') api.get<{ access_mode: 'tenant' | 'restricted'; members: KbMember[] }>(`/api/kbs/${selected.id}/members`).then(result => { setAccessMode(result.access_mode); setMembers(result.members) }).catch(e => setError(e.message))
  }, [selected?.id])

  async function createKnowledgeBase() {
    setBusy(true); setError('')
    try {
      const created = await api.post<KnowledgeBase>('/api/kbs', { name: name.trim(), description: description.trim() })
      setWizard(false); setStep(0); setName(''); setDescription(''); setFiles([])
      await load(); setSelected(created)
      onNavigate(`kbs/${created.id}`)
      const failures: string[] = []
      for (const file of files) {
        try { await uploadDocument(created.id, file) }
        catch (e) { failures.push(`${file.name}: ${e instanceof Error ? e.message : '导入失败'}`) }
      }
      setDocs(await api.get<Document[]>(`/api/kbs/${created.id}/documents`))
      if (failures.length) setError(`知识库已创建，以下文件导入失败：${failures.join('；')}`)
    } catch (e) { setError(e instanceof Error ? e.message : '创建失败') }
    finally { setBusy(false) }
  }
  async function uploadToSelected(list: FileList | null) {
    if (!selected || !list?.length) return
    setBusy(true); setError('')
    try { for (const file of Array.from(list)) await uploadDocument(selected.id, file); setDocs(await api.get<Document[]>(`/api/kbs/${selected.id}/documents`)); await load() }
    catch (e) { setError(e instanceof Error ? e.message : '上传失败') }
    finally { setBusy(false) }
  }
  async function saveDetails() {
    if (!selected) return
    setBusy(true); setError('')
    try { const updated = await api.patch<KnowledgeBase>(`/api/kbs/${selected.id}`, { name: draftName, description: draftDescription }); setSelected(updated); await load() }
    catch (e) { setError(e instanceof Error ? e.message : '保存失败') }
    finally { setBusy(false) }
  }
  async function removeKb() {
    if (!selected || !window.confirm(`确定删除知识库“${selected.name}”及其文档吗？`)) return
    try { await api.del(`/api/kbs/${selected.id}`); setSelected(null); onNavigate('kbs'); await load() }
    catch (e) { setError(e instanceof Error ? e.message : '删除失败') }
  }
  async function saveMemberAccess() {
    if (!selected) return
    setBusy(true); setError('')
    try {
      const selectedMembers = members.filter(member => member.kb_role).map(member => ({ user_id: member.user_id, role: member.kb_role }))
      const result = await api.put<{ access_mode: 'tenant' | 'restricted'; members: KbMember[] }>(`/api/kbs/${selected.id}/members`, { access_mode: accessMode, members: selectedMembers })
      setAccessMode(result.access_mode); setMembers(result.members)
    } catch (e) { setError(e instanceof Error ? e.message : '权限保存失败') }
    finally { setBusy(false) }
  }
  async function showPreview(doc: Document) {
    try { setPreview(await api.get<Preview>(`/api/documents/${doc.id}/preview`)) }
    catch (e) { setError(e instanceof Error ? e.message : '预览失败') }
  }

  const visible = items.filter(item => `${item.name} ${item.description || ''}`.toLowerCase().includes(search.toLowerCase()))
  const canEditSelected = !!selected && (user?.role === 'admin' || selected.access_role === 'editor')
  if (selected) return <div className="flex-1 overflow-y-auto p-6 animate-fade-in">
    <div className="flex items-center gap-2 text-sm mb-5" style={{ color: 'var(--color-text-3)' }}><button onClick={() => { setSelected(null); onNavigate('kbs') }} style={{ color: 'var(--color-cyan)' }}>知识库</button><span>›</span><span style={{ color: 'var(--color-text)' }}>{selected.name}</span></div>
    <section className="rounded-xl p-5 mb-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}><div className="flex items-start gap-4"><div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ color: 'var(--color-cyan)', background: 'var(--color-cyan-dim)' }}>▤</div><div className="flex-1"><h1 className="text-xl font-bold">{selected.name}</h1><p className="mt-1 text-sm" style={{ color: 'var(--color-text-2)' }}>{selected.description || '暂无描述'}</p><p className="mt-3 text-xs" style={{ color: 'var(--color-text-3)' }}>{docs.length} 份文档 · 创建于 {String(selected.created_at || '').slice(0, 10)}</p></div>{canEditSelected && <label className="px-3 py-2 rounded-lg text-sm cursor-pointer" style={{ background: 'var(--color-cyan)', color: 'var(--color-text-inv)' }}>＋ 上传文档<input type="file" multiple className="hidden" onChange={e => { void uploadToSelected(e.target.files); e.currentTarget.value = '' }} /></label>}</div></section>
    {error && <p className="mb-4 text-sm" style={{ color: 'var(--color-red)' }}>{error}</p>}
    <div className="grid xl:grid-cols-3 gap-4">
      <section className="xl:col-span-2 rounded-xl overflow-hidden" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}><div className="flex justify-between items-center p-4"><h2 className="font-semibold">文档列表</h2><span className="text-xs" style={{ color: 'var(--color-text-3)' }}>{busy ? '处理中…' : `${docs.length} 份`}</span></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr style={{ color: 'var(--color-text-3)', borderTop: '1px solid var(--color-border)' }}>{['文件名', '大小', '切片', '添加时间', '操作'].map(v => <th key={v} className="p-3 text-left text-xs">{v}</th>)}</tr></thead><tbody>{docs.map(doc => <tr key={doc.id} style={{ borderTop: '1px solid var(--color-border)' }}><td className="p-3">{doc.filename}</td><td className="p-3 text-xs" style={{ color: 'var(--color-text-3)' }}>{formatSize(doc.size)}</td><td className="p-3 text-xs">{doc.chunk_count}</td><td className="p-3 text-xs" style={{ color: 'var(--color-text-3)' }}>{String(doc.created_at).slice(0, 10)}</td><td className="p-3"><button onClick={() => showPreview(doc)} className="text-xs" style={{ color: 'var(--color-cyan)' }}>切片预览</button></td></tr>)}</tbody></table>{!docs.length && <p className="p-6 text-center text-sm" style={{ color: 'var(--color-text-3)' }}>此知识库还没有文档</p>}</div></section>
      <div className="space-y-4"><section className="rounded-xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}><h2 className="font-semibold mb-3">成员权限</h2>{user?.role === 'admin' ? <><label className="flex gap-2 items-center text-sm mb-3"><input type="radio" checked={accessMode === 'tenant'} onChange={() => setAccessMode('tenant')} />企业全员可访问</label><label className="flex gap-2 items-center text-sm mb-3"><input type="radio" checked={accessMode === 'restricted'} onChange={() => setAccessMode('restricted')} />仅指定成员可访问</label>{accessMode === 'restricted' && <div className="space-y-2 max-h-56 overflow-y-auto">{members.filter(member => member.tenant_role !== 'admin').map(member => <div key={member.user_id} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={!!member.kb_role} onChange={e => setMembers(old => old.map(item => item.user_id === member.user_id ? { ...item, kb_role: e.target.checked ? 'reader' : null } : item))} /><span className="flex-1 truncate">{member.username} {member.email ? `· ${member.email}` : ''}</span>{!!member.kb_role && <select value={member.kb_role} onChange={e => setMembers(old => old.map(item => item.user_id === member.user_id ? { ...item, kb_role: e.target.value as 'editor' | 'reader' } : item))} className="px-1 py-1 rounded" style={{ color: 'var(--color-text-2)', background: 'var(--color-surface-2)' }}><option value="editor">编辑</option><option value="reader">只读</option></select>}</div>)}</div>}<button disabled={busy} onClick={() => void saveMemberAccess()} className="mt-3 px-3 py-2 rounded-lg text-xs" style={{ color: 'var(--color-text-inv)', background: 'var(--color-cyan)' }}>保存访问权限</button></> : <p className="text-sm" style={{ color: 'var(--color-text-2)' }}>当前知识库由企业管理员配置访问成员。</p>}</section><section className="rounded-xl p-4 space-y-3" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}><h2 className="font-semibold">知识库参数</h2><label className="block text-xs" style={{ color: 'var(--color-text-2)' }}>名称<input value={draftName} onChange={e => setDraftName(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg text-sm" style={{ color: 'var(--color-text)', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }} /></label><label className="block text-xs" style={{ color: 'var(--color-text-2)' }}>描述<textarea value={draftDescription} onChange={e => setDraftDescription(e.target.value)} rows={3} className="mt-1 w-full px-3 py-2 rounded-lg text-sm" style={{ color: 'var(--color-text)', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }} /></label><button disabled={busy || user?.role !== 'admin'} onClick={() => void saveDetails()} className="px-3 py-2 rounded-lg text-sm" style={{ color: 'var(--color-text-inv)', background: 'var(--color-cyan)', opacity: user?.role === 'admin' ? 1 : .5 }}>保存设置</button>{user?.role === 'admin' && <button onClick={() => void removeKb()} className="ml-3 text-sm" style={{ color: 'var(--color-red)' }}>删除知识库</button>}</section></div>
    </div>
    {preview && <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,.55)' }}><aside className="w-full max-w-md h-full overflow-y-auto p-5" style={{ background: 'var(--color-surface)', borderLeft: '1px solid var(--color-border)' }}><div className="flex justify-between items-center mb-5"><h2 className="font-semibold">{preview.document.filename} · 切片预览</h2><button onClick={() => setPreview(null)}>关闭</button></div><div className="space-y-3">{preview.chunks.map(chunk => <article key={chunk.chunk_index} className="p-3 rounded-lg text-sm leading-6" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}><div className="text-xs mb-2" style={{ color: 'var(--color-cyan)' }}>片段 #{chunk.chunk_index + 1}</div>{chunk.content}</article>)}</div></aside></div>}
  </div>

  return <div className="flex-1 overflow-y-auto p-6 animate-fade-in">
    <div className="flex items-center justify-between mb-5"><div><h1 className="text-2xl font-bold">知识库</h1><p className="text-sm mt-1" style={{ color: 'var(--color-text-3)' }}>共 {items.length} 个知识库</p></div><div className="flex gap-2"><button onClick={() => setView('grid')} className="px-3 py-2 rounded-lg text-sm" style={{ color: view === 'grid' ? 'var(--color-cyan)' : 'var(--color-text-2)', background: 'var(--color-surface)' }}>网格</button><button onClick={() => setView('list')} className="px-3 py-2 rounded-lg text-sm" style={{ color: view === 'list' ? 'var(--color-cyan)' : 'var(--color-text-2)', background: 'var(--color-surface)' }}>列表</button>{user?.role === 'admin' && <button onClick={() => setWizard(true)} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ color: 'var(--color-text-inv)', background: 'var(--color-cyan)' }}>＋ 新建知识库</button>}</div></div>
    {error && <p className="mb-4 text-sm" style={{ color: 'var(--color-red)' }}>{error}</p>}
    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索知识库…" className="w-full max-w-md mb-5 px-3 py-2 rounded-lg text-sm" style={{ color: 'var(--color-text)', background: 'var(--color-surface)', border: '1px solid var(--color-border)' }} />
    <div className={view === 'grid' ? 'grid md:grid-cols-2 xl:grid-cols-3 gap-4' : 'space-y-3'}>{visible.map((item, index) => <button key={item.id} onClick={() => { setSelected(item); onNavigate(`kbs/${item.id}`) }} className={`text-left rounded-xl p-5 ${view === 'list' ? 'w-full flex items-center gap-4' : ''}`} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}><span className="text-2xl" style={{ color: ['var(--color-cyan)', 'var(--color-blue)', 'var(--color-violet)', 'var(--color-amber)'][index % 4] }}>▤</span><span className="block flex-1 min-w-0"><span className="block font-semibold truncate">{item.name}</span><span className="block mt-1 text-sm truncate" style={{ color: 'var(--color-text-3)' }}>{item.description || '暂无描述'}</span><span className="block mt-4 text-xs" style={{ color: 'var(--color-text-2)' }}>{item.document_count || 0} 份文档 · {String(item.created_at).slice(0, 10)}</span></span><span className="text-xs" style={{ color: 'var(--color-cyan)' }}>打开 →</span></button>)}{!visible.length && <div className="col-span-full rounded-xl p-10 text-center" style={{ background: 'var(--color-surface)', color: 'var(--color-text-3)' }}>没有匹配的知识库</div>}</div>
    {wizard && <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(7,11,18,.82)', backdropFilter: 'blur(6px)' }}><div className="w-full max-w-lg rounded-2xl p-6" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-md)' }}><div className="flex justify-between mb-5"><div><h2 className="font-semibold">新建知识库</h2><p className="text-xs mt-1" style={{ color: 'var(--color-text-3)' }}>步骤 {step + 1} / 3</p></div><button onClick={() => setWizard(false)}>关闭</button></div><div className="flex gap-2 mb-6">{['基本信息', '模型选择', '数据导入'].map((label, i) => <div className="flex-1" key={label}><div className="h-1 rounded" style={{ background: i <= step ? 'var(--color-cyan)' : 'var(--color-surface-3)' }} /><span className="text-xs" style={{ color: i === step ? 'var(--color-cyan)' : 'var(--color-text-3)' }}>{label}</span></div>)}</div>
      {step === 0 && <div className="space-y-4"><label className="block text-sm">知识库名称<input value={name} onChange={e => setName(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg" style={{ color: 'var(--color-text)', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }} /></label><label className="block text-sm">描述<textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="mt-1 w-full px-3 py-2 rounded-lg" style={{ color: 'var(--color-text)', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }} /></label></div>}
      {step === 1 && <div className="rounded-xl p-4" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-cyan)' }}><div className="text-sm font-medium">{modelInfo?.embedding_model || '正在读取服务器模型…'}</div><p className="text-xs mt-2" style={{ color: modelInfo?.embedding_configured ? 'var(--color-text-3)' : 'var(--color-amber)' }}>{modelInfo?.embedding_configured ? '使用服务端当前配置的嵌入模型，密钥仅保存在服务端。' : '尚未配置嵌入服务 API 密钥；上传文档前需要在服务器配置。'}</p></div>}
      {step === 2 && <label className="block rounded-xl p-8 text-center cursor-pointer" style={{ border: '1px dashed var(--color-border-md)', color: 'var(--color-text-2)' }}>选择或拖入需要导入的文件<input type="file" multiple accept=".pdf,.docx,.txt,.md" className="block mt-4 w-full text-xs" onChange={e => setFiles(Array.from(e.target.files || []))} /><span className="block mt-2 text-xs" style={{ color: 'var(--color-text-3)' }}>{files.length ? files.map(file => file.name).join('、') : 'PDF、DOCX、TXT、Markdown'}</span></label>}
      {error && <p className="mt-4 text-sm" style={{ color: 'var(--color-red)' }}>{error}</p>}<div className="flex justify-end gap-2 mt-6"><button onClick={() => step ? setStep(step - 1) : setWizard(false)} className="px-4 py-2 rounded-lg text-sm" style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-2)' }}>{step ? '上一步' : '取消'}</button><button disabled={busy || (step === 0 && !name.trim())} onClick={() => step < 2 ? setStep(step + 1) : void createKnowledgeBase()} className="px-4 py-2 rounded-lg text-sm" style={{ background: 'var(--color-cyan)', color: 'var(--color-text-inv)', opacity: busy ? .6 : 1 }}>{busy ? '创建中…' : step === 2 ? '创建并导入' : '下一步'}</button></div></div></div>}
  </div>
}

function formatSize(size: number) { if (size < 1024) return `${size} B`; if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`; return `${(size / 1024 / 1024).toFixed(1)} MB` }
