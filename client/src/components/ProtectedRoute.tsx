import React from 'react'
import { Navigate } from 'react-router-dom'

export default function ProtectedRoute({ children }: { children: JSX.Element }) {
  const token = localStorage.getItem('fd_token')
  if (!token) return <Navigate to="/login" replace />
  return children
}
