import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarDays, Layers, Plus, Users } from 'lucide-react'
import api, { setAuthToken } from '../services/api'
import { CharacterMoodCard } from '../components/CharacterMoodCard'

const token = localStorage.getItem('fd_token')
if (token) setAuthToken(token)

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const navigate = useNavigate()
  useEffect(() => {
    let mounted = true
    api.get('/profile/me').then((res) => {
      if (!mounted) return
      if (!res.data.user.profileCompleted) { navigate('/profile/setup', { replace: true }); return }
      setUser(res.data.user)
    }).catch(() => {})
    return () => { mounted = false }
  }, [navigate])

  return <div>
    <div className="page-heading"><div><p className="eyebrow">La tua base operativa</p><h2>Benvenuto nel caos</h2></div></div>
    {user ? <div className="dashboard-intro"><div className="user-avatar">{user.avatar ? <img src={user.avatar} alt="" /> : user.username?.slice(0, 1).toUpperCase()}</div><div><strong>Ciao, {user.username}</strong><p className="muted m-0 text-sm">{user.crewRole || 'Jolly'} {user.city ? `· ${user.city}` : '· pronto per la prossima storia.'}</p></div><span className="intro-live"><i />drama room attiva</span></div> : <p className="muted">Caricamento profilo…</p>}
    <section className="spotlight-section">
      <div className="spotlight-copy"><p className="eyebrow">Moodboard live</p><h3>La crew è pronta<br /><em>al colpo di scena.</em></h3><p>I personaggi si accendono, cambiano mood e fanno capire subito dove sta andando il caos.</p></div>
      <div className="spotlight-cast" aria-label="Anteprima dei personaggi">
        <CharacterMoodCard compact name="Leo" nickname="onfire" mood="pulse" />
        <CharacterMoodCard compact name="Mia" nickname="plotqueen" mood="mischief" />
        <CharacterMoodCard compact name="Noah" nickname="wildcard" mood="shock" />
      </div>
    </section>
    <div className="action-grid">
      <Link to="/groups/create" className="action-card"><span className="action-icon"><Plus size={20} /></span><strong>Crea un gruppo</strong><p>Apri una lega privata e ottieni il tuo codice invito.</p></Link>
      <Link to="/groups/join" className="action-card"><span className="action-icon"><Users size={20} /></span><strong>Entra nel drama</strong><p>Hai un codice? Unisciti subito ai tuoi amici.</p></Link>
      <Link to="/events" className="action-card"><span className="action-icon"><CalendarDays size={20} /></span><strong>Eventi</strong><p>Crea le sfide e consulta cosa sta per succedere.</p></Link>
      <Link to="/cards" className="action-card"><span className="action-icon"><Layers size={20} /></span><strong>Carte Drama</strong><p>Aggiungi gli imprevisti che cambiano la partita.</p></Link>
    </div>
  </div>
}
