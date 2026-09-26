import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '../api/client'
import type { User } from '../api/types'
import { useAuth } from '../store/auth'

interface Props {
  open: boolean
  onClose: () => void
}

export default function UserPanel({ open, onClose }: Props) {
  const { user: me } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      setUsers(await api.get<User[]>('/api/users'))
    } catch {
      setUsers([])
    }
  }, [])

  useEffect(() => {
    if (open) {
      load()
      setError('')
      setUsername('')
      setPassword('')
    }
  }, [open, load])

  async function add() {
    setError('')
    try {
      await api.post('/api/users', { username, password })
      setUsername('')
      setPassword('')
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '创建失败')
    }
  }

  async function remove(id: string) {
    if (!confirm('删除该用户？')) return
    try {
      await api.del(`/api/users/${id}`)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '删除失败')
    }
  }

  if (!open) return null

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>用户管理</span>
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="add-user-form">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="用户名"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="密码（≥6 位）"
            />
            <button className="btn btn-primary" onClick={add} disabled={!username.trim() || !password}>
              添加
            </button>
          </div>
          {error && <div className="login-error" style={{ marginBottom: 8 }}>{error}</div>}
          {users.map((u) => (
            <div className="user-row" key={u.id}>
              <div className="uinfo">
                <div className="uname">
                  {u.username}
                  {u.id === me?.id ? '（我）' : ''}
                </div>
                <div className="urole">
                  {u.role === 'admin' ? '管理员' : '成员'} · {u.created_at.slice(0, 10)}
                </div>
              </div>
              {u.id !== me?.id && (
                <button className="btn btn-danger" onClick={() => remove(u.id)}>
                  删除
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
