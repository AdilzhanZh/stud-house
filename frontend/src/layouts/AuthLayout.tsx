import { Outlet } from 'react-router-dom'
import { ThemeToggle } from '../components/ThemeToggle'

// Plain centered-card shell per the design spec's "Кіру" screen — no
// marketing side panel. Shared by both /login and /register.
export function AuthLayout() {
  return (
    <div className="min-h-screen bg-navy-950 font-body text-sand-100">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-10">
        <div className="mb-8 flex items-center justify-end">
          <ThemeToggle />
        </div>
        <Outlet />
      </div>
    </div>
  )
}
