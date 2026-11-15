import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './store/auth'
import Login from './pages/Login'
import WorkspaceShell from './WorkspaceShell'
import { WORKSPACE_PATHS } from './workspaceRoutes'

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="app-loading">加载中…</div>
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={WORKSPACE_PATHS.dashboard} replace /> : <Login />} />
      <Route path="/*" element={user ? <WorkspaceShell /> : <Navigate to="/login" replace />} />
    </Routes>
  )
}
