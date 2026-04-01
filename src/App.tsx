import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import VesselDesignerPage from './pages/VesselDesignerPage'
import RfqSubmittedPage from './pages/RfqSubmittedPage'
import FabricatorDashboard from './pages/FabricatorDashboard'
import FabricatorRegisterPage from './pages/FabricatorRegisterPage'

function MobileWarningBanner() {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null
  return (
    <div className="lg:hidden bg-amber-50 border-b border-amber-200 px-4 py-3 flex items-start gap-3">
      <span className="text-amber-800 text-sm flex-1">
        VesselRFQ is designed for use on a desktop or laptop. For the best experience, please visit from a larger screen.
      </span>
      <button
        onClick={() => setDismissed(true)}
        className="text-amber-600 hover:text-amber-800 shrink-0 leading-none text-lg font-medium"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter basename="/app">
      <AuthProvider>
        <MobileWarningBanner />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/fabricator-register" element={<FabricatorRegisterPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/designer" element={<VesselDesignerPage />} />
            <Route path="/rfq-submitted" element={<RfqSubmittedPage />} />
            <Route path="/fabricator-dashboard" element={<FabricatorDashboard />} />
          </Route>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
