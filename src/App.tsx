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

export default function App() {
  return (
    <BrowserRouter basename="/app">
      <AuthProvider>
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
