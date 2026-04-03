import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../lib/api'

export default function FabricatorRoute() {
  const { user } = useAuth()
  const [checkoutError, setCheckoutError] = useState('')

  console.log('[FabricatorRoute] user:', user, '| active:', user?.active, '| typeof active:', typeof user?.active)

  const needsPayment = user?.role === 'fabricator' && user.active === false

  console.log('[FabricatorRoute] needsPayment:', needsPayment)

  useEffect(() => {
    if (!needsPayment) return
    console.log('[FabricatorRoute] needsPayment=true, calling checkout API')
    api.post<{ url: string }>('/fabricator/checkout', {})
      .then(({ url }) => {
        console.log('[FabricatorRoute] checkout URL received:', url)
        window.location.href = url
      })
      .catch((err) => {
        console.error('[FabricatorRoute] checkout failed:', err)
        setCheckoutError('Unable to start checkout. Please contact support.')
      })
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
