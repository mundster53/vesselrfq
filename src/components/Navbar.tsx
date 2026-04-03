import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <header className="bg-slate-900 text-white shrink-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link to="/dashboard" className="font-semibold text-base tracking-tight">
          VesselRFQ
        </Link>
        {user && (
          <div className="flex items-center gap-5 text-sm">
            {user.role === 'buyer' && (
              <Link to="/designer" className="text-slate-300 hover:text-white transition-colors">
                New RFQ
              </Link>
            )}
            {user.role === 'buyer' && (
              <Link to="/buyer-profile" className="text-slate-300 hover:text-white transition-colors">
                My profile
              </Link>
            )}
            <span className="text-slate-500 truncate max-w-xs">{user.email}</span>
            <button
              onClick={handleLogout}
              className="text-slate-400 hover:text-white transition-colors"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
