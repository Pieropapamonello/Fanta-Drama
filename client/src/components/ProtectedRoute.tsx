import React, { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { Navigate, useLocation } from 'react-router-dom'
import { firebaseAuth } from '../services/firebase'

export default function ProtectedRoute({ children }: { children: JSX.Element }) {
  const location = useLocation()
  const [ready, setReady] = useState(false)
  const [hasSession, setHasSession] = useState(Boolean(firebaseAuth.currentUser) || Boolean(localStorage.getItem('fd_token')))

  useEffect(() => onAuthStateChanged(firebaseAuth, (user) => {
    setHasSession(Boolean(user))
    setReady(true)
  }), [])

  // Firebase restores its local session asynchronously after a PWA/browser
  // starts. Waiting here prevents an old one-hour ID token from logging the
  // player out before Firebase can refresh it.
  if (!ready) return <div className="empty-state" role="status">Ripristino il tuo accesso...</div>
  if (!hasSession) { sessionStorage.setItem('fd_after_login', `${location.pathname}${location.search}`); return <Navigate to="/login" replace /> }
  return children
}
