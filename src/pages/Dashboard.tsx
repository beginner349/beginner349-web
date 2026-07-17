import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from 'react-oidc-context'

export default function Dashboard() {
  const auth = useAuth()
  const [securedResponse, setSecuredResponse] = useState('')

  if (auth.isLoading) return <p>Signing you in…</p>
  if (!auth.isAuthenticated) return <Navigate to="/" replace />

  const callSecured = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/secured`, {
        headers: { Authorization: `Bearer ${auth.user?.access_token}` },
      })
      setSecuredResponse(res.ok ? await res.text() : `Error: ${res.status}`)
    } catch (err) {
      setSecuredResponse(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <main>
      <h1>Dashboard</h1>
      <p>Logged in as {auth.user?.profile.preferred_username}</p>
      <button type="button" onClick={callSecured}>
        Call /secured
      </button>
      {securedResponse && <p>{securedResponse}</p>}
      <button type="button" onClick={() => auth.signoutRedirect()}>
        Logout
      </button>
    </main>
  )
}
