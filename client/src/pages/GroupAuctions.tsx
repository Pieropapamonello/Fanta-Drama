import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CalendarDays, Gavel, Sparkles } from 'lucide-react'
import api from '../services/api'

function dateLabel(value?: string) {
  return value ? new Date(value).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' }) : 'Data da definire'
}

function CardGrid({ cards, onChoose }: { cards: any[]; onChoose: (card: any) => void }) {
  if (!cards.length) return <p className="auction-catalog-empty">Nessuna carta in questa sezione.</p>
  return <div className="auction-catalog-grid">{cards.map((card) => <button type="button" key={card.id} onClick={() => onChoose(card)} className={card.status === 'OPEN' ? '' : 'is-closed'}>
    {card.imageUrl ? <img src={card.imageUrl} alt="" /> : <i>✦</i>}
    <span><small>{card.rarity}</small><b>{card.title}</b><em>{card.currentBid ? `${card.currentBid} crediti` : `Base ${card.openingBid} crediti`}</em></span>
  </button>)}</div>
}

export default function GroupAuctions() {
  const { groupId } = useParams()
  const [group, setGroup] = useState<any>(null)
  const [events, setEvents] = useState<any[]>([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [auctions, setAuctions] = useState<any[]>([])
  const [wallet, setWallet] = useState<any>(null)
  const [selected, setSelected] = useState<any>(null)
  const [amount, setAmount] = useState('')
  const [working, setWorking] = useState(false)
  const [notice, setNotice] = useState('')

  const loadGroup = useCallback(async () => {
    if (!groupId) return
    try {
      const [groupData, eventData] = await Promise.all([api.get(`/groups/${groupId}`), api.get(`/events?groupId=${groupId}`)])
      const items = eventData.data.events || []
      setGroup(groupData.data.group); setEvents(items)
      setSelectedEventId((current) => current || items.find((event: any) => event.phase === 'IN_ARRIVO' || event.phase === 'LIVE')?.id || items[0]?.id || '')
    } catch { setNotice('Non riesco a caricare gli eventi della crew.') }
  }, [groupId])

  const loadAuctions = useCallback(async () => {
    if (!selectedEventId) { setAuctions([]); return }
    try {
      const response = await api.get(`/auctions/event/${selectedEventId}`)
      setAuctions(response.data.auctions || []); setWallet(response.data.wallet || null)
    } catch { setNotice('Non riesco a caricare le carte di questo evento.') }
  }, [selectedEventId])

  useEffect(() => { void loadGroup() }, [loadGroup])
  useEffect(() => { void loadAuctions() }, [loadAuctions])

  const commonCards = useMemo(() => auctions.filter((card) => String(card.cardKey || '').startsWith('starter:')), [auctions])
  const createdCards = useMemo(() => auctions.filter((card) => !String(card.cardKey || '').startsWith('starter:')), [auctions])
  const credits = Math.max(0, Number(wallet?.balance ?? 0) - Number(wallet?.reserved ?? 0))
  const minimum = selected ? (selected.leaderId ? Number(selected.currentBid) + Number(selected.minIncrement) : Number(selected.openingBid)) : 0

  const choose = (card: any) => { setSelected(card); setAmount(String(card.leaderId ? Number(card.currentBid) + Number(card.minIncrement) : Number(card.openingBid))); setNotice('') }
  const bid = async () => {
    if (!selected) return
    setWorking(true); setNotice('')
    try {
      const offer = Number(amount)
      await api.post(`/auctions/${selected.id}/bid`, { amount: offer })
      setSelected(null); setNotice(`Offerta di ${offer} crediti registrata. Gli altri partecipanti sono stati avvisati per rilanciare.`)
      await loadAuctions()
    } catch (error: any) {
      const code = error.response?.data?.error
      setNotice(code === 'insufficient_credits' ? 'Non hai abbastanza crediti disponibili.' : code === 'bid_too_low' ? `L’offerta minima è ${minimum} crediti.` : code === 'auction_closed' ? 'L’asta è già chiusa.' : 'Non riesco a registrare l’offerta.')
    } finally { setWorking(false) }
  }

  if (!group) return <div className="empty-state">Sto aprendo le aste della crew…</div>
  return <div className="group-auctions-page">
    <section className="group-auctions-hero"><p className="eyebrow">Mercato della crew</p><h2>Carte per {group.name}</h2><p>Scegli un evento, apri una carta e fai un’offerta. Tutti i partecipanti ricevono una notifica quando qualcuno rilancia.</p><div><span><Gavel size={15} /> {credits} crediti disponibili</span><Link to={`/groups/${group.id}`} className="btn btn-ghost">Torna alla stanza</Link></div></section>
    {events.length ? <><section className="auction-event-picker"><p className="eyebrow">Scegli l’evento</p><div>{events.map((event) => <button type="button" key={event.id} onClick={() => setSelectedEventId(event.id)} className={selectedEventId === event.id ? 'is-selected' : ''}><CalendarDays size={15} /><span><b>{event.title}</b><small>Inizio: {dateLabel(event.startsAt)}</small></span></button>)}</div></section>
      <section className="auction-catalog-section"><div><p className="eyebrow">Carte comuni</p><h3>Carte base del gioco <span>{commonCards.length}</span></h3><p>Disponibili per questo evento e acquistabili con i crediti.</p></div><CardGrid cards={commonCards} onChoose={choose} /></section>
      <section className="auction-catalog-section"><div><p className="eyebrow">Create dalla community</p><h3>Carte create per l’evento <span>{createdCards.length}</span></h3><p>Carte uniche generate dai giocatori, già incluse nelle aste dell’evento.</p></div><CardGrid cards={createdCards} onChoose={choose} /></section>
    </> : <section className="empty-state"><Sparkles size={20} /><p>Non ci sono eventi nella crew: crea il primo evento e le aste di tutte le carte verranno preparate automaticamente.</p><Link to="/events/create" className="btn">+ Crea evento</Link></section>}
    {notice && <p className="prediction-message" role="status">{notice}</p>}
    {selected && <div className="auction-offer-backdrop" role="presentation" onMouseDown={() => !working && setSelected(null)}><section role="dialog" aria-modal="true" aria-label={`Offerta per ${selected.title}`} onMouseDown={(event) => event.stopPropagation()}>
      <button type="button" className="participant-close" onClick={() => setSelected(null)} disabled={working}>×</button>
      {selected.imageUrl && <img src={selected.imageUrl} alt="" />}<p className="eyebrow">{selected.rarity} · Asta evento</p><h3>{selected.title}</h3><p>{selected.description}</p><span className="offer-current">{selected.currentBid ? `Offerta attuale: ${selected.currentBid} crediti` : `Base d’asta: ${selected.openingBid} crediti`}</span>
      {selected.status === 'OPEN' ? <div className="auction-offer-form"><label>La tua offerta<input className="input" type="number" min={minimum} value={amount} onChange={(event) => setAmount(event.target.value)} /></label><small>Minimo {minimum} crediti · disponibili {credits}</small><button type="button" className="btn" onClick={() => void bid()} disabled={working}>{working ? 'Invio offerta…' : 'Fai offerta e avvisa la crew'}</button></div> : <p className="profile-error">Questa asta è chiusa.</p>}
    </section></div>}
  </div>
}
