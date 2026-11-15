import { useMemo, useState } from 'react'
import { generateTestset } from '../api/client'
import type { TestsetResult } from '../api/types'

interface Props {
  documents: { id: string; filename: string }[]
  onClose: () => void
}

const QUESTION_TYPES = [
  { key: 'single_hop_specific', label: '单跳具体', description: '从单一片段中提取明确答案', color: '#00d4b4' },
  { key: 'single_hop_abstract', label: '单跳抽象', description: '概括单一片段的主旨或观点', color: '#38bdf8' },
  { key: 'multi_hop_specific', label: '多跳具体', description: '串联多条信息得到具体结论', color: '#3b82f6' },
  { key: 'multi_hop_abstract', label: '多跳抽象', description: '综合多处内容进行归纳总结', color: '#6366f1' },
  { key: 'factual', label: '事实类', description: '验证人物、时间、数值等事实', color: '#8b5cf6' },
  { key: 'conditional_constraint', label: '条件约束型', description: '在给定限制条件下寻找答案', color: '#d946ef' },
  { key: 'comparative', label: '对比类', description: '比较两个或多个对象的异同', color: '#f43f5e' },
  { key: 'conditional_reasoning', label: '条件推理问题', description: '基于前提条件进行逻辑推演', color: '#f97316' },
  { key: 'cross_document', label: '跨文档关联类', description: '关联不同文档中的信息作答', color: '#f59e0b' },
  { key: 'unanswerable', label: '不可回答型', description: '文档信息不足，检验拒答能力', color: '#84cc16' },
] as const

type QuestionTypeKey = typeof QUESTION_TYPES[number]['key']
type QuestionCounts = Record<QuestionTypeKey, number>

const DEFAULT_COUNTS = Object.fromEntries(QUESTION_TYPES.map(type => [type.key, 1])) as QuestionCounts
const MAX_TOTAL = 50

const LEGACY_COLORS: Record<string, string> = {
  simple: '#00d4b4',
  reasoning: '#8b5cf6',
  multi_context: '#3b82f6',
  conditional: '#f59e0b',
}

function typeColor(type: string) {
  return QUESTION_TYPES.find(item => item.key === type)?.color ?? LEGACY_COLORS[type] ?? '#94a3b8'
}

