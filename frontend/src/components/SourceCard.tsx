import type { Source } from '../api/types'

export default function SourceCard({ sources }: { sources: Source[] }) {
  if (!sources || sources.length === 0) return null
  return (
    <div className="sources">
      {sources.map((s, i) => (
        <span className="source-chip" key={i} title={s.filename}>
          📄 {s.filename}
          <span className="score">{s.score.toFixed(3)}</span>
        </span>
      ))}
    </div>
  )
}
