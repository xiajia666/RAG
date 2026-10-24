import { useEffect, useState } from 'react'
import { analyzeDocument, confirmAnalyzedDocument, previewDocumentChunks } from '../api/client'
import type { ChunkAnalysis, ChunkPreview, ChunkingStrategy } from '../api/client'

interface Props {
  kbId: string
  files: File[]
  onClose: () => void
  onComplete: () => void | Promise<void>
}

type Phase = 'analyzing' | 'previewing' | 'ready' | 'uploading' | 'error'

const inputStyle = {
  background: 'var(--color-surface-2)',
  color: 'var(--color-text)',
  border: '1px solid var(--color-border)',
}

export default function ChunkingUploadFlow({ kbId, files, onClose, onComplete }: Props) {
  const [fileIndex, setFileIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('analyzing')
  const [analysis, setAnalysis] = useState<ChunkAnalysis | null>(null)
  const [preview, setPreview] = useState<ChunkPreview | null>(null)
  const [previewedStrategy, setPreviewedStrategy] = useState('')
  const [strategy, setStrategy] = useState<ChunkingStrategy | null>(null)
  const [error, setError] = useState('')
  const [previewError, setPreviewError] = useState('')
  const file = files[fileIndex]
  const isLast = fileIndex === files.length - 1

  useEffect(() => {
    if (!file) return
    let active = true
    setPhase('analyzing')
    setAnalysis(null)
    setPreview(null)
    setPreviewedStrategy('')
    setStrategy(null)
    setError('')
    setPreviewError('')
    analyzeDocument(kbId, file)
      .then(result => {
        if (!active) return
        setAnalysis(result)
        setPreview({ estimated_chunk_count: result.estimated_chunk_count, preview: result.preview, warnings: result.warnings })
        setPreviewedStrategy(JSON.stringify(result.strategy))
        setStrategy(result.strategy)
        setPhase('ready')
      })
      .catch(reason => {
        if (!active) return
        setError(reason instanceof Error ? reason.message : '文档分析失败')
        setPhase('error')
      })
    return () => { active = false }
  }, [kbId, file])

  async function finish() {
    onClose()
    try { await onComplete() } catch { /* The upload is already complete; keep refresh errors out of upload retry flow. */ }
  }

  async function skipCurrent() {
    if (isLast) return finish()
    setFileIndex(index => index + 1)
  }

  async function confirmUpload() {
    if (!strategy || !analysis || isPreviewStale) return
    setPhase('uploading')
    setError('')
    try {
      if (!analysis?.analysis_id) throw new Error('分析结果缺少临时任务编号，请重新分析')
      await confirmAnalyzedDocument(kbId, analysis.analysis_id, strategy)
      if (isLast) await finish()
      else setFileIndex(index => index + 1)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '上传失败')
      setPhase('error')
    }
  }

  async function refreshPreview() {
    if (!analysis?.analysis_id || !strategy) return
    setPhase('previewing')
    setPreviewError('')
    try {
      const result = await previewDocumentChunks(kbId, analysis.analysis_id, strategy)
      setPreview(result)
      setPreviewedStrategy(JSON.stringify(strategy))
      setPhase('ready')
    } catch (reason) {
      setPreviewError(reason instanceof Error ? reason.message : '重新生成预览失败')
      setPhase('ready')
    }
  }

  function updateStrategy<K extends keyof ChunkingStrategy>(key: K, value: ChunkingStrategy[K]) {
    setStrategy(current => current ? { ...current, [key]: value } : current)
    if (analysis) {
      setPhase(current => current === 'error' ? 'ready' : current)
      setError('')
    }
  }

  if (!file) return null
  const isPreviewStale = !!strategy && JSON.stringify(strategy) !== previewedStrategy
  const busy = phase === 'analyzing' || phase === 'previewing' || phase === 'uploading'

  return <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ background: 'rgba(7,11,18,.82)', backdropFilter: 'blur(6px)' }}>
    <section role="dialog" aria-modal="true" aria-labelledby="chunking-flow-title" className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-md)' }}>
      <header className="flex items-start justify-between gap-4 border-b p-5" style={{ borderColor: 'var(--color-border)' }}>
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-xs" style={{ color: 'var(--color-cyan)' }}><span className="h-2 w-2 rounded-full" style={{ background: 'var(--color-cyan)' }} />AI DOCUMENT ANALYSIS <span style={{ color: 'var(--color-text-3)' }}>· {fileIndex + 1} / {files.length}</span></div>
          <h2 id="chunking-flow-title" className="text-lg font-semibold">上传前分析与切块预览</h2>
          <p className="mt-1 max-w-3xl truncate text-sm" style={{ color: 'var(--color-text-3)' }} title={file.name}>{file.name} · {formatSize(file.size)}</p>
        </div>
        <button type="button" disabled={phase === 'uploading'} onClick={onClose} className="rounded-lg px-3 py-1 text-sm" style={{ color: 'var(--color-text-2)', border: '1px solid var(--color-border)', opacity: phase === 'uploading' ? .5 : 1 }}>关闭</button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {phase === 'analyzing' && <div className="flex min-h-64 flex-col items-center justify-center text-center"><span className="mb-4 h-9 w-9 animate-spin rounded-full border-2 border-current border-r-transparent" style={{ color: 'var(--color-cyan)' }} /><h3 className="font-medium">正在分析文档结构</h3><p className="mt-2 max-w-md text-sm" style={{ color: 'var(--color-text-3)' }}>AI 正在识别文档类型、内容层次和合适的切块方式。分析完成前不会开始正式入库。</p></div>}

        {phase === 'error' && <div className="mx-auto flex min-h-64 max-w-lg flex-col items-center justify-center text-center"><div className="mb-3 text-3xl" style={{ color: 'var(--color-amber)' }}>!</div><h3 className="font-medium">{analysis ? '上传未完成' : '文档预分析失败'}</h3><p className="mt-2 text-sm" style={{ color: 'var(--color-red)' }}>{error}</p><p className="mt-2 text-xs" style={{ color: 'var(--color-text-3)' }}>{analysis ? '可以返回调整参数后重试上传，或跳过这份文件。' : '检查网络或稍后重试；预分析失败时不会直接使用默认参数入库。'}</p></div>}

        {analysis && strategy && <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,.85fr)]">
          <div className="space-y-4">
            <section className="rounded-xl p-4" style={{ background: 'var(--color-cyan-dim)', border: '1px solid color-mix(in srgb, var(--color-cyan) 30%, transparent)' }}>
              <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-medium" style={{ color: 'var(--color-cyan)' }}>AI 切块建议 · {analysis.document_type || '文档'}</span><span className="text-xs" style={{ color: 'var(--color-text-2)' }}>预计 {preview?.estimated_chunk_count ?? analysis.estimated_chunk_count} 个切片</span></div>
              <p className="mt-2 text-sm font-medium">{analysis.recommendation}</p>
              <p className="mt-1 text-xs leading-5" style={{ color: 'var(--color-text-2)' }}>{analysis.reasoning}</p>
              {analysis.summary && <p className="mt-3 border-t pt-3 text-xs leading-5" style={{ color: 'var(--color-text-2)', borderColor: 'var(--color-border)' }}>{analysis.summary}</p>}
            </section>

            <section className="rounded-xl p-4" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
              <div className="mb-4 flex items-center justify-between"><div><h3 className="text-sm font-semibold">切块参数</h3><p className="mt-1 text-xs" style={{ color: 'var(--color-text-3)' }}>可按文档特点调整；确认后会将这些参数用于正式上传。</p></div><span className="rounded-full px-2 py-1 text-[11px]" style={{ color: 'var(--color-cyan)', background: 'var(--color-cyan-dim)' }}>可编辑</span></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs" style={{ color: 'var(--color-text-2)' }}>切块方式<select value={strategy.strategy} onChange={event => updateStrategy('strategy', event.target.value as ChunkingStrategy['strategy'])} className="mt-1 w-full rounded-lg px-3 py-2 text-sm" style={inputStyle}><option value="structure_aware">结构优先</option><option value="semantic">语义优先</option><option value="fixed">固定长度</option></select></label>
                <label className="text-xs" style={{ color: 'var(--color-text-2)' }}>单块目标长度<input type="number" min={100} max={8000} step={50} value={strategy.chunk_size} onChange={event => updateStrategy('chunk_size', Number(event.target.value))} className="mt-1 w-full rounded-lg px-3 py-2 text-sm" style={inputStyle} /><span className="mt-1 block" style={{ color: 'var(--color-text-3)' }}>字符</span></label>
                <label className="text-xs" style={{ color: 'var(--color-text-2)' }}>块间重叠<input type="number" min={0} max={2000} step={10} value={strategy.chunk_overlap} onChange={event => updateStrategy('chunk_overlap', Number(event.target.value))} className="mt-1 w-full rounded-lg px-3 py-2 text-sm" style={inputStyle} /><span className="mt-1 block" style={{ color: 'var(--color-text-3)' }}>字符，用于保留上下文衔接</span></label>
                <label className="text-xs" style={{ color: 'var(--color-text-2)' }}>优先断点<textarea value={strategy.separators.join('\n')} onChange={event => updateStrategy('separators', event.target.value.split('\n').map(value => value.trim()).filter(Boolean))} rows={3} className="mt-1 w-full resize-y rounded-lg px-3 py-2 text-sm" style={inputStyle} placeholder="每行一个，如：\n标题\n段落\n句子" /><span className="mt-1 block" style={{ color: 'var(--color-text-3)' }}>从上到下尝试，优先在完整结构处切分</span></label>
              </div>
              {!!preview?.warnings?.length && <div className="mt-4 space-y-1 rounded-lg p-3 text-xs" style={{ color: 'var(--color-amber)', background: 'color-mix(in srgb, var(--color-amber) 10%, transparent)' }}>{preview.warnings.map((warning, index) => <p key={`${index}-${warning}`}>提示：{warning}</p>)}</div>}
            </section>
          </div>

          <section className="flex min-h-80 flex-col overflow-hidden rounded-xl" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
            <div className="flex items-center justify-between border-b p-4" style={{ borderColor: 'var(--color-border)' }}><div><h3 className="text-sm font-semibold">切片效果预览</h3><p className="mt-1 text-xs" style={{ color: 'var(--color-text-3)' }}>展示前 {preview?.preview.length ?? 0} 个切片</p></div><span className="text-xs" style={{ color: isPreviewStale ? 'var(--color-amber)' : 'var(--color-text-3)' }}>{isPreviewStale ? '参数已更改，预览需要刷新' : '可在确认前检查边界'}</span></div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">{preview?.preview.map(chunk => <article key={chunk.chunk_index} className="rounded-lg p-3" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}><div className="mb-2 flex items-center justify-between text-[11px]" style={{ color: 'var(--color-cyan)' }}><span>切片 {chunk.chunk_index + 1}</span>{chunk.token_count !== undefined && <span style={{ color: 'var(--color-text-3)' }}>约 {chunk.token_count} tokens</span>}</div><p className="whitespace-pre-wrap break-words text-xs leading-5" style={{ color: 'var(--color-text-2)' }}>{chunk.content}</p></article>)}{!preview?.preview.length && <p className="py-8 text-center text-sm" style={{ color: 'var(--color-text-3)' }}>分析接口暂未返回切片预览</p>}</div>
          </section>
        </div>}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t p-4" style={{ borderColor: 'var(--color-border)' }}>
        <p className="text-xs" style={{ color: 'var(--color-text-3)' }}>{files.length > 1 ? `队列中还有 ${files.length - fileIndex} 份文件` : '预分析文件仅用于生成建议；确认后才会正式上传并建立索引。'}</p>
        <div className="flex gap-2">
          {isPreviewStale && <button type="button" disabled={phase !== 'ready'} onClick={() => void refreshPreview()} className="rounded-lg px-4 py-2 text-sm" style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-2)', opacity: phase === 'ready' ? 1 : .55 }}>{phase === 'previewing' ? '正在生成预览…' : '按当前参数刷新预览'}</button>}
          {phase === 'error' && !analysis && <button type="button" onClick={() => { setPhase('analyzing'); setError(''); analyzeDocument(kbId, file).then(result => { setAnalysis(result); setPreview({ estimated_chunk_count: result.estimated_chunk_count, preview: result.preview, warnings: result.warnings }); setPreviewedStrategy(JSON.stringify(result.strategy)); setStrategy(result.strategy); setPhase('ready') }).catch(reason => { setError(reason instanceof Error ? reason.message : '文档分析失败'); setPhase('error') }) }} className="rounded-lg px-4 py-2 text-sm" style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-2)' }}>重试分析</button>}
          {phase === 'error' && analysis && <button type="button" disabled={isPreviewStale} onClick={() => void confirmUpload()} className="rounded-lg px-4 py-2 text-sm" style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-2)', opacity: isPreviewStale ? .5 : 1 }}>重试上传</button>}
          {phase === 'error' && <button type="button" onClick={() => void skipCurrent()} className="rounded-lg px-4 py-2 text-sm" style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-2)' }}>{isLast ? '结束' : '跳过此文件'}</button>}
          {phase === 'ready' && files.length > 1 && <button type="button" onClick={() => void skipCurrent()} className="rounded-lg px-4 py-2 text-sm" style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-2)' }}>跳过此文件</button>}
          <button type="button" disabled={phase !== 'ready' || !strategy || isPreviewStale || strategy.chunk_size <= 0 || strategy.chunk_overlap < 0 || strategy.chunk_overlap >= strategy.chunk_size} onClick={() => void confirmUpload()} className="rounded-lg px-4 py-2 text-sm font-medium" style={{ color: 'var(--color-text-inv)', background: 'var(--color-cyan)', opacity: phase === 'ready' && !isPreviewStale ? 1 : .55 }}>{phase === 'uploading' ? '正在上传并索引…' : isPreviewStale ? '请先刷新切片预览' : isLast ? '确认策略并上传' : '确认并处理下一份'}</button>
        </div>
        {previewError && <p className="basis-full text-right text-xs" style={{ color: 'var(--color-red)' }}>{previewError}</p>}
      </footer>
      {busy && <span className="sr-only" aria-live="polite">{phase === 'analyzing' ? '正在分析文档' : '正在上传文档'}</span>}
    </section>
  </div>
}

function formatSize(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}
