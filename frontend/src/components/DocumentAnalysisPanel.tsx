import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { documentSizeIndexAnalyse, structureIndexAnalyse } from '../api/client'

interface Props {
  docId: string
  filename: string
  onClose: () => void
}

// 预分析分类（顶部标签）。每一类指标对应一个独立接口。
const CATEGORIES = [
  { id: 'scale', name: '文档规模指标' },
  { id: 'structure', name: '结构化程度指标' },
]

interface MetricMeta {
  key: string
  name: string
  method: string
  purpose: string
  format: (m: any) => string
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

const STRUCTURE_METRICS: MetricMeta[] = [
  { key: 'heading_density', name: '标题密度', method: '标题数 ÷ 1000 个正文 Token', purpose: '判断是否适合标题分块', format: m => m.heading_density.toFixed(2) },
  { key: 'heading_level_count', name: '标题层级数', method: '识别到的有效标题层级数', purpose: '判断章节层次', format: m => `${m.heading_level_count} 层` },
  { key: 'heading_coverage', name: '标题覆盖度', method: '能关联到标题路径的正文 Token ÷ 正文 Token 总数', purpose: '判断标题结构覆盖程度', format: m => `${(m.heading_coverage * 100).toFixed(1)}%` },
  { key: 'paragraph_count', name: '正文段落数', method: '正文段落总数', purpose: '判断自然分段情况', format: m => `${m.paragraph_count} 段` },
  { key: 'list_ratio', name: '列表占比', method: '列表内容 Token ÷ 正文 Token', purpose: '判断列表型内容占比', format: m => `${(m.list_ratio * 100).toFixed(1)}%` },
  { key: 'qa_ratio', name: '问答占比', method: '问答对内容 Token ÷ 正文 Token', purpose: '判断是否适合问答分块', format: m => `${(m.qa_ratio * 100).toFixed(1)}%` },
]

const METRIC_GROUPS: Record<string, MetricMeta[]> = {
  scale: SCALE_METRICS,
  structure: STRUCTURE_METRICS,
}

const CATEGORY_HINTS: Record<string, string> = {
  scale: '提示：短 / 长元素的长度阈值需按实际文档校准——列表项、标题、参数值可能很短，但有很高的检索价值，不宜一律视为噪声。',
  structure: '提示：标题覆盖度通常比标题数量更有用——即使检测到很多标题，若大量正文无法关联到章节，也不一定适合直接标题分块。',
}

export default function DocumentAnalysisPanel({ docId, filename, onClose }: Props) {
  const [metrics, setMetrics] = useState<any>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState(CATEGORIES[0].id)
  const [hovered, setHovered] = useState<string | null>(null)
  const [tooltipDown, setTooltipDown] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  function showTooltip(key: string, e: MouseEvent<HTMLElement>) {
    setHovered(key)
    const icon = e.currentTarget
    const container = scrollRef.current
    if (!container || !icon) return
    // 上方空间不足（约一个 tooltip 高度 + 边距）时朝下弹出，避免被顶部裁切
    const spaceAbove = icon.getBoundingClientRect().top - container.getBoundingClientRect().top
    setTooltipDown(spaceAbove < 120)
  }

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError('')
    const fetcher = active === 'scale' ? documentSizeIndexAnalyse : structureIndexAnalyse
    fetcher(docId)
      .then(data => { if (alive) setMetrics(data) })
      .catch(e => { if (alive) setError(e instanceof Error ? e.message : '预分析失败') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [docId, active])

  const group = METRIC_GROUPS[active]

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ background: 'rgba(7,11,18,.82)', backdropFilter: 'blur(6px)' }}>
      <section className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-md)' }}>
        <header className="flex items-start justify-between gap-3 border-b p-4" style={{ borderColor: 'var(--color-border)' }}>
          <div className="min-w-0">
            <h3 className="text-base font-semibold">文档预分析</h3>
            <p className="mt-1 truncate text-sm" style={{ color: 'var(--color-text-3)' }} title={filename}>{filename}</p>
          </div>
          <button onClick={onClose} className="shrink-0 text-sm" style={{ color: 'var(--color-text-3)' }}>关闭</button>
        </header>

        <nav className="flex gap-1 border-b px-4 py-2" style={{ borderColor: 'var(--color-border)' }}>
          {CATEGORIES.map(cat => (
            <button key={cat.id} onClick={() => { setActive(cat.id); setHovered(null) }} className="rounded-lg px-3 py-1.5 text-sm font-medium" style={active === cat.id ? { color: 'var(--color-text-inv)', background: 'var(--color-cyan)' } : { color: 'var(--color-text-2)' }}>{cat.name}</button>
          ))}
        </nav>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-5">
          {loading && <div className="flex min-h-48 flex-col items-center justify-center text-center"><span className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-current border-r-transparent" style={{ color: 'var(--color-cyan)' }} /><p className="text-sm" style={{ color: 'var(--color-text-3)' }}>正在计算指标…</p></div>}
          {!loading && error && <p className="py-10 text-center text-sm" style={{ color: 'var(--color-red)' }}>{error}</p>}
          {!loading && !error && metrics && group && (
            <>
              <div className="overflow-hidden rounded-xl" style={{ border: '1px solid var(--color-border)' }}>
                {group.map((metric, index) => (
                  <div key={metric.key} className={`flex items-center justify-between gap-3 px-4 py-3 ${hovered === metric.key ? 'relative z-10' : ''}`} style={{ borderTop: index > 0 ? '1px solid var(--color-border)' : 'none' }}>
                    <span className="flex min-w-0 items-center gap-1.5 text-sm" style={{ color: 'var(--color-text-2)' }}>
                      <span className="truncate">{metric.name}</span>
                      <span className="relative shrink-0" onMouseEnter={e => showTooltip(metric.key, e)} onMouseLeave={() => setHovered(null)}>
                        <span className="flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-full text-[10px] font-semibold" style={{ color: 'var(--color-text-3)', background: 'var(--color-surface-3)', border: '1px solid var(--color-border)' }}>?</span>
                        {hovered === metric.key && (
                          <span className={`absolute left-0 z-10 w-56 rounded-lg p-2.5 text-left text-xs leading-5 ${tooltipDown ? 'top-full mt-1.5' : 'bottom-full mb-1.5'}`} style={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border-md)', color: 'var(--color-text-2)', boxShadow: '0 10px 28px rgba(0,0,0,.5)', pointerEvents: 'none' }}>
                            <span className="mb-0.5 block text-[11px]" style={{ color: 'var(--color-text-3)' }}>计算方法</span>
                            <span className="block">{metric.method}</span>
                            <span className="mt-2 mb-0.5 block text-[11px]" style={{ color: 'var(--color-text-3)' }}>作用</span>
                            <span className="block">{metric.purpose}</span>
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="shrink-0 text-base font-semibold tabular-nums" style={{ color: 'var(--color-cyan)' }}>{metric.format(metrics)}</span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-[11px] leading-5" style={{ color: 'var(--color-text-3)' }}>{CATEGORY_HINTS[active]}</p>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
