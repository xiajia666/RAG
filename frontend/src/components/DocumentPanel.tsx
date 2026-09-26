import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError, uploadDocument } from '../api/client'
import type { Document } from '../api/types'

interface Props {
  kbId: string
  open: boolean
  isAdmin: boolean
  onClose: () => void
}

export default function DocumentPanel({ kbId, open, isAdmin, onClose }: Props) {
  const [docs, setDocs] = useState<Document[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [drag, setDrag] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      setDocs(await api.get<Document[]>(`/api/kbs/${kbId}/documents`))
    } catch {
      setDocs([])
    }
  }, [kbId])

  useEffect(() => {
    if (open) {
      load()
      setError('')
    }
  }, [open, load])

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setError('')
    for (const f of Array.from(files)) {
      setUploading(true)
      try {
        await uploadDocument(kbId, f)
        await load()
      } catch (err) {
        setError(`${f.name}：${err instanceof ApiError ? err.message : '上传失败'}`)
      } finally {
        setUploading(false)
      }
    }
  }

  async function remove(id: string) {
    if (!confirm('删除该文档？')) return
    try {
      await api.del(`/api/documents/${id}`)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '删除失败')
    }
  }

  if (!open) return null

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="drawer">
        <div className="drawer-header">
          <span>文档管理</span>
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="drawer-body">
          <div
            className={`upload-zone ${drag ? 'drag' : ''}`}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setDrag(true)
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDrag(false)
              handleFiles(e.dataTransfer.files)
            }}
          >
            {uploading
              ? '上传中…'
              : '点击或拖拽文件到此处上传（PDF / Word / txt / md / csv 等）'}
          </div>
          <input
            ref={fileRef}
            type="file"
            multiple
            hidden
            accept=".pdf,.docx,.txt,.md,.csv,.json"
            onChange={(e) => {
              handleFiles(e.target.files)
              e.target.value = ''
            }}
          />
          {error && <div className="login-error" style={{ marginBottom: 12 }}>{error}</div>}
          {docs.length === 0 ? (
            <div className="empty-hint">暂无文档，先上传一份试试</div>
          ) : (
            <ul className="doc-list">
              {docs.map((d) => (
                <li key={d.id}>
                  <span className="icon">📄</span>
                  <div className="meta">
                    <div className="filename">{d.filename}</div>
                    <div className="sub">
                      {formatSize(d.size)} · {d.chunk_count} 个分块 · {formatDate(d.created_at)}
                    </div>
                  </div>
                  {isAdmin && (
                    <button className="btn btn-danger" onClick={() => remove(d.id)}>
                      删除
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  )
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(iso: string) {
  return iso.slice(0, 16).replace('T', ' ')
}
