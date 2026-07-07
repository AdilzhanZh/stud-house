import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthLayout } from './layouts/AuthLayout'
import { DashboardLayout } from './layouts/DashboardLayout'
import { LoginPage } from './features/auth/LoginPage'
import { RegisterPage } from './features/auth/RegisterPage'
import { ProfilePage } from './features/profile/ProfilePage'
import { ProtectedRoute } from './routes/ProtectedRoute'
import { useAuthBootstrap } from './features/auth/useAuthBootstrap'

function App() {
  const isReady = useAuthBootstrap()

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-gray-500">
        Жүктелуде...
      </div>
    )
  }

  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard/profile" element={<ProfilePage />} />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/dashboard/profile" replace />} />
      <Route path="*" element={<Navigate to="/dashboard/profile" replace />} />
    </Routes>
  )
}

export default App
