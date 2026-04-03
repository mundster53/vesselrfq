import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../lib/api'

export default function BuyerProfileGuard() {
  const { user } = useAuth()
  const [checking, setChecking] = useState(true)
  const [hasProfile, setHasProfile] = useState(false)

  useEffect(() => {
    // Only buyers need a profile — fabricators pass through
    if (!user || user.role !== 'buyer') {
      setChecking(false)
      return
    }

    api.get<{ exists: boolean }>('/buyer/profile')
      .then(({ exists }) => setHasProfile(exists))
      .catch(() => setHasProfile(true)) // on error, don't block access
      .finally(() => setChecking(false))
  }, [user])

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <span className="text-slate-500 text-sm">Loading…</span>
      </div>
    )
  }

  if (user?.role === 'buyer' && !hasProfile) {
    return <Navigate to="/buyer-profile" replace />
  }

  return <Outlet />
}
