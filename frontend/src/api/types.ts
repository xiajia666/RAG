export interface User {
  id: string
  tenant_id: string
  username: string
  email?: string | null
  phone?: string | null
  nickname?: string | null
  avatar?: string | null
  role: 'admin' | 'operator' | 'user'
  status: number
  created_at: string
}

export interface KnowledgeBase {
  id: string
  name: string
  description: string
  created_by: string
  created_at: string
  document_count?: number
  access_role?: 'admin' | 'editor' | 'reader'
}

export interface Document {
  id: string
  kb_id: string
  filename: string
  size: number
  chunk_count: number
  created_at: string
}

export interface Session {
  id: string
  title: string
  kb_id: string
  created_at: string
  message_count?: number
}

export interface Source {
  filename: string
  score: number
}

export interface Message {
  id?: number
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
}

export interface StreamMeta {
  session_id: string
  sources: Source[]
}
