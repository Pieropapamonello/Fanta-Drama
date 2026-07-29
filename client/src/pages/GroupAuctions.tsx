import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Gavel, Sparkles } from 'lucide-react'
import api from '../services/api'

const cardKey = (card: any) => card.catalogCardId ? `custom:${card.catalogCardId}` : `starter:${card.slug}`

export default function GroupAuctions() {
  const { groupId } = useParams()
  const [group, setGroup] = useState<any>(null)
  const [cards, setCards] = useState<any[]>([])
  const [auctions, setAuctions] = useState<any[]>([])
  const [wallet, setWallet] = useState<any>(null)
  const [selected, setSelected] = useState<any>(null)
  const [amount, setAmount] = useState('20')
  const [working, setWorking] = useState(false)
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    if (!groupId) return
    try {
      const [groupData, cardsData, marketData] = await Promise.all([api.get(`/groups/${groupId}`), api.get('/cards/library'), api.get(`/groups/${groupId}/market-auctions`)])
      setGroup(groupData.data.group); setCards(cardsData.data.cards || []); setAuctions(marketData.data.auctions || []); setWallet(marketData.data.wallet || null)
    } catch { setNotice('Non riesco a caricare il mercato della crew.') }
  }, [groupId])

  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 20_000); return () => window.clearInterval(timer) }, [load])

  const enriched = useMemo(() => cards.map((card) => ({ ...card, cardKey: cardKey(card), auction: auctions.find((auction) => auction.cardKey === cardKey(card)) || null })), [cards, auctions])
  const commonCards = enriched.filter((card) => card.cardKey.startsWith('starter:'))
  const createdCards = enriched.filter((card) => !card.cardKey.startsWith('starter:'))
  const credits = Math.max(0, Number(wallet?.balance ?? 0) - Number(wallet?.reserved ?? 0))
  const minimum = selected?.auction ? (selected.auction.leaderId ? Number(selected.auction.currentBid) + Number(selected.auction.minIncrement) : Number(selected.auction.openingBid)) : 20

  const choose = (card: any) => { setSelected(card); setAmount(String(card.auction?.leaderId ? Number(card.auction.currentBid) + Number(card.auction.minIncrement) : card.auction?.openingBid || 20)); setNotice('') }
  const startAuction = async () => {
    if (!groupId || !selected) return
    setWorking(true); setNotice('')
    try {
      const response = await api.post(`/groups/${groupId}/market-auctions`, { cardKey: selected.cardKey })
      const auction = response.data.auction
      setAuctions((all) => [...all.filter((item) => item.cardKey !== auction.cardKey), auction])
      setSelected((current: any) => ({ ...current, auction }))
      setAmount(String(auction.openingBid))
      setNotice(response.data.alreadyStarted ? 'L’asta era già attiva: puoi fare la tua offerta.' : 'Asta avviata. Tutti gli altri partecipanti sono stati avvisati.')
    } catch { setNotice('Non riesco ad avviare l’asta per questa carta.') } finally { setWorking(false) }
  }
  const bid = async () => {
    if (!selected?.auction) return
    setWorking(true); setNotice('')
    try {
      const offer = Number(amount)
      await api.post(`/auctions/${selected.auction.id}/bid`, { amount: offer })
      setSelected(null); setNotice(`Offerta di ${offer} crediti registrata. Gli altri partecipanti sono stati avvisati per rilanciare.`)
      await load()
    } catch (error: any) {
      const code = error.response?.data?.error
      setNotice(code === 'insufficient_credits' ? 'Non hai abbastanza crediti disponibili.' : code === 'bid_too_low' ? `L’offerta minima è ${minimum} crediti.` : code === 'auction_closed' ? 'L’asta è già chiusa.' : 'Non riesco a registrare l’offerta.')
    } finally { setWorking(false) }
  }

  if (!group) return <div className="empty-state">Sto aprendo il mercato della crew…</div>
  const section = (title: string, eyebrow: string, items: any[], description: string) => <section className="auction-catalog-section"><div><p className="eyebrow">{eyebrow}</p><h3>{title} <span>{items.length}</span></h3><p>{description}</p></div><div className="auction-catalog-grid">{items.map((card) => <button type="button" key={card.cardKey} onClick={() => choose(card)} className={card.auction?.status === 'WON' ? 'is-closed' : ''}>{card.imageUrl ? <img src={card.imageUrl} alt="" /> : <i>✦</i>}<span><small>{card.rarity}</small><b>{card.title}</b><em>{card.auction ? card.auction.status === 'WON' ? 'Già acquistata' : card.auction.currentBid ? `${card.auction.currentBid} crediti` : `Asta aperta · base ${card.auction.openingBid}` : 'Tocca per avviare l’asta'}</em></span></button>)}</div></section>

  return <div className="group-auctions-page"><section className="group-auctions-hero"><p className="eyebrow">Mercato della crew</p><h2>Carte per {group.name}</h2><p>Scegli una carta e invia la richiesta di acquisto: parte un’asta privata di 24 ore. I membri della crew ricevono subito l’avviso per poter rilanciare.</p><div><span><Gavel size={15} /> {credits} crediti disponibili</span><Link to={`/groups/${group.id}`} className="btn btn-ghost">Torna alla stanza</Link></div></section>{section('Carte comuni', 'Carte base del gioco', commonCards, 'Tutte le carte base disponibili per l’asta di questa crew.')}{section('Carte create dagli utenti', 'Create dalla community', createdCards, 'Carte uniche pubblicate dagli utenti e acquistabili anche qui.')} {notice && <p className="prediction-message" role="status">{notice}</p>}
    {selected && <div className="auction-offer-backdrop" role="presentation" onMouseDown={() => !working && setSelected(null)}><section role="dialog" aria-modal="true" aria-label={`Asta per ${selected.title}`} onMouseDown={(event) => event.stopPropagation()}><button type="button" className="participant-close" onClick={() => setSelected(null)} disabled={working}>×</button>{selected.imageUrl && <img src={selected.imageUrl} alt="" />}<p className="eyebrow">{selected.rarity} · Asta privata</p><h3>{selected.title}</h3><p>{selected.description}</p>{!selected.auction ? <div className="auction-offer-form"><small>La richiesta aprirà un’asta di 24 ore e avviserà subito tutti i partecipanti.</small><button type="button" className="btn" onClick={() => void startAuction()} disabled={working}>{working ? 'Apro l’asta…' : <><Sparkles size={16} /> Richiedi acquisto e avvia asta</>}</button></div> : selected.auction.status === 'OPEN' ? <><span className="offer-current">{selected.auction.currentBid ? `Offerta attuale: ${selected.auction.currentBid} crediti` : `Base d’asta: ${selected.auction.openingBid} crediti`}</span><div className="auction-offer-form"><label>La tua offerta<input className="input" type="number" min={minimum} value={amount} onChange={(event) => setAmount(event.target.value)} /></label><small>Minimo {minimum} crediti · disponibili {credits}</small><button type="button" className="btn" onClick={() => void bid()} disabled={working}>{working ? 'Invio offerta…' : 'Fai offerta e avvisa la crew'}</button></div></> : <p className="profile-error">Questa carta è già stata acquistata nella crew.</p>}</section></div>}</div>
}
