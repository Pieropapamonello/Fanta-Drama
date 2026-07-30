import React, { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Gavel, Play, ShieldQuestion, ShoppingBag } from 'lucide-react'
import api from '../services/api'

type Props = { eventId: string; phase?: string; acquisitionMode?: 'AUCTION' | 'DIRECT'; closesAt?: string; onSaved?: () => void }

function timeLeft(value?: string) {
  const seconds = Math.max(0, Math.ceil((new Date(value || '').getTime() - Date.now()) / 1000))
  if (!seconds) return 'chiusa'
  const hours = Math.floor(seconds / 3600); const minutes = Math.floor((seconds % 3600) / 60)
  return hours ? `${hours}h ${minutes}m` : `${minutes} min`
}

function claimLabel(status: string) {
  if (status === 'CONFIRMED') return 'Confermata'
  if (status === 'DENIED') return 'Contestata'
  return 'In attesa di conferme'
}

export default function PredictionForm({ eventId, phase, acquisitionMode = 'AUCTION', onSaved }: Props) {
  const [cards, setCards] = useState<any[]>([])
  const [claims, setClaims] = useState<any[]>([])
  const [wallet, setWallet] = useState<any>(null)
  const [amount, setAmount] = useState('')
  const [message, setMessage] = useState('')
  const [working, setWorking] = useState('')
  const [currentUserId, setCurrentUserId] = useState('')
  const [selectedCard, setSelectedCard] = useState<any>(null)
  const loadingRef = useRef(false)

  const load = async () => {
    if (loadingRef.current) return
    loadingRef.current = true
    try {
      const cardData = await api.get(`/auctions/event/${eventId}`)
      setCards(cardData.data.auctions || []); setWallet(cardData.data.wallet); setCurrentUserId(cardData.data.currentUserId || '')
    } catch (error: any) {
      const code = error.response?.data?.error
      setMessage(code === 'join_event_first' ? 'Entra nell’evento prima di aprire il mercato.' : code === 'event_not_found' ? 'Non posso aprire il mercato di questo evento.' : `Non riesco a caricare le carte${code ? ` (${code})` : ''}.`)
    }
    try { const claimData = await api.get(`/claims/event/${eventId}`); setClaims(claimData.data.claims || []) }
    catch { /* A temporary verification error never hides the market. */ }
    finally { loadingRef.current = false }
  }

  useEffect(() => { void load(); const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load() }, 30_000); return () => window.clearInterval(timer) }, [eventId])

  const openCard = (card: any) => { const minimum = card.leaderId ? Number(card.currentBid) + Number(card.minIncrement) : Number(card.openingBid); setAmount(String(minimum)); setSelectedCard(card); setMessage('') }
  const bid = async (card: any) => {
    const offer = Number(amount); setWorking(`bid-${card.id}`); setMessage('')
    try { await api.post(`/auctions/${card.id}/bid`, { amount: offer }); setSelectedCard(null); setMessage(`Offerta di ${offer} crediti registrata.`); await load(); onSaved?.() }
    catch (error: any) { const code = error.response?.data?.error; const minimum = card.leaderId ? card.currentBid + card.minIncrement : card.openingBid; setMessage(code === 'insufficient_credits' ? 'Non hai abbastanza crediti disponibili.' : code === 'bid_too_low' ? `Devi offrire almeno ${minimum} crediti.` : code === 'auction_closed' ? 'L’asta è già chiusa.' : 'Non riesco a registrare il rilancio.') }
    finally { setWorking('') }
  }
  const buy = async (card: any) => {
    setWorking(`buy-${card.id}`); setMessage('')
    try { await api.post(`/auctions/${card.id}/buy`); setSelectedCard(null); setMessage(`${card.title} acquistata: vale solo per questo evento.`); await load(); onSaved?.() }
    catch (error: any) { const code = error.response?.data?.error; setMessage(code === 'insufficient_credits' ? 'Non hai abbastanza crediti disponibili.' : code === 'direct_purchase_closed' ? 'Gli acquisti per questo evento sono chiusi.' : 'Non riesco a completare l’acquisto.') }
    finally { setWorking('') }
  }
  const play = async (card: any) => {
    const note = window.prompt(`Racconta come si è verificata “${card.title}” (facoltativo):`) ?? ''
    setWorking(`play-${card.id}`); setMessage('')
    try { await api.post(`/claims/event/${eventId}`, { auctionId: card.id, note }); setSelectedCard(null); setMessage(`Carta giocata: vale ${cardValue(card)} punti e attende due conferme oppure una decisione admin.`); await load(); onSaved?.() }
    catch (error: any) { const code = error.response?.data?.error; setMessage(code === 'claim_not_available' ? 'Puoi giocare una carta soltanto durante l’evento.' : code === 'card_already_played' || code === 'claim_already_exists' ? 'Questa carta è già stata giocata e non può essere riutilizzata.' : 'Non riesco a giocare la carta.') }
    finally { setWorking('') }
  }
  const vote = async (claimItem: any, decision: 'CONFIRM' | 'DENY') => { setWorking(`vote-${claimItem.id}`); try { await api.post(`/claims/${claimItem.id}/vote`, { vote: decision }); await load(); onSaved?.() } catch (error: any) { const code = error.response?.data?.error; setMessage(code === 'claimant_cannot_vote' ? 'Non puoi approvare la tua stessa carta.' : 'Non riesco a registrare la decisione.') } finally { setWorking('') } }
  const appeal = async (claimItem: any) => { const reason = window.prompt('Spiega all’amministratore cosa deve controllare:'); if (!reason) return; setWorking(`appeal-${claimItem.id}`); try { await api.post(`/claims/${claimItem.id}/appeal`, { message: reason }); setMessage('Richiesta inviata all’amministratore.'); await load() } catch (error: any) { setMessage(error.response?.data?.error === 'appeal_already_exists' ? 'Hai già una richiesta aperta per questa carta.' : 'Non riesco a contattare l’amministratore.') } finally { setWorking('') } }

  const credits = Math.max(0, Number(wallet?.balance ?? 0) - Number(wallet?.reserved ?? 0))
  const live = phase === 'LIVE'
  const direct = acquisitionMode === 'DIRECT'
  const ownership = (card: any) => direct ? Boolean(card.purchasedByCurrentUser) : card.status === 'WON' && card.ownerId === currentUserId
  const cardValue = (card: any) => Math.max(1, Number(direct ? card.directPrice : card.currentBid || card.openingBid || 0))
  const claimFor = (card: any) => claims.find((claim) => claim.auctionId === card.id && claim.userId === currentUserId)
  const cardAction = (card: any) => {
    const claim = claimFor(card)
    if (ownership(card) && claim) return claim.status === 'PENDING' ? 'Carta in verifica' : `Carta ${claimLabel(claim.status).toLowerCase()}`
    if (ownership(card)) return live ? `Gioca carta · ${cardValue(card)} punti` : 'Carta acquistata · apri dettagli'
    if (direct && card.status === 'AVAILABLE') return `Acquista · ${card.directPrice} crediti`
    if (!direct && card.status === 'OPEN') return 'Apri e fai la tua offerta'
    return 'Apri i dettagli'
  }

  const selectedClaim = selectedCard ? claimFor(selectedCard) : null
  return <section className="prediction-panel auction-panel"><div><p className="eyebrow">Mercato del caos</p><h3>{direct ? 'Acquisto diretto' : 'Aste delle carte'}</h3><p><b>{credits}</b> crediti disponibili {wallet?.reserved ? `· ${wallet.reserved} impegnati nelle offerte` : ''}</p><p className="claim-help">{direct ? 'Ogni partecipante può acquistare la propria copia. Ogni copia giocata vale esattamente i crediti spesi e non può essere riutilizzata.' : 'Ogni carta è esclusiva: chi la vince può giocarla una sola volta e ottiene punti pari all’offerta vincente.'}</p>{live && <p className="claim-help">Gioca una carta acquistata: due giocatori devono approvarla, oppure decide subito l’amministratore.</p>}</div>
    <div className="auction-grid">{cards.map((card) => <article className="auction-card is-clickable" key={card.id} onClick={() => openCard(card)}><img src={card.imageUrl} alt={`Carta ${card.title}`} /><div><small>{card.rarity}</small><h4>{card.title}</h4><p>{card.description}</p><strong>{direct ? `${card.directPrice} crediti / punti` : card.currentBid ? `${card.currentBid} crediti / punti` : `Base ${card.openingBid} crediti`}</strong><span>{direct ? ownership(card) ? claimFor(card) ? claimLabel(claimFor(card).status) : 'La possiedi per questo evento' : card.status === 'AVAILABLE' ? `Acquistabile per ${timeLeft(card.closesAt)}` : 'Acquisti chiusi' : card.status === 'OPEN' ? `Chiude tra ${timeLeft(card.closesAt)}` : card.status === 'WON' ? `Vinta da ${card.ownerName}` : 'Asta terminata senza offerte'}</span><button type="button" className="card-primary-action" aria-label={`${cardAction(card)}: ${card.title}`} onClick={(event) => { event.stopPropagation(); openCard(card) }}>{cardAction(card)}</button></div></article>)}</div>
    {selectedCard && <div className="auction-offer-backdrop" role="presentation" onMouseDown={() => !working && setSelectedCard(null)}><section role="dialog" aria-modal="true" aria-label={selectedCard.title} onMouseDown={(event) => event.stopPropagation()}><button type="button" className="participant-close" onClick={() => setSelectedCard(null)} disabled={Boolean(working)}>×</button>{selectedCard.imageUrl && <img src={selectedCard.imageUrl} alt="" />}<p className="eyebrow">{selectedCard.rarity} · {direct ? 'Acquisto diretto' : 'Asta esclusiva'}</p><h3>{selectedCard.title}</h3><p>{selectedCard.description}</p>{selectedClaim ? <div className="auction-offer-form"><span className="offer-current">Carta giocata · {claimLabel(selectedClaim.status)} · valore {selectedClaim.spentCredits ?? selectedClaim.rewardCredits ?? cardValue(selectedCard)} punti</span><button type="button" className="btn btn-ghost" disabled={working === `appeal-${selectedClaim.id}`} onClick={() => void appeal(selectedClaim)}><ShieldQuestion size={16} /> Chiedi intervento admin</button></div> : ownership(selectedCard) ? <div className="auction-offer-form"><span className="offer-current">Valore della carta: {cardValue(selectedCard)} punti. Dopo averla giocata non potrà più essere usata.</span><button type="button" className="btn" disabled={!live || working === `play-${selectedCard.id}`} onClick={() => void play(selectedCard)}><Play size={16} />{working === `play-${selectedCard.id}` ? 'Gioco…' : live ? `Gioca carta · ${cardValue(selectedCard)} punti` : 'Potrai giocarla durante l’evento'}</button></div> : direct && selectedCard.status === 'AVAILABLE' ? <div className="auction-offer-form"><span className="offer-current">Prezzo e valore: {selectedCard.directPrice} crediti / punti · disponibili {credits}</span><button type="button" className="btn" disabled={working === `buy-${selectedCard.id}`} onClick={() => void buy(selectedCard)}><ShoppingBag size={16} />{working === `buy-${selectedCard.id}` ? 'Acquisto…' : `Acquista per ${selectedCard.directPrice} crediti`}</button></div> : !direct && selectedCard.status === 'OPEN' ? <div className="auction-offer-form"><label>La tua offerta<input className="input" type="number" min={selectedCard.leaderId ? selectedCard.currentBid + selectedCard.minIncrement : selectedCard.openingBid} value={amount} onChange={(event) => setAmount(event.target.value)} /></label><small>Crediti disponibili: {credits} · se vinci, la carta varrà esattamente l’offerta vincente.</small><button type="button" className="btn" disabled={working === `bid-${selectedCard.id}`} onClick={() => void bid(selectedCard)}><Gavel size={16} />{working === `bid-${selectedCard.id}` ? 'Invio…' : 'Fai offerta'}</button></div> : <p className="profile-error">{direct ? 'Gli acquisti per questa carta sono chiusi.' : selectedCard.status === 'WON' ? `Carta assegnata a ${selectedCard.ownerName}.` : 'Asta terminata senza offerte.'}</p>}</section></div>}
    {claims.length > 0 && <div className="claim-board"><p className="eyebrow">Carte giocate · verifiche</p>{claims.map((claimItem) => <article key={claimItem.id}><div><strong>{claimItem.cardTitle}</strong><span>{claimItem.claimantName} · {claimLabel(claimItem.status)} · {claimItem.spentCredits ?? claimItem.rewardCredits ?? 0} punti</span>{claimItem.note && <p>{claimItem.note}</p>}<small>{claimItem.votes.filter((voteItem: any) => voteItem.vote === 'CONFIRM').length} conferme · {claimItem.votes.filter((voteItem: any) => voteItem.vote === 'DENY').length} contestazioni</small></div><div>{claimItem.status === 'PENDING' && claimItem.userId !== currentUserId && <><button type="button" onClick={() => void vote(claimItem, 'CONFIRM')} disabled={working === `vote-${claimItem.id}`}>Approva</button><button type="button" onClick={() => void vote(claimItem, 'DENY')} disabled={working === `vote-${claimItem.id}`}>Contesta</button></>}<button type="button" onClick={() => void appeal(claimItem)} disabled={working === `appeal-${claimItem.id}`}><ShieldQuestion size={14} /> Admin</button></div></article>)}</div>}
    {message && <p className="prediction-message" role="status">{message}</p>}
  </section>
}
