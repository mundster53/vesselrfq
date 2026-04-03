import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../lib/api'

function dbg(msg: string, data?: unknown) {
  const entry = `[${new Date().toISOString()}] [FabricatorRoute] ${msg}${data !== undefined ? ' ' + JSON.stringify(data) : ''}`
  console.log(entry)
  try {
    const prev = JSON.parse(localStorage.getItem('vrfq_debug') ?? '[]') as string[]
    localStorage.setItem('vrfq_debug', JSON.stringify([...prev.slice(-20), entry]))
  } catch {}
}

export default function FabricatorRoute() {
  const { user } = useAuth()
  const [checkoutError, setCheckoutError] = useState('')

  dbg('render', { role: user?.role, active: user?.active, typeofActive: typeof user?.active })

  const needsPayment = user?.role === 'fabricator' && user.active === false

  dbg('needsPayment=' + needsPayment)

  useEffect(() => {
    if (!needsPayment) return
    dbg('calling checkout API')
    api.post<{ url: string }>('/fabricator/checkout', {})
      .then(({ url }) => {
        dbg('checkout URL received', { url })
        window.location.href = url
      })
      .catch((err) => {
        dbg('checkout failed', { message: (err as Error)?.message })
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
