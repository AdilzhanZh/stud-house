import { Outlet } from 'react-router-dom'

export function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <h1 className="mb-6 text-center text-xl font-semibold text-gray-900">
          Student House
        </h1>
        <Outlet />
      </div>
    </div>
  )
}
