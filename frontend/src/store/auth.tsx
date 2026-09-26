import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, ApiError, clearToken, getToken, setToken } from '../api/client'
import type { User } from '../api/types'

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (tenantCode: string, username: string, password: string) => Promise<void>
  register: (tenantName: string, tenantCode: string, username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const TENANT_KEY = 'rag_tenant_code'
export function getTenantCode() { return localStorage.getItem(TENANT_KEY) || '' }
function saveTenantCode(code: string) { localStorage.setItem(TENANT_KEY, code) }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const handleUnauthorized = () => setUser(null)
    window.addEventListener('rag:unauthorized', handleUnauthorized)
    if (!getToken()) {
      setLoading(false)
      return () => window.removeEventListener('rag:unauthorized', handleUnauthorized)
    }
    api
      .get<User>('/api/auth/me')
      .then(setUser)
      .catch((error: unknown) => {
        // Keep the token on network/server failures; only an invalid/expired token is cleared.
        if (error instanceof ApiError && error.status === 401) clearToken()
        setUser(null)
      })
      .finally(() => setLoading(false))
    return () => window.removeEventListener('rag:unauthorized', handleUnauthorized)
  }, [])

  async function login(tenantCode: string, username: string, password: string) {
    const res = await api.post<{ token: string; tenant_code: string; user: User }>('/api/auth/login', {
      tenant_code: tenantCode,
      username,
      password,
    })
    setToken(res.token)
    saveTenantCode(res.tenant_code)
    setUser(res.user)
  }

  async function register(tenantName: string, tenantCode: string, username: string, password: string) {
    const res = await api.post<{ token: string; tenant_code: string; user: User }>('/api/auth/register', {
      tenant_name: tenantName,
      tenant_code: tenantCode,
      username,
      password,
    })
    setToken(res.token)
    saveTenantCode(res.tenant_code)
    setUser(res.user)
  }

  function logout() {
    clearToken()
    setUser(null)
    window.location.hash = '#/login'
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
