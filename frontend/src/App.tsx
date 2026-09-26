import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './store/auth'
import Login from './pages/Login'
import WorkspaceShell from './WorkspaceShell'

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="app-loading">加载中…</div>
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={user ? <WorkspaceShell /> : <Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
