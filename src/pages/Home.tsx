import { Navigate } from 'react-router-dom'
import { useAuth } from 'react-oidc-context'

export default function Home() {
  const auth = useAuth()

  if (auth.isAuthenticated) return <Navigate to="/dashboard" replace />

  return (
    <main>
      <h1>Welcome</h1>
      <button type="button" onClick={() => auth.signinRedirect()}>
        Login
      </button>
    </main>
  )
}
