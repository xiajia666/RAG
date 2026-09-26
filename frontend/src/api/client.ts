import type { Document, StreamMeta } from './types'

const TOKEN_KEY = 'rag_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}
export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

function expireSession() {
  clearToken()
  window.dispatchEvent(new Event('rag:unauthorized'))
  window.location.hash = '#/login'
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(path, { ...options, headers })
  const isAuthRequest = path === '/api/auth/login' || path === '/api/auth/register'
  if (res.status === 401 && !isAuthRequest) expireSession()
  if (!res.ok) {
    let detail = res.status === 401
      ? (isAuthRequest ? '用户名或密码错误' : '未登录或登录已过期')
      : res.statusText
    try {
      const body = await res.json()
      if (body?.detail) {
        detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
      }
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, detail)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}

export async function uploadDocument(
  kbId: string,
  file: File,
): Promise<{ document: Document; chunk_count: number }> {
  const form = new FormData()
  form.append('file', file)
  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`/api/kbs/${kbId}/documents`, { method: 'POST', headers, body: form })
  if (res.status === 401) expireSession()
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      if (body?.detail) detail = body.detail
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, detail)
  }
  return res.json()
}

export async function downloadDocument(docId: string, filename: string): Promise<void> {
  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`/api/documents/${docId}/file`, { headers })
  if (res.status === 401) expireSession()
  if (!res.ok) throw new ApiError(res.status, '下载文件失败')
  const url = URL.createObjectURL(await res.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export interface StreamCallbacks {
  onMeta?: (meta: StreamMeta) => void
  onToken?: (text: string) => void
  onError?: (message: string) => void
  onDone?: () => void
}

export async function streamChat(
  body: { message: string; kb_id: string; session_id: string | null },
  cb: StreamCallbacks,
): Promise<void> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch('/api/chat/stream', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  if (res.status === 401) expireSession()
  if (!res.ok || !res.body) {
    let detail = res.statusText
    try {
      const data = await res.json()
      if (data?.detail) detail = data.detail
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, detail)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''
    for (const part of parts) {
      const line = part.trim()
      if (!line.startsWith('data:')) continue
      const data = line.slice(5).trim()
      if (data === '[DONE]') {
        cb.onDone?.()
        continue
      }
      try {
        const ev = JSON.parse(data)
        if (ev.type === 'meta') cb.onMeta?.(ev as StreamMeta)
        else if (ev.type === 'content') cb.onToken?.(ev.text as string)
        else if (ev.type === 'error') cb.onError?.(ev.message as string)
      } catch {
        /* ignore malformed chunk */
      }
    }
  }
}
