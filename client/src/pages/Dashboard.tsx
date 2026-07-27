import React, { useEffect, useState } from 'react'
import api, { setAuthToken } from '../services/api'

const token = localStorage.getItem('fd_token')
if (token) setAuthToken(token)

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    let mounted = true
    api.get('/profile/me').then((res) => {
      if (mounted) setUser(res.data.user)
    }).catch(() => {})
    return () => { mounted = false }
  }, [])

  return (
    <div>
      <h2 className="text-2xl mb-4">Dashboard</h2>
      {user ? <p>Benvenuto, {user.username}</p> : <p>Caricamento...</p>}
    </div>
  )
}
