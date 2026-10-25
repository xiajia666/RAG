import { useState } from 'react'
import { chunkingRecommend } from '../api/client'
import type { ChunkingRecommendation } from '../api/types'

interface Props {
  docId: string
}

const STATUS_META: Record<string, { color: string; label: string }> = {
  recommended: { color: 'var(--color-green)', label: '推荐' },
  needs_review: { color: 'var(--color-amber)', label: '需复核' },
  parse_repair_required: { color: 'var(--color-red)', label: '需解析修复' },
}

const STRATEGY_LABELS: Record<string, string> = {
  qa: '问答对', structure_aware: '结构优先', recursive: '递归', code_aware: '代码感知',
  table_aware: '表格感知', caption_linked: '图文关联', fixed: '固定长度', semantic: '语义优先',
  contract_aware: '条款感知', paper_aware: '论文结构', one: '整篇',
}

const REASON_KEY_LABELS: Record<string, string> = {
  chunk_size: '分块大小', overlap_percent: '重叠', separators: '分隔符', top_k: 'TopK',
  strategy: '策略', table_window_tokens: '表格上下文', image_window_tokens: '图片上下文',
}

function label(map: Record<string, string>, value: string): string {
  return map[value] ?? value
}

function formatSeparator(s: string): string {
  return s.replace(/\n/g, '⏎').replace(/\t/g, '⇥').replace(/ /g, '␣')
}

export default function ChunkingRecommendView({ docId }: Props) {
  const [recommend, setRecommend] = useState<ChunkingRecommendation | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function generate() {
    setLoading(true)
    setError('')
    try {
      setRecommend(await chunkingRecommend(docId))
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成推荐失败')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center text-center">
        <span className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-current border-r-transparent" style={{ color: 'var(--color-cyan)' }} />
        <p className="text-sm" style={{ color: 'var(--color-text-3)' }}>AI 正在分析指标并生成推荐…</p>
      </div>
    )
  }

  if (!recommend && !error) {
    return (
      <div className="mx-auto max-w-md py-8 text-center">
        <div className="mb-3 text-3xl" style={{ color: 'var(--color-cyan)' }}>✦</div>
        <h3 className="font-semibold">AI 分块策略推荐</h3>
        <p className="mt-2 text-sm leading-6" style={{ color: 'var(--color-text-3)' }}>
          基于文档的规模、结构、内容类型三类指标，AI 将推荐分块大小、重叠、分隔符、分块策略与检索 TopK 等参数。
        </p>
        <button onClick={() => void generate()} className="mt-5 rounded-lg px-5 py-2.5 text-sm font-medium" style={{ color: 'var(--color-text-inv)', background: 'var(--color-cyan)' }}>
          生成推荐
        </button>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md py-10 text-center">
        <p className="text-sm" style={{ color: 'var(--color-red)' }}>{error}</p>
        <button onClick={() => void generate()} className="mt-4 rounded-lg px-4 py-2 text-sm" style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-2)' }}>
          重试
        </button>
      </div>
    )
  }

  if (!recommend) return null

  if (recommend.error) {
    return (
      <div className="mx-auto max-w-md py-10 text-center">
        <p className="text-sm" style={{ color: 'var(--color-red)' }}>{recommend.error}</p>
        {recommend.raw && (
          <pre className="mt-4 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg p-3 text-left text-xs" style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-3)' }}>{recommend.raw}</pre>
        )}
      </div>
    )
  }

  return <RecommendDisplay recommend={recommend} />
}

