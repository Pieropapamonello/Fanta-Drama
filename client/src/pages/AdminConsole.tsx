import React, { FormEvent, useCallback, useEffect, useState } from 'react'
import api from '../services/api'
import AdminModeration from '../components/AdminModeration'

type Overview = { stats: { users: number, groups: number, events: number, cards: number }, groups: any[], events: any[], users: any[], cards: any[], starterCards: any[], appeals: any[] }

export default function AdminConsole() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [password, setPassword] = useState('')
  const [overview, setOverview] = useState<Overview | null>(null)
  const [notice, setNotice] = useState('')
  const [working, setWorking] = useState<string | null>(null)
  const [primaryUserId, setPrimaryUserId] = useState('')
  const [secondaryUserId, setSecondaryUserId] = useState('')

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

  const deleteCard = async (card: any) => {
    if (!window.confirm(`Eliminare “${card.title}” dal catalogo e da tutti i mazzi? Se è una nuova immagine, sarà rimossa anche da Dropbox.`)) return
    setWorking(`card-${card.id}`); setNotice('')
    try { const result = await api.delete(`/admin/cards/${card.id}`); await load(); setNotice(result.data.asset?.deleted ? 'Carta e immagine Dropbox eliminate.' : 'Carta eliminata da catalogo e mazzi. Il file storico Dropbox non aveva un percorso registrato.') }
    catch (error: any) { setNotice(error.response?.data?.error || 'Non riesco a eliminare la carta.') }
    finally { setWorking(null) }
  }

  const updatePrice = async (cardKey: string, title: string, currentPrice: number) => {
    const raw = window.prompt(`Prezzo diretto per “${title}”`, String(currentPrice || 100))
    if (raw === null) return
    const directPrice = Number(raw)
    if (!Number.isInteger(directPrice) || directPrice < 1) { setNotice('Inserisci un prezzo intero maggiore di zero.'); return }
    setWorking(`price-${cardKey}`); setNotice('')
    try {
      await api.patch('/cards/pricing', { cardKey, directPrice })
      setOverview((current) => current ? {
        ...current,
        cards: current.cards.map((card) => `custom:${card.id}` === cardKey ? { ...card, directPrice } : card),
        starterCards: (current.starterCards || []).map((card) => card.cardKey === cardKey ? { ...card, directPrice } : card)
      } : current)
      setNotice(`Prezzo di ${title} aggiornato a ${directPrice} crediti.`)
    } catch (error: any) { setNotice(error.response?.data?.error || 'Non riesco ad aggiornare il prezzo.') }
    finally { setWorking(null) }
  }

  const mergeUsers = async () => {
    if (!primaryUserId || !secondaryUserId || primaryUserId === secondaryUserId) { setNotice('Scegli due profili diversi: prima quello da mantenere, poi quello da assorbire.'); return }
    const primary = overview?.users.find((user) => user.id === primaryUserId); const secondary = overview?.users.find((user) => user.id === secondaryUserId)
    if (!window.confirm(`Unire ${secondary?.username || 'questo profilo'} dentro ${primary?.username || 'questo profilo'}? Punti, gruppi, carte e Telegram verranno trasferiti al profilo principale.`)) return
    setWorking('merge-users'); setNotice('')
    try { const result = await api.post('/admin/users/merge', { primaryId: primaryUserId, secondaryId: secondaryUserId }); await load(); setPrimaryUserId(''); setSecondaryUserId(''); setNotice(`Profili uniti: trasferiti ${result.data.moved.scores} punteggi e ${result.data.moved.predictions} pronostici.`) }
    catch (error: any) { setNotice(error.response?.data?.error || 'Non riesco a unire i profili.') } finally { setWorking(null) }
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
      <div className="admin-stats"><article><strong>{overview.stats.users}</strong><span>Utenti</span></article><article><strong>{overview.stats.groups}</strong><span>Gruppi</span></article><article><strong>{overview.stats.events}</strong><span>Eventi</span></article><article><strong>{overview.stats.cards}</strong><span>Carte community</span></article></div>
      <div className="admin-grid">
        <section className="admin-panel"><h3>Tutti i gruppi</h3>{overview.groups.length ? overview.groups.map((group) => <article className="admin-row" key={group.id}><div><strong>{group.name}</strong><p>{group.memberCount} membri · Codice: {group.code}</p></div><button type="button" className="admin-danger" onClick={() => deleteGroup(group)} disabled={working === `group-${group.id}`}>{working === `group-${group.id}` ? 'Elimino...' : 'Elimina'}</button></article>) : <p className="muted">Nessun gruppo.</p>}</section>
        <section className="admin-panel"><h3>Eventi</h3>{overview.events.length ? overview.events.map((event) => <article className="admin-row" key={event.id}><div><strong>{event.title}</strong><p>{event.groupName} · {event.state}</p></div>{event.state !== 'PRONOSTICI_CHIUSI' && <button type="button" className="btn btn-ghost" onClick={() => closeEvent(event.id)} disabled={working === `event-${event.id}`}>{working === `event-${event.id}` ? 'Chiudo...' : 'Chiudi'}</button>}</article>) : <p className="muted">Nessun evento.</p>}</section>
      </div>
      <section className="admin-panel admin-cards"><h3>Carte create dalla community</h3>{overview.cards.length ? overview.cards.map((card) => <article className="admin-row" key={card.id}>{card.imageUrl && <img className="admin-card-preview" src={card.imageUrl} alt="" />}<div><strong>{card.title}</strong><p>{card.creatorName || 'Giocatore'} · {new Date(card.createdAt).toLocaleString('it-IT')}</p></div><button type="button" className="admin-danger" onClick={() => deleteCard(card)} disabled={working === `card-${card.id}`}>{working === `card-${card.id}` ? 'Elimino...' : 'Elimina carta'}</button></article>) : <p className="muted">Nessuna carta creata dalla community.</p>}</section>
      <section className="admin-panel"><h3>Prezzi in acquisto diretto</h3><p>Puoi modificare ogni prezzo: 100 crediti è la base. I mercati diretti ancora aperti si aggiornano subito.</p><div className="admin-price-list">{overview.cards.map((card) => <article className="admin-row" key={`price-${card.id}`}><div><strong>{card.title}</strong><p>Carta community · {card.directPrice ?? 100} crediti</p></div><button type="button" className="btn btn-ghost" onClick={() => void updatePrice(`custom:${card.id}`, card.title, card.directPrice ?? 100)} disabled={working === `price-custom:${card.id}`}>Modifica</button></article>)}</div><details className="admin-starter-prices"><summary>Gestisci le {overview.starterCards?.length || 0} carte base</summary><div className="admin-price-list">{(overview.starterCards || []).map((card) => <article className="admin-row" key={card.cardKey}><div><strong>{card.title}</strong><p>{card.directPrice} crediti</p></div><button type="button" className="btn btn-ghost" onClick={() => void updatePrice(card.cardKey, card.title, card.directPrice)} disabled={working === `price-${card.cardKey}`}>Modifica</button></article>)}</div></details></section>
      <section className="admin-panel admin-users"><h3>Utenti registrati</h3><div className="admin-user-list">{overview.users.map((user) => <span key={user.id}>{user.avatar ? <img src={user.avatar} alt="" /> : <i>{String(user.username || '?').slice(0, 1).toUpperCase()}</i>}{user.username || 'Senza nome'}</span>)}</div></section>
      <section className="admin-panel admin-merge"><h3>Unisci due profili</h3><p>Usa questa funzione quando la stessa persona ha un account e-mail e uno Telegram. Il primo profilo viene mantenuto; il secondo diventa un accesso collegato.</p><div><select className="input" value={primaryUserId} onChange={(event) => setPrimaryUserId(event.target.value)}><option value="">Profilo da mantenere</option>{overview.users.filter((user) => !user.mergedInto).map((user) => <option value={user.id} key={user.id}>{user.username || user.id}</option>)}</select><select className="input" value={secondaryUserId} onChange={(event) => setSecondaryUserId(event.target.value)}><option value="">Profilo da assorbire</option>{overview.users.filter((user) => !user.mergedInto).map((user) => <option value={user.id} key={user.id}>{user.username || user.id}</option>)}</select><button type="button" className="admin-danger" onClick={() => void mergeUsers()} disabled={working === 'merge-users'}>{working === 'merge-users' ? 'Unisco...' : 'Unisci profili'}</button></div></section>
    </>}
    {overview && <AdminModeration cards={overview.cards} appeals={overview.appeals || []} onChanged={() => void load()} />}
    {notice && <p className="admin-notice">{notice}</p>}
  </section>
}
