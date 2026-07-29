import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'

export default function ProtectedRoute({ children }: { children: JSX.Element }) {
  const location = useLocation()
  const token = localStorage.getItem('fd_token')
  if (!token) { sessionStorage.setItem('fd_after_login', `${location.pathname}${location.search}`); return <Navigate to="/login" replace /> }
  return children
}