function RecommendDisplay({ recommend }: { recommend: ChunkingRecommendation }) {
  const status = recommend.status || ''
  const statusMeta = STATUS_META[status]
  const strategy = recommend.strategy || {}
  const chunking = recommend.chunking || {}
  const retrieval = recommend.retrieval || {}
  const context = recommend.context || {}
  const reasons = recommend.parameter_reasons || {}
  const warnings = recommend.warnings || []
  const elements = strategy.elements ? Object.entries(strategy.elements) : []

  return (
    <div className="space-y-3">
      {status && (
        <div className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
          <span className="text-sm" style={{ color: 'var(--color-text-2)' }}>推荐状态</span>
          <span className="text-sm font-medium" style={{ color: statusMeta?.color ?? 'var(--color-text-2)' }}>{statusMeta?.label ?? status}</span>
        </div>
      )}

      <section className="rounded-xl p-4" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
        <h4 className="mb-2 text-sm font-semibold">分块策略</h4>
        {strategy.primary && <Row label="主策略" value={label(STRATEGY_LABELS, strategy.primary)} />}
        {elements.map(([key, value]) => <Row key={key} label={`${label(STRATEGY_LABELS, key)} 处理`} value={label(STRATEGY_LABELS, value)} />)}
      </section>

      <section className="rounded-xl p-4" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
        <h4 className="mb-2 text-sm font-semibold">分块参数</h4>
        {chunking.size != null && <Row label="分块大小" value={`${chunking.size} ${chunking.size_unit || 'tokens'}`} />}
        {chunking.max_size != null && <Row label="最大分块" value={`${chunking.max_size} ${chunking.size_unit || 'tokens'}`} />}
        {chunking.overlap_percent != null && <Row label="重叠（Overlap）" value={`${chunking.overlap_percent}%`} />}
        {chunking.separators && chunking.separators.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-xs" style={{ color: 'var(--color-text-3)' }}>分隔符</span>
            {chunking.separators.map((s, i) => (
              <span key={i} className="rounded px-2 py-0.5 font-mono text-xs" style={{ background: 'var(--color-surface-3)', color: 'var(--color-text-2)' }}>{formatSeparator(s)}</span>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl p-4" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
        <h4 className="mb-2 text-sm font-semibold">检索参数（TopK）</h4>
        {retrieval.candidate_top_k != null && <Row label="候选 TopK" value={retrieval.candidate_top_k} />}
        {retrieval.rerank_top_k != null && <Row label="重排 TopK" value={retrieval.rerank_top_k} />}
        {retrieval.final_context_k != null && <Row label="最终上下文 K" value={retrieval.final_context_k} />}
        {retrieval.basis && <Row label="依据" value={retrieval.basis} />}
      </section>

      {(context.table_window_tokens != null || context.image_window_tokens != null) && (
        <section className="rounded-xl p-4" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
          <h4 className="mb-2 text-sm font-semibold">表格 / 图片上下文窗口</h4>
          {context.table_window_tokens != null && <Row label="表格上下文" value={`${context.table_window_tokens} tokens`} />}
          {context.image_window_tokens != null && <Row label="图片上下文" value={`${context.image_window_tokens} tokens`} />}
        </section>
      )}

      {Object.keys(reasons).length > 0 && (
        <section className="rounded-xl p-4" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
          <h4 className="mb-2 text-sm font-semibold">参数理由</h4>
          {Object.entries(reasons).map(([key, value]) => (
            <div key={key} className="mb-2">
              <span className="text-xs font-medium" style={{ color: 'var(--color-cyan)' }}>{label(REASON_KEY_LABELS, key)}</span>
              {(Array.isArray(value) ? value : [value]).map((reason, i) => (
                <p key={i} className="mt-0.5 text-xs leading-5" style={{ color: 'var(--color-text-2)' }}>{reason}</p>
              ))}
            </div>
          ))}
        </section>
      )}

      {warnings.length > 0 && (
        <section className="rounded-xl p-4" style={{ background: 'color-mix(in srgb, var(--color-amber) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--color-amber) 30%, transparent)' }}>
          <h4 className="mb-2 text-sm font-semibold" style={{ color: 'var(--color-amber)' }}>警告</h4>
          {warnings.map((warning, i) => <p key={i} className="mb-1 text-xs leading-5" style={{ color: 'var(--color-text-2)' }}>• {warning}</p>)}
        </section>
      )}

      <p className="text-[11px] leading-5" style={{ color: 'var(--color-text-3)' }}>提示：以上为基于文档指标的推荐初始配置，最终参数应通过真实检索评估（Recall@K / MRR / 引用准确率）校准。</p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="mb-1.5 flex items-center justify-between gap-3">
      <span className="text-xs" style={{ color: 'var(--color-text-3)' }}>{label}</span>
      <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{value}</span>
    </div>
  )
}
