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

export interface DocumentMetrics {
  filename: string
  page_count: number
  char_count: number
  estimated_tokens: number
  avg_tokens_per_page: number
  max_tokens_per_page: number
  min_tokens_per_page: number
  blank_page_count: number
  blank_page_ratio: number
  short_element_ratio: number
  long_element_ratio: number
  total_elements: number
  short_element_count: number
  long_element_count: number
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
