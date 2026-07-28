import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, Layers, Plus, Users } from 'lucide-react'
import api, { setAuthToken } from '../services/api'

const token = localStorage.getItem('fd_token')
if (token) setAuthToken(token)

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  useEffect(() => {
    let mounted = true
    api.get('/profile/me').then((res) => { if (mounted) setUser(res.data.user) }).catch(() => {})
    return () => { mounted = false }
  }, [])

  return <div>
    <div className="page-heading"><div><p className="eyebrow">La tua base operativa</p><h2>Benvenuto nel caos</h2></div></div>
    {user ? <div className="dashboard-intro"><div className="user-avatar">{user.username?.slice(0, 1).toUpperCase()}</div><div><strong>Ciao, {user.username}</strong><p className="muted m-0 text-sm">Scegli da dove iniziare la tua prossima storia.</p></div></div> : <p className="muted">Caricamento profilo…</p>}
    <div className="action-grid">
      <Link to="/groups/create" className="action-card"><span className="action-icon"><Plus size={20} /></span><strong>Crea un gruppo</strong><p>Apri una lega privata e ottieni il tuo codice invito.</p></Link>
      <Link to="/groups/join" className="action-card"><span className="action-icon"><Users size={20} /></span><strong>Entra nel drama</strong><p>Hai un codice? Unisciti subito ai tuoi amici.</p></Link>
      <Link to="/events" className="action-card"><span className="action-icon"><CalendarDays size={20} /></span><strong>Eventi</strong><p>Crea le sfide e consulta cosa sta per succedere.</p></Link>
      <Link to="/cards" className="action-card"><span className="action-icon"><Layers size={20} /></span><strong>Carte Drama</strong><p>Aggiungi gli imprevisti che cambiano la partita.</p></Link>
    </div>
  </div>
}
