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

export interface StructureMetrics {
  filename: string
  heading_density: number
  heading_level_count: number
  heading_coverage: number
  paragraph_count: number
  list_ratio: number
  qa_ratio: number
  heading_count: number
  body_tokens: number
  heading_tokens: number
  list_tokens: number
  qa_tokens: number
}

export interface ContentTypeMetrics {
  filename: string
  table_token_ratio: number
  code_token_ratio: number
  qa_pair_ratio: number
  image_page_ratio: number
  image_area_ratio: number
  formula_ratio: number
  table_structure_success_rate: number
  total_tokens: number
  table_tokens: number
  code_tokens: number
  qa_pair_tokens: number
  formula_tokens: number
  table_candidates: number
  table_success: number
}

export interface TableImageMetrics {
  filename: string
  table_token_ratio: number
  table_recovery_rate: number
  table_avg_rows: number
  image_count_per_page: number
  image_page_coverage: number
  image_semantic_coverage: number
  total_tokens: number
  body_tokens: number
  table_tokens: number
  table_candidates: number
  table_success: number
  image_instances: number
  image_total: number
  image_semantic: number
  page_count: number
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
