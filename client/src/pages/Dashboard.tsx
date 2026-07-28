import React, { useEffect, useState } from 'react'
import api, { setAuthToken } from '../services/api'
import { Link } from 'react-router-dom'

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

  return <div>
    <h2 className="text-2xl font-bold mb-2">Dashboard</h2>
    {user ? <p className="mb-6">Ciao {user.username}, da qui puoi creare e gestire il tuo gioco.</p> : <p>Caricamento...</p>}
    <div className="grid gap-3 sm:grid-cols-2">
      <Link to="/groups/create" className="rounded-lg border bg-white p-4 shadow-sm"><strong>Crea un gruppo</strong><p className="mt-1 text-sm">Inizia una lega privata e ottieni un codice invito.</p></Link>
      <Link to="/groups/join" className="rounded-lg border bg-white p-4 shadow-sm"><strong>Entra in un gruppo</strong><p className="mt-1 text-sm">Usa il codice ricevuto da un amico.</p></Link>
      <Link to="/events" className="rounded-lg border bg-white p-4 shadow-sm"><strong>Eventi</strong><p className="mt-1 text-sm">Crea o consulta gli eventi del gruppo.</p></Link>
      <Link to="/cards" className="rounded-lg border bg-white p-4 shadow-sm"><strong>Carte Drama</strong><p className="mt-1 text-sm">Gestisci le carte per i pronostici.</p></Link>
    </div>
  </div>
}
