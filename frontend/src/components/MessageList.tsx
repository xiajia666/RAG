import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Message } from '../api/types'
import SourceCard from './SourceCard'

interface Props {
  messages: Message[]
  streaming: boolean
  kbName?: string
}

export default function MessageList({ messages, streaming, kbName }: Props) {
  if (messages.length === 0) {
    return (
      <div className="messages">
        <div className="welcome">
          <h2>👋 欢迎使用{kbName ? `「${kbName}」` : ''}知识库</h2>
          <p>
            在下方输入问题，系统会从知识库文档中检索相关内容并基于文档回答。
            回答会附带来源文档，方便追溯。
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="messages">
      {messages.map((m, i) => {
        const isLast = i === messages.length - 1
        const showThinking = isLast && streaming && m.role === 'assistant' && !m.content
        return (
          <div key={i} className={`msg ${m.role}`}>
            <div className="bubble">
              {m.role === 'assistant' ? (
                showThinking ? (
                  <span className="thinking">正在思考…</span>
                ) : (
                  <div className="md">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                  </div>
                )
              ) : (
                m.content
              )}
            </div>
            {m.role === 'assistant' && m.sources && m.sources.length > 0 && (
              <SourceCard sources={m.sources} />
            )}
          </div>
        )
      })}
    </div>
  )
}
