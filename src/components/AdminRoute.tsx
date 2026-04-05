import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function AdminRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <span className="text-slate-500 text-sm">Loading…</span>
      </div>
    )
  }

  if (!user || user.role !== 'admin') return <Navigate to="/login" replace />

  return <Outlet />
}
