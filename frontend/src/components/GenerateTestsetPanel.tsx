import { useState } from 'react'
import { generateTestset } from '../api/client'
import type { TestsetResult } from '../api/types'

interface Props {
  documents: { id: string; filename: string }[]
  onClose: () => void
}

// 问题类型配色（与后端 question_type 对应）。
const TYPE_COLORS: Record<string, string> = {
  simple: 'var(--color-cyan)',
  reasoning: 'var(--color-violet)',
  multi_context: 'var(--color-blue)',
  conditional: 'var(--color-amber)',
}

const TYPE_DIMS: Record<string, string> = {
  simple: 'var(--color-cyan-dim)',
  reasoning: 'var(--color-violet-dim)',
  multi_context: 'var(--color-blue-dim)',
  conditional: 'var(--color-amber-dim)',
}

function typeColor(type: string) {
  return TYPE_COLORS[type] ?? 'var(--color-text-2)'
}
function typeDim(type: string) {
  return TYPE_DIMS[type] ?? 'var(--color-surface-3)'
}

export default function GenerateTestsetPanel({ documents, onClose }: Props) {
  const [testSize, setTestSize] = useState(10)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<TestsetResult | null>(null)

  const filenames = documents.map(d => d.filename).join('、')

  async function generate() {
    setLoading(true)
    setError('')
    setResult(null)
    try {
      setResult(await generateTestset(documents.map(d => d.id), testSize))
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成失败')
    } finally {
      setLoading(false)
    }
  }

  const ratios = Object.entries(result?.question_type_ratio ?? {})

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ background: 'rgba(7,11,18,.82)', backdropFilter: 'blur(6px)' }}>
      <section className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-md)' }}>
        <header className="flex items-start justify-between gap-3 border-b p-4" style={{ borderColor: 'var(--color-border)' }}>
          <div className="min-w-0">
            <h3 className="text-base font-semibold">生成问答数据集</h3>
            <p className="mt-1 truncate text-sm" style={{ color: 'var(--color-text-3)' }} title={filenames}>{filenames}</p>
          </div>
          <button onClick={onClose} className="shrink-0 text-sm" style={{ color: 'var(--color-text-3)' }}>关闭</button>
        </header>

        <div className="flex items-end gap-3 border-b px-4 py-3" style={{ borderColor: 'var(--color-border)' }}>
          <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--color-text-2)' }}>
            <span>问题数量</span>
            <input
              type="number"
              min={1}
              max={50}
              value={testSize}
              onChange={e => setTestSize(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
              className="w-24 rounded-lg px-3 py-2 text-sm"
              style={{ color: 'var(--color-text)', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
            />
          </label>
          <button
            disabled={loading}
            onClick={() => void generate()}
            className="rounded-lg px-4 py-2 text-sm font-medium"
            style={{ color: 'var(--color-text-inv)', background: 'var(--color-cyan)', opacity: loading ? .5 : 1 }}
          >
            {loading ? '正在生成…' : '生成问题和答案'}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="flex min-h-48 flex-col items-center justify-center text-center">
              <span className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-current border-r-transparent" style={{ color: 'var(--color-cyan)' }} />
              <p className="text-sm" style={{ color: 'var(--color-text-3)' }}>正在基于整篇文档生成问题与答案，请稍候…</p>
            </div>
          )}

          {!loading && error && <p className="py-10 text-center text-sm" style={{ color: 'var(--color-red)' }}>{error}</p>}

          {!loading && !error && result && (
            <div className="space-y-5">
              {ratios.length > 0 && (
                <section>
                  <h4 className="mb-2 text-sm font-medium">问题类型比例</h4>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {ratios.map(([type, info]) => (
                      <div key={type} className="rounded-xl p-3" style={{ background: typeDim(type), border: `1px solid ${typeColor(type)}33` }}>
                        <div className="text-xs" style={{ color: 'var(--color-text-2)' }}>{info.label || type}</div>
                        <div className="mt-1 flex items-baseline gap-2">
                          <span className="text-xl font-semibold tabular-nums" style={{ color: typeColor(type) }}>{(info.ratio * 100).toFixed(0)}%</span>
                          <span className="text-xs" style={{ color: 'var(--color-text-3)' }}>{info.count} 题</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <h4 className="mb-2 text-sm font-medium">问题与答案（共 {result.total} 条）</h4>
                {result.testset.length === 0 && <p className="py-6 text-center text-sm" style={{ color: 'var(--color-text-3)' }}>未生成出有效问题，请尝试减少数量或更换文档。</p>}
                <div className="space-y-3">
                  {result.testset.map((item, index) => (
                    <article key={index} className="rounded-xl p-4" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <h5 className="text-sm font-medium leading-6">{item.question}</h5>
                        <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px]" style={{ color: typeColor(item.question_type), background: typeDim(item.question_type), border: `1px solid ${typeColor(item.question_type)}44` }}>
                          {item.question_type_label || item.question_type}
                        </span>
                      </div>
                      {item.answer ? (
                        <p className="text-sm leading-6" style={{ color: 'var(--color-text-2)' }}>
                          <span className="mr-1 font-medium" style={{ color: 'var(--color-cyan)' }}>答案</span>
                          {item.answer}
                        </p>
                      ) : (
                        <p className="text-xs" style={{ color: 'var(--color-text-3)' }}>该问题未生成参考答案</p>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            </div>
          )}

          {!loading && !error && !result && (
            <p className="py-10 text-center text-sm" style={{ color: 'var(--color-text-3)' }}>设置问题数量后，点击「生成问题和答案」。</p>
          )}
        </div>
      </section>
    </div>
  )
}