function TypeDistributionChart({ counts, total }: { counts: QuestionCounts; total: number }) {
  let offset = 0

  return (
    <div className="relative mx-auto h-48 w-48" aria-label={`共 ${total} 道问题的类型分布图`}>
      <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90" role="img">
        <circle cx="80" cy="80" r="62" fill="none" stroke="var(--color-surface-3)" strokeWidth="18" />
        {QUESTION_TYPES.map(type => {
          const portion = total > 0 ? counts[type.key] / total * 100 : 0
          const segmentOffset = offset
          offset += portion
          return portion > 0 ? (
            <circle
              key={type.key}
              cx="80"
              cy="80"
              r="62"
              pathLength="100"
              fill="none"
              stroke={type.color}
              strokeWidth="18"
              strokeDasharray={`${Math.max(0, portion - 0.7)} ${100 - Math.max(0, portion - 0.7)}`}
              strokeDashoffset={-segmentOffset}
              className="transition-all duration-300"
            />
          ) : null
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <strong className="font-display text-4xl font-semibold tabular-nums">{total}</strong>
        <span className="mt-1 text-xs" style={{ color: 'var(--color-text-3)' }}>问题总数</span>
      </div>
    </div>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  )
}

export default function GenerateTestsetPanel({ documents, onClose }: Props) {
  const [counts, setCounts] = useState<QuestionCounts>(() => ({ ...DEFAULT_COUNTS }))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<TestsetResult | null>(null)

  const total = useMemo(
    () => QUESTION_TYPES.reduce((sum, type) => sum + counts[type.key], 0),
    [counts],
  )
  const activeTypeCount = QUESTION_TYPES.filter(type => counts[type.key] > 0).length
  const filenames = documents.map(document => document.filename).join('、')

  function updateCount(key: QuestionTypeKey, nextValue: number) {
    const current = counts[key]
    const available = MAX_TOTAL - (total - current)
    const value = Math.max(0, Math.min(available, Math.floor(Number.isFinite(nextValue) ? nextValue : 0)))
    setCounts(previous => ({ ...previous, [key]: value }))
    setError('')
  }

  function resetCounts() {
    setCounts({ ...DEFAULT_COUNTS })
    setError('')
  }

  async function generate() {
    if (total < 1) {
      setError('请至少保留一种问题类型，并将数量设置为 1 或以上。')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)
    try {
      setResult(await generateTestset(documents.map(document => document.id), total, counts))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '生成失败')
    } finally {
      setLoading(false)
    }
  }

  const resultRatios = Object.entries(result?.question_type_ratio ?? {})

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6" style={{ background: 'rgba(3,7,14,.86)', backdropFilter: 'blur(10px)' }}>
      <section
        className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl shadow-2xl"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-md)', boxShadow: '0 28px 90px rgba(0,0,0,.52)' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="testset-title"
      >
        <header className="flex items-start justify-between gap-5 border-b px-5 py-4 sm:px-7 sm:py-5" style={{ borderColor: 'var(--color-border)' }}>
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-full px-2 py-0.5 font-mono text-[10px] tracking-[.16em]" style={{ color: 'var(--color-cyan)', background: 'var(--color-cyan-dim)', border: '1px solid rgba(0,212,180,.2)' }}>QA DATASET</span>
              <span className="text-xs" style={{ color: 'var(--color-text-3)' }}>已选择 {documents.length} 份文档</span>
            </div>
            <h3 id="testset-title" className="font-display text-xl font-semibold tracking-tight sm:text-2xl">生成问答数据集</h3>
            <p className="mt-1.5 max-w-3xl truncate text-xs sm:text-sm" style={{ color: 'var(--color-text-3)' }} title={filenames}>{filenames}</p>
          </div>
          <button
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors hover:bg-white/5"
            style={{ color: 'var(--color-text-2)', border: '1px solid var(--color-border)' }}
            aria-label="关闭生成问答数据集窗口"
          >
            <CloseIcon />
          </button>
        </header>

        {!result && !loading && (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="grid min-h-full lg:grid-cols-[minmax(0,1.65fr)_minmax(320px,.85fr)]">
              <section className="px-5 py-5 sm:px-7 sm:py-6">
                <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h4 className="font-display text-base font-medium">配置问题类型</h4>
                    <p className="mt-1 text-xs" style={{ color: 'var(--color-text-3)' }}>按评测目标分配题量，单次最多生成 {MAX_TOTAL} 道</p>
                  </div>
                  <button onClick={resetCounts} className="text-xs transition-colors hover:text-white" style={{ color: 'var(--color-text-2)' }}>恢复默认</button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {QUESTION_TYPES.map((type, index) => (
                    <article
                      key={type.key}
                      className="group flex min-h-24 items-center gap-3 rounded-xl p-3.5 transition-colors"
                      style={{ background: counts[type.key] > 0 ? `${type.color}0d` : 'var(--color-surface-2)', border: `1px solid ${counts[type.key] > 0 ? `${type.color}30` : 'var(--color-border)'}` }}
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg font-mono text-[11px]" style={{ color: type.color, background: `${type.color}16` }}>{String(index + 1).padStart(2, '0')}</span>
                      <div className="min-w-0 flex-1">
                        <h5 className="text-sm font-medium">{type.label}</h5>
                        <p className="mt-1 truncate text-[11px]" style={{ color: 'var(--color-text-3)' }} title={type.description}>{type.description}</p>
                      </div>
                      <div className="flex shrink-0 items-center rounded-lg" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-md)' }}>
                        <button
                          onClick={() => updateCount(type.key, counts[type.key] - 1)}
                          className="grid h-8 w-7 place-items-center text-base transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                          style={{ color: 'var(--color-text-2)' }}
                          disabled={counts[type.key] === 0}
                          aria-label={`减少${type.label}数量`}
                        >−</button>
                        <input
                          type="number"
                          min={0}
                          max={MAX_TOTAL}
                          value={counts[type.key]}
                          onChange={event => updateCount(type.key, Number(event.target.value))}
                          className="h-8 w-9 border-x bg-transparent text-center text-sm font-semibold tabular-nums"
                          style={{ color: type.color, borderColor: 'var(--color-border)' }}
                          aria-label={`${type.label}数量`}
                        />
                        <button
                          onClick={() => updateCount(type.key, counts[type.key] + 1)}
                          className="grid h-8 w-7 place-items-center text-base transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                          style={{ color: 'var(--color-text-2)' }}
                          disabled={total >= MAX_TOTAL}
                          aria-label={`增加${type.label}数量`}
                        >+</button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <aside className="border-t px-5 py-5 sm:px-7 sm:py-6 lg:border-l lg:border-t-0" style={{ borderColor: 'var(--color-border)', background: 'rgba(17,24,39,.42)' }}>
                <div className="lg:sticky lg:top-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-display text-base font-medium">数量分布</h4>
                      <p className="mt-1 text-xs" style={{ color: 'var(--color-text-3)' }}>{activeTypeCount} 种类型已启用</p>
                    </div>
                    <span className="rounded-lg px-2 py-1 font-mono text-[10px]" style={{ color: total === MAX_TOTAL ? 'var(--color-amber)' : 'var(--color-text-3)', background: 'var(--color-surface-3)' }}>{total}/{MAX_TOTAL}</span>
                  </div>

                  <TypeDistributionChart counts={counts} total={total} />

                  <div className="grid grid-cols-2 gap-x-5 gap-y-2.5">
                    {QUESTION_TYPES.map(type => (
                      <div key={type.key} className="flex min-w-0 items-center gap-2 text-[11px]">
                        <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: type.color }} />
                        <span className="min-w-0 flex-1 truncate" style={{ color: 'var(--color-text-2)' }}>{type.label}</span>
                        <span className="font-mono tabular-nums" style={{ color: counts[type.key] > 0 ? 'var(--color-text)' : 'var(--color-text-3)' }}>{counts[type.key]}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 rounded-xl p-3.5 text-xs leading-5" style={{ color: 'var(--color-text-2)', background: 'var(--color-cyan-dim)', border: '1px solid rgba(0,212,180,.14)' }}>
                    <span className="mr-2 font-medium" style={{ color: 'var(--color-cyan)' }}>提示</span>
                    类型数量决定生成比例；设为 0 的类型不会出现在本次数据集中。
                  </div>
                </div>
              </aside>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex min-h-[430px] flex-1 flex-col items-center justify-center px-6 text-center">
            <div className="relative mb-6 h-16 w-16">
              <span className="absolute inset-0 animate-ping rounded-full opacity-20" style={{ background: 'var(--color-cyan)' }} />
              <span className="absolute inset-1 animate-spin rounded-full border-2 border-transparent border-r-current border-t-current" style={{ color: 'var(--color-cyan)' }} />
              <span className="absolute inset-0 grid place-items-center font-mono text-xs" style={{ color: 'var(--color-cyan)' }}>{total}</span>
            </div>
            <h4 className="font-display text-lg font-medium">正在生成问题与答案</h4>
            <p className="mt-2 max-w-md text-sm leading-6" style={{ color: 'var(--color-text-3)' }}>正在读取所选文档，并按照 {activeTypeCount} 种问题类型生成 {total} 道评测题，请稍候…</p>
          </div>
        )}

        {result && !loading && (
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="font-display text-lg font-medium">数据集生成完成</h4>
                <p className="mt-1 text-xs" style={{ color: 'var(--color-text-3)' }}>共生成 {result.total} 条问题与答案</p>
              </div>
              <button onClick={() => setResult(null)} className="rounded-lg px-3 py-2 text-xs" style={{ color: 'var(--color-text-2)', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>返回配置</button>
            </div>

            {resultRatios.length > 0 && (
              <div className="mb-5 flex flex-wrap gap-2">
                {resultRatios.map(([type, info]) => (
                  <span key={type} className="rounded-full px-2.5 py-1 text-[11px]" style={{ color: typeColor(type), background: `${typeColor(type)}14`, border: `1px solid ${typeColor(type)}30` }}>
                    {info.label || type} · {info.count}
                  </span>
                ))}
              </div>
            )}

            {result.testset.length === 0 && <p className="py-12 text-center text-sm" style={{ color: 'var(--color-text-3)' }}>未生成出有效问题，请尝试减少数量或更换文档。</p>}
            <div className="grid gap-3 lg:grid-cols-2">
              {result.testset.map((item, index) => (
                <article key={index} className="rounded-xl p-4" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
                  <div className="mb-3 flex items-start gap-3">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg font-mono text-[10px]" style={{ color: 'var(--color-cyan)', background: 'var(--color-cyan-dim)' }}>{String(index + 1).padStart(2, '0')}</span>
                    <h5 className="min-w-0 flex-1 text-sm font-medium leading-6">{item.question}</h5>
                    <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px]" style={{ color: typeColor(item.question_type), background: `${typeColor(item.question_type)}14` }}>{item.question_type_label || item.question_type}</span>
                  </div>
                  {item.answer ? (
                    <p className="pl-10 text-sm leading-6" style={{ color: 'var(--color-text-2)' }}><span className="mr-2 text-xs font-medium" style={{ color: 'var(--color-cyan)' }}>答案</span>{item.answer}</p>
                  ) : (
                    <p className="pl-10 text-xs" style={{ color: 'var(--color-text-3)' }}>该问题未生成参考答案</p>
                  )}
                </article>
              ))}
            </div>
          </div>
        )}

        {!result && !loading && (
          <footer className="flex flex-col gap-3 border-t px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7" style={{ borderColor: 'var(--color-border)', background: 'rgba(7,11,18,.28)' }}>
            <div>
              {error ? <p className="text-xs" style={{ color: 'var(--color-red)' }}>{error}</p> : <p className="text-xs" style={{ color: 'var(--color-text-3)' }}>将基于 {documents.length} 份文档生成 <strong style={{ color: 'var(--color-text)' }}>{total}</strong> 道问题</p>}
            </div>
            <div className="flex items-center gap-3">
              <button onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm" style={{ color: 'var(--color-text-2)' }}>取消</button>
              <button
                disabled={total < 1}
                onClick={() => void generate()}
                className="flex min-w-40 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
                style={{ color: 'var(--color-text-inv)', background: 'var(--color-cyan)', boxShadow: '0 8px 24px rgba(0,212,180,.16)' }}
              >
                生成 {total} 道问答
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </footer>
        )}
      </section>
    </div>
  )
}
