import React, { FormEvent, useCallback, useEffect, useState } from 'react'
import api from '../services/api'

type Overview = { stats: { users: number, groups: number, events: number }, groups: any[], events: any[], users: any[] }

export default function AdminConsole() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [password, setPassword] = useState('')
  const [overview, setOverview] = useState<Overview | null>(null)
  const [notice, setNotice] = useState('')
  const [working, setWorking] = useState<string | null>(null)

  const load = useCallback(async () => {
    const status = await api.get('/admin/status')
    setIsAdmin(Boolean(status.data.isAdmin))
    if (status.data.isAdmin) {
      const data = await api.get('/admin/overview')
      setOverview(data.data)
    }
  }, [])

  useEffect(() => { load().catch(() => setNotice('Non riesco a verificare l accesso admin.')) }, [load])

  const unlock = async (event: FormEvent) => {
    event.preventDefault()
    setWorking('unlock'); setNotice('')
    try { await api.post('/admin/unlock', { password }); setPassword(''); await load(); setNotice('Console amministratore attivata.') }
    catch (error: any) { setNotice(error.response?.data?.error === 'invalid_admin_password' ? 'Password non valida.' : 'Non riesco ad attivare la console.') }
    finally { setWorking(null) }
  }

  const closeEvent = async (id: string) => {
    setWorking(`event-${id}`); setNotice('')
    try { await api.post(`/admin/events/${id}/close`); await load(); setNotice('Evento chiuso e punteggi aggiornati.') }
    catch (error: any) { setNotice(error.response?.data?.error || 'Non riesco a chiudere l evento.') }
    finally { setWorking(null) }
  }

  const deleteGroup = async (group: any) => {
    if (!window.confirm(`Eliminare definitivamente ${group.name}? Verranno eliminati anche eventi, personaggi, pronostici e punteggi collegati.`)) return
    setWorking(`group-${group.id}`); setNotice('')
    try { await api.delete(`/groups/${group.id}`); await load(); setNotice('Gruppo eliminato.') }
    catch (error: any) { setNotice(error.response?.data?.error || 'Non riesco a eliminare il gruppo.') }
    finally { setWorking(null) }
  }

  const lock = async () => {
    await api.post('/admin/lock')
    setOverview(null); setIsAdmin(false); setNotice('Console bloccata su questo account.')
  }

  if (isAdmin === null) return <p className="muted">Controllo accesso riservato...</p>
  if (!isAdmin) return <section className="admin-gate"><p className="eyebrow">Area riservata</p><h2>Console FantaDrama</h2><p>Inserisci la password amministratore per gestire tutti i gruppi, gli eventi e gli utenti.</p><form onSubmit={unlock}><input className="input" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password amministratore" required /><button className="btn" disabled={working === 'unlock'}>{working === 'unlock' ? 'Verifica...' : 'Apri console'}</button></form>{notice && <p className="admin-notice">{notice}</p>}</section>

  return <section className="admin-console">
    <div className="page-heading"><div><p className="eyebrow">Controllo totale</p><h2>Console admin</h2><p className="page-lead">Tutti i dati FantaDrama in un unico punto.</p></div><button className="btn btn-ghost" type="button" onClick={lock}>Blocca console</button></div>
    {overview && <>
      <div className="admin-stats"><article><strong>{overview.stats.users}</strong><span>Utenti</span></article><article><strong>{overview.stats.groups}</strong><span>Gruppi</span></article><article><strong>{overview.stats.events}</strong><span>Eventi</span></article></div>
      <div className="admin-grid">
        <section className="admin-panel"><h3>Tutti i gruppi</h3>{overview.groups.length ? overview.groups.map((group) => <article className="admin-row" key={group.id}><div><strong>{group.name}</strong><p>{group.memberCount} membri · Codice: {group.code}</p></div><button type="button" className="admin-danger" onClick={() => deleteGroup(group)} disabled={working === `group-${group.id}`}>{working === `group-${group.id}` ? 'Elimino...' : 'Elimina'}</button></article>) : <p className="muted">Nessun gruppo.</p>}</section>
        <section className="admin-panel"><h3>Eventi</h3>{overview.events.length ? overview.events.map((event) => <article className="admin-row" key={event.id}><div><strong>{event.title}</strong><p>{event.groupName} · {event.state}</p></div>{event.state !== 'PRONOSTICI_CHIUSI' && <button type="button" className="btn btn-ghost" onClick={() => closeEvent(event.id)} disabled={working === `event-${event.id}`}>{working === `event-${event.id}` ? 'Chiudo...' : 'Chiudi'}</button>}</article>) : <p className="muted">Nessun evento.</p>}</section>
      </div>
      <section className="admin-panel admin-users"><h3>Utenti registrati</h3><div className="admin-user-list">{overview.users.map((user) => <span key={user.id}>{user.avatar ? <img src={user.avatar} alt="" /> : <i>{String(user.username || '?').slice(0, 1).toUpperCase()}</i>}{user.username || 'Senza nome'}</span>)}</div></section>
    </>}
    {notice && <p className="admin-notice">{notice}</p>}
  </section>
}
