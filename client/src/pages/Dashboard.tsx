import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarDays, Layers, Plus, Trophy, Users } from 'lucide-react'
import api, { setAuthToken } from '../services/api'
import { CharacterMoodCard } from '../components/CharacterMoodCard'
import { RegisterPasskeyButton } from '../components/PasskeyButton'

const token = localStorage.getItem('fd_token')
if (token) setAuthToken(token)

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [overview, setOverview] = useState<any>(null)
  const navigate = useNavigate()
  useEffect(() => {
    let mounted = true
    Promise.all([api.get('/profile/me'), api.get('/profile/overview')]).then(([profile, data]) => {
      if (!mounted) return
      if (!profile.data.user.profileCompleted) { navigate('/profile/setup', { replace: true }); return }
      setUser(profile.data.user); setOverview(data.data)
    }).catch(() => {})
    return () => { mounted = false }
  }, [navigate])
  const stats = overview?.stats
  return <div><RegisterPasskeyButton />
    <div className="page-heading"><div><p className="eyebrow">La tua base operativa</p><h2>Benvenuto nel caos</h2></div></div>
    {user ? <div className="dashboard-intro"><div className="user-avatar">{user.avatar ? <img src={user.avatar} alt="" /> : user.username?.slice(0, 1).toUpperCase()}</div><div><strong>Ciao, {user.username}</strong><p className="muted m-0 text-sm">{user.crewRole || 'Jolly'} {user.city ? `· ${user.city}` : '· pronto per la prossima storia.'}</p></div><span className="intro-live"><i />drama room attiva</span></div> : <p className="muted">Caricamento profilo…</p>}
    <section className="dashboard-stats">{[[Trophy, `${stats?.credits ?? 0}`, 'Crediti disponibili'], [Users, `${stats?.groups ?? 0}`, 'Gruppi attivi'], [Layers, `${stats?.cards ?? 0}`, 'Carte create']].map(([Icon, value, label]: any) => <article key={label}><Icon size={18} /><strong>{value}</strong><span>{label}</span></article>)}</section>
    <section className="spotlight-section"><div className="spotlight-copy"><p className="eyebrow">Moodboard live</p><h3>La crew è pronta<br /><em>al colpo di scena.</em></h3><p>I tuoi punteggi e gli eventi si aggiornano automaticamente: non perdere la prossima finestra per pronosticare.</p></div><div className="spotlight-cast" aria-label="Anteprima dei personaggi"><CharacterMoodCard compact name="Leo" nickname="onfire" mood="pulse" /><CharacterMoodCard compact name="Mia" nickname="plotqueen" mood="mischief" /><CharacterMoodCard compact name="Noah" nickname="wildcard" mood="shock" /></div></section>
    <section className="dashboard-feed"><div><p className="eyebrow">Prossime mosse</p><h3>Non far scadere il drama</h3>{overview?.nextEvents?.length ? overview.nextEvents.map((event: any) => <Link className="dashboard-event-row" to={`/events/${event.id}`} key={event.id}><span>✦</span><div><b>{event.title}</b><small>{new Date(event.startsAt).toLocaleString('it-IT')}</small></div><strong>Apri</strong></Link>) : <p className="muted">Non ci sono eventi in arrivo nella tua crew.</p>}</div><div><p className="eyebrow">Ultimi aggiornamenti</p><h3>Drama feed</h3>{overview?.recentNotifications?.length ? overview.recentNotifications.map((notice: any) => <Link className="dashboard-event-row" to={notice.path || '/events'} key={notice.id}><span>✦</span><div><b>{notice.title}</b><small>{notice.message}</small></div></Link>) : <p className="muted">Le novità del gruppo compariranno qui.</p>}</div></section>
    <div className="action-grid"><Link to="/groups/create" className="action-card"><span className="action-icon"><Plus size={20} /></span><strong>Crea un gruppo</strong><p>Apri una lega privata e ottieni il tuo codice invito.</p></Link><Link to="/groups/join" className="action-card"><span className="action-icon"><Users size={20} /></span><strong>Entra nel drama</strong><p>Hai un codice? Unisciti subito ai tuoi amici.</p></Link><Link to="/events" className="action-card"><span className="action-icon"><CalendarDays size={20} /></span><strong>Gioca una carta evento</strong><p>Durante un evento live, segnala una tua carta: la crew la conferma o la nega.</p></Link><Link to="/cards" className="action-card"><span className="action-icon"><Layers size={20} /></span><strong>Carte Drama</strong><p>Aggiungi gli imprevisti che cambiano la partita.</p></Link></div>
  </div>
}
