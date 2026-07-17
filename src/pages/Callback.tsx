import { Navigate } from 'react-router-dom'
import { useAuth } from 'react-oidc-context'

export default function Callback() {
  const auth = useAuth()

  if (auth.isLoading) return <p>Signing you in…</p>
  if (auth.error) return <p>Login failed: {auth.error.message}</p>
  if (auth.isAuthenticated) return <Navigate to="/dashboard" replace />
  return <Navigate to="/" replace />
}
