import { useRef, useState } from 'react'

interface Props {
  onSend: (text: string) => void
  disabled: boolean
}

export default function Composer({ onSend, disabled }: Props) {
  const [text, setText] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)

  function submit() {
    const t = text.trim()
    if (!t || disabled) return
    onSend(t)
    setText('')
    ref.current?.focus()
  }

  return (
    <div className="composer">
      <div className="composer-box">
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="输入问题，回车发送，Shift+回车换行"
          rows={1}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              submit()
            }
          }}
        />
        <button className="btn btn-primary" onClick={submit} disabled={disabled || !text.trim()}>
          {disabled ? '回答中…' : '发送'}
        </button>
      </div>
    </div>
  )
}
