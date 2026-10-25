import { useEffect, useState } from 'react'
import { documentSizeIndexAnalyse } from '../api/client'
import type { DocumentMetrics } from '../api/types'

interface Props {
  docId: string
  filename: string
  onClose: () => void
}

// 预分析分类（顶部标签）。当前只有「文档规模指标」，后续可扩展「内容类型」「结构特征」等。
const CATEGORIES = [{ id: 'scale', name: '文档规模指标' }]

interface MetricMeta {
  key: keyof DocumentMetrics
  name: string
  method: string
  purpose: string
  format: (m: DocumentMetrics) => string
}

const SCALE_METRICS: MetricMeta[] = [
  { key: 'page_count', name: '物理页数', method: '文档物理页数', purpose: '判断文档规模', format: m => `${m.page_count} 页` },
  { key: 'char_count', name: '有效字符数', method: '去除空白后的文本字符总数', purpose: '判断内容量', format: m => m.char_count.toLocaleString() },
  { key: 'estimated_tokens', name: '预估 Token 数', method: '目标 tokenizer 估算（中文约 1 字/token）', purpose: '估计 Chunk 数与成本', format: m => m.estimated_tokens.toLocaleString() },
  { key: 'avg_tokens_per_page', name: '每页平均 Token', method: '总 Token ÷ 页数', purpose: '判断页面信息密度', format: m => m.avg_tokens_per_page.toLocaleString() },
  { key: 'max_tokens_per_page', name: '单页最大 Token', method: '逐页提取文本后取最大 Token 数', purpose: '识别密度峰值', format: m => m.max_tokens_per_page.toLocaleString() },
  { key: 'min_tokens_per_page', name: '单页最小 Token', method: '逐页提取文本后取最小 Token 数', purpose: '识别密度谷值', format: m => m.min_tokens_per_page.toLocaleString() },
  { key: 'blank_page_count', name: '空白页', method: '无文本内容的页数', purpose: '判断有效规模', format: m => `${m.blank_page_count} 页（${(m.blank_page_ratio * 100).toFixed(1)}%）` },
  { key: 'short_element_ratio', name: '短元素占比', method: '过短文本元素数 ÷ 文本元素总数', purpose: '识别碎片化提取', format: m => `${(m.short_element_ratio * 100).toFixed(1)}%（${m.short_element_count}/${m.total_elements}）` },
  { key: 'long_element_ratio', name: '长元素占比', method: '超长文本元素数 ÷ 文本元素总数', purpose: '识别需要拆分的长段落', format: m => `${(m.long_element_ratio * 100).toFixed(1)}%（${m.long_element_count}/${m.total_elements}）` },
]

export default function DocumentAnalysisPanel({ docId, filename, onClose }: Props) {
  const [metrics, setMetrics] = useState<DocumentMetrics | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState(CATEGORIES[0].id)

  useEffect(() => {
    let alive = true
    documentSizeIndexAnalyse(docId)
      .then(data => { if (alive) setMetrics(data) })
      .catch(e => { if (alive) setError(e instanceof Error ? e.message : '预分析失败') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [docId])

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ background: 'rgba(7,11,18,.82)', backdropFilter: 'blur(6px)' }}>
      <section className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-md)' }}>
        <header className="flex items-start justify-between gap-3 border-b p-4" style={{ borderColor: 'var(--color-border)' }}>
          <div className="min-w-0">
            <h3 className="text-base font-semibold">文档预分析</h3>
            <p className="mt-1 truncate text-sm" style={{ color: 'var(--color-text-3)' }} title={filename}>{filename}</p>
          </div>
          <button onClick={onClose} className="shrink-0 text-sm" style={{ color: 'var(--color-text-3)' }}>关闭</button>
        </header>

        <nav className="flex gap-1 border-b px-4 py-2" style={{ borderColor: 'var(--color-border)' }}>
          {CATEGORIES.map(cat => (
            <button key={cat.id} onClick={() => setActive(cat.id)} className="rounded-lg px-3 py-1.5 text-sm font-medium" style={active === cat.id ? { color: 'var(--color-text-inv)', background: 'var(--color-cyan)' } : { color: 'var(--color-text-2)' }}>{cat.name}</button>
          ))}
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {loading && <div className="flex min-h-48 flex-col items-center justify-center text-center"><span className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-current border-r-transparent" style={{ color: 'var(--color-cyan)' }} /><p className="text-sm" style={{ color: 'var(--color-text-3)' }}>正在计算指标…</p></div>}
          {!loading && error && <p className="py-10 text-center text-sm" style={{ color: 'var(--color-red)' }}>{error}</p>}
          {!loading && !error && metrics && active === 'scale' && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {SCALE_METRICS.map(metric => (
                  <article key={metric.key} className="rounded-xl p-4" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-medium">{metric.name}</span>
                      <span className="shrink-0 text-lg font-semibold" style={{ color: 'var(--color-cyan)' }}>{metric.format(metrics)}</span>
                    </div>
                    <p className="mt-2 text-xs leading-5" style={{ color: 'var(--color-text-3)' }}>计算方法：{metric.method}</p>
                    <p className="mt-1 text-xs leading-5" style={{ color: 'var(--color-text-2)' }}>作用：{metric.purpose}</p>
                  </article>
                ))}
              </div>
              <p className="mt-4 text-[11px] leading-5" style={{ color: 'var(--color-text-3)' }}>提示：短 / 长元素的长度阈值需按实际文档校准——列表项、标题、参数值可能很短，但有很高的检索价值，不宜一律视为噪声。</p>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
