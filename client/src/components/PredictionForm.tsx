import React, { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Gavel, ShoppingBag } from 'lucide-react'
import api from '../services/api'

type Props = { eventId: string; phase?: string; acquisitionMode?: 'AUCTION' | 'DIRECT'; closesAt?: string; onSaved?: () => void }

function timeLeft(value?: string) {
  const seconds = Math.max(0, Math.ceil((new Date(value || '').getTime() - Date.now()) / 1000))
  if (!seconds) return 'chiusa'
  const hours = Math.floor(seconds / 3600); const minutes = Math.floor((seconds % 3600) / 60)
  return hours ? `${hours}h ${minutes}m` : `${minutes} min`
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
      const [cardData, claimData] = await Promise.all([api.get(`/auctions/event/${eventId}`), api.get(`/claims/event/${eventId}`)])
      setCards(cardData.data.auctions || []); setWallet(cardData.data.wallet); setCurrentUserId(cardData.data.currentUserId || ''); setClaims(claimData.data.claims || [])
    } catch { setMessage('Non riesco a caricare le carte in questo momento.') }
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
    try { await api.post(`/auctions/${card.id}/buy`); setSelectedCard(null); setMessage(`${card.title} acquistata: la copia è valida solo per questo evento.`); await load(); onSaved?.() }
    catch (error: any) { const code = error.response?.data?.error; setMessage(code === 'insufficient_credits' ? 'Non hai abbastanza crediti disponibili.' : code === 'direct_purchase_closed' ? 'Gli acquisti per questo evento sono chiusi.' : 'Non riesco a completare l’acquisto.') }
    finally { setWorking('') }
  }
  const claim = async (card: any) => {
    const note = window.prompt(`Descrivi come è stata usata “${card.title}” (facoltativo):`) ?? ''; setWorking(`claim-${card.id}`)
    try { await api.post(`/claims/event/${eventId}`, { auctionId: card.id, note }); setSelectedCard(null); setMessage('Carta segnalata come usata: servono due conferme o due negazioni.'); await load() }
    catch (error: any) { const code = error.response?.data?.error; setMessage(code === 'claim_not_available' ? 'Puoi confermare l’uso della carta soltanto durante l’evento.' : code === 'claim_already_exists' ? 'Hai già segnalato questa carta.' : 'Non riesco a inviare la conferma.') }
    finally { setWorking('') }
  }
  const vote = async (claimItem: any, decision: 'CONFIRM' | 'DENY') => { setWorking(`vote-${claimItem.id}`); try { await api.post(`/claims/${claimItem.id}/vote`, { vote: decision }); await load() } catch { setMessage('Non riesco a registrare il tuo voto.') } finally { setWorking('') } }
  const appeal = async (claimItem: any) => { const reason = window.prompt('Scrivi il motivo del ricorso:'); if (!reason) return; setWorking(`appeal-${claimItem.id}`); try { await api.post(`/claims/${claimItem.id}/appeal`, { message: reason }); setMessage('Ricorso inviato all’amministratore.'); await load() } catch { setMessage('Non riesco ad aprire il ricorso.') } finally { setWorking('') } }

  const credits = Math.max(0, Number(wallet?.balance ?? 0) - Number(wallet?.reserved ?? 0))
  const live = phase === 'LIVE'
  const direct = acquisitionMode === 'DIRECT'
  const ownership = (card: any) => direct ? Boolean(card.purchasedByCurrentUser) : card.status === 'WON' && card.ownerId === currentUserId
  const cardAction = (card: any) => ownership(card) ? live ? 'Tocca per confermare che è avvenuta' : 'Carta acquistata · apri dettagli' : direct && card.status === 'AVAILABLE' ? `Acquista · ${card.directPrice} crediti` : !direct && card.status === 'OPEN' ? 'Apri e fai la tua offerta' : 'Apri i dettagli'

  return <section className="prediction-panel auction-panel"><div><p className="eyebrow">Mercato del caos</p><h3>{direct ? 'Acquisto diretto' : 'Aste delle carte'}</h3><p><b>{credits}</b> crediti disponibili {wallet?.reserved ? `· ${wallet.reserved} impegnati nelle offerte` : ''}</p><p className="claim-help">{direct ? 'Ogni partecipante può acquistare la propria copia. Le carte valgono soltanto per questo evento.' : 'Ogni carta è esclusiva e viene assegnata a chi vince l’asta.'}</p>{live && <p className="claim-help">Tocca una carta che possiedi e premi <b>Conferma carta usata</b>.</p>}</div>
    <div className="auction-grid">{cards.map((card) => <article className="auction-card is-clickable" key={card.id} onClick={() => openCard(card)}><img src={card.imageUrl} alt={`Carta ${card.title}`} /><div><small>{card.rarity}</small><h4>{card.title}</h4><p>{card.description}</p><strong>{direct ? `${card.directPrice} crediti` : card.currentBid ? `${card.currentBid} crediti` : `Base ${card.openingBid} crediti`}</strong><span>{direct ? ownership(card) ? 'La possiedi per questo evento' : card.status === 'AVAILABLE' ? `Acquistabile per ${timeLeft(card.closesAt)}` : 'Acquisti chiusi' : card.status === 'OPEN' ? `Chiude tra ${timeLeft(card.closesAt)}` : card.status === 'WON' ? `Vinta da ${card.ownerName}` : 'Asta terminata senza offerte'}</span><button type="button" className="card-primary-action" aria-label={`${cardAction(card)}: ${card.title}`} onClick={(event) => { event.stopPropagation(); openCard(card) }}>{cardAction(card)}</button></div></article>)}</div>
    {selectedCard && <div className="auction-offer-backdrop" role="presentation" onMouseDown={() => !working && setSelectedCard(null)}><section role="dialog" aria-modal="true" aria-label={selectedCard.title} onMouseDown={(event) => event.stopPropagation()}><button type="button" className="participant-close" onClick={() => setSelectedCard(null)} disabled={Boolean(working)}>×</button>{selectedCard.imageUrl && <img src={selectedCard.imageUrl} alt="" />}<p className="eyebrow">{selectedCard.rarity} · {direct ? 'Acquisto diretto' : 'Asta esclusiva'}</p><h3>{selectedCard.title}</h3><p>{selectedCard.description}</p>{ownership(selectedCard) ? <div className="auction-offer-form"><span className="offer-current">Questa carta è tua ed è valida solo per questo evento.</span><button type="button" className="btn" disabled={!live || working === `claim-${selectedCard.id}`} onClick={() => void claim(selectedCard)}><CheckCircle2 size={16} />{working === `claim-${selectedCard.id}` ? 'Invio…' : live ? 'Conferma carta usata' : 'Potrai confermarla durante l’evento'}</button></div> : direct && selectedCard.status === 'AVAILABLE' ? <div className="auction-offer-form"><span className="offer-current">Prezzo: {selectedCard.directPrice} crediti · disponibili {credits}</span><button type="button" className="btn" disabled={working === `buy-${selectedCard.id}`} onClick={() => void buy(selectedCard)}><ShoppingBag size={16} />{working === `buy-${selectedCard.id}` ? 'Acquisto…' : `Acquista per ${selectedCard.directPrice} crediti`}</button></div> : !direct && selectedCard.status === 'OPEN' ? <div className="auction-offer-form"><label>La tua offerta<input className="input" type="number" min={selectedCard.leaderId ? selectedCard.currentBid + selectedCard.minIncrement : selectedCard.openingBid} value={amount} onChange={(event) => setAmount(event.target.value)} /></label><small>Crediti disponibili: {credits} · scadenza tra {timeLeft(selectedCard.closesAt)}</small><button type="button" className="btn" disabled={working === `bid-${selectedCard.id}`} onClick={() => void bid(selectedCard)}><Gavel size={16} />{working === `bid-${selectedCard.id}` ? 'Invio…' : 'Fai offerta'}</button></div> : <p className="profile-error">{direct ? 'Gli acquisti per questa carta sono chiusi.' : selectedCard.status === 'WON' ? `Carta assegnata a ${selectedCard.ownerName}.` : 'Asta terminata senza offerte.'}</p>}</section></div>}
    {claims.length > 0 && <div className="claim-board"><p className="eyebrow">Verifiche della crew</p>{claims.map((claimItem) => <article key={claimItem.id}><div><strong>{claimItem.cardTitle}</strong><span>{claimItem.claimantName} · {claimItem.status}</span>{claimItem.note && <p>{claimItem.note}</p>}<small>{claimItem.votes.filter((voteItem: any) => voteItem.vote === 'CONFIRM').length} conferme · {claimItem.votes.filter((voteItem: any) => voteItem.vote === 'DENY').length} negazioni</small></div>{claimItem.status === 'PENDING' && <div><button type="button" onClick={() => void vote(claimItem, 'CONFIRM')} disabled={working === `vote-${claimItem.id}`}>Conferma</button><button type="button" onClick={() => void vote(claimItem, 'DENY')} disabled={working === `vote-${claimItem.id}`}>Nega</button></div>}{['CONFIRMED', 'DENIED'].includes(claimItem.status) && <button type="button" onClick={() => void appeal(claimItem)} disabled={working === `appeal-${claimItem.id}`}>Ricorso</button>}</article>)}</div>}
    {message && <p className="prediction-message" role="status">{message}</p>}
  </section>
}
