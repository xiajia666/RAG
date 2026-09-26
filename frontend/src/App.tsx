import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './store/auth'
import Login from './pages/Login'
import Chat from './pages/Chat'

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="app-loading">加载中…</div>
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={user ? <Chat /> : <Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
