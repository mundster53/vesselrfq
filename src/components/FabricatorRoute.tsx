import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../lib/api'

export default function FabricatorRoute() {
  const { user } = useAuth()
  const [checkoutError, setCheckoutError] = useState('')

  const needsPayment = user?.role === 'fabricator' && user.active === false

  useEffect(() => {
    if (!needsPayment) return
    api.post<{ url: string }>('/fabricator/checkout')
      .then(({ url }) => { window.location.href = url })
      .catch(() => setCheckoutError('Unable to start checkout. Please contact support.'))
  }, [needsPayment])

  if (!user) return <Navigate to="/login" replace />

  if (needsPayment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-2">
          {checkoutError
            ? <p className="text-sm text-red-600">{checkoutError}</p>
            : <p className="text-sm text-slate-500">Redirecting to payment…</p>
          }
        </div>
      </div>
    )
  }

  return <Outlet />
}
