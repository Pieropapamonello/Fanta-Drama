import React, { useEffect, useState } from 'react'
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
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [working, setWorking] = useState('')
  const [currentUserId, setCurrentUserId] = useState('')

  const load = async () => {
    try {
      const [cardData, claimData] = await Promise.all([api.get(`/auctions/event/${eventId}`), api.get(`/claims/event/${eventId}`)])
      setCards(cardData.data.auctions || []); setWallet(cardData.data.wallet); setCurrentUserId(cardData.data.currentUserId || ''); setClaims(claimData.data.claims || [])
    } catch { setMessage('Non riesco a caricare le carte in questo momento.') }
  }
  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 30_000); return () => window.clearInterval(timer) }, [eventId])

  const bid = async (card: any) => {
    const amount = Number(amounts[card.id]); setWorking(`bid-${card.id}`); setMessage('')
    try { await api.post(`/auctions/${card.id}/bid`, { amount }); setMessage(`Offerta di ${amount} crediti registrata.`); await load(); onSaved?.() }
    catch (error: any) { const code = error.response?.data?.error; setMessage(code === 'insufficient_credits' ? 'Non hai abbastanza crediti disponibili.' : code === 'bid_too_low' ? `Devi offrire almeno ${(card.leaderId ? card.currentBid + card.minIncrement : card.openingBid)} crediti.` : code === 'auction_closed' ? 'L’asta è già chiusa.' : 'Non riesco a registrare il rilancio.') }
    finally { setWorking('') }
  }
  const buy = async (card: any) => {
    setWorking(`buy-${card.id}`); setMessage('')
    try { await api.post(`/auctions/${card.id}/buy`); setMessage(`${card.title} acquistata: la copia è valida solo per questo evento.`); await load(); onSaved?.() }
    catch (error: any) { const code = error.response?.data?.error; setMessage(code === 'insufficient_credits' ? 'Non hai abbastanza crediti disponibili.' : code === 'direct_purchase_closed' ? 'Gli acquisti per questo evento sono chiusi.' : 'Non riesco a completare l’acquisto.') }
    finally { setWorking('') }
  }
  const claim = async (card: any) => {
    const note = window.prompt(`Descrivi come è stata usata “${card.title}” (facoltativo):`) ?? ''; setWorking(`claim-${card.id}`)
    try { await api.post(`/claims/event/${eventId}`, { auctionId: card.id, note }); setMessage('Carta segnalata come usata: servono due conferme o due negazioni.'); await load() }
    catch (error: any) { const code = error.response?.data?.error; setMessage(code === 'claim_not_available' ? 'Puoi confermare l’uso della carta soltanto durante l’evento.' : code === 'claim_already_exists' ? 'Hai già segnalato questa carta.' : 'Non riesco a inviare la conferma.') }
    finally { setWorking('') }
  }
  const vote = async (claimItem: any, decision: 'CONFIRM' | 'DENY') => { setWorking(`vote-${claimItem.id}`); try { await api.post(`/claims/${claimItem.id}/vote`, { vote: decision }); await load() } catch { setMessage('Non riesco a registrare il tuo voto.') } finally { setWorking('') } }
  const appeal = async (claimItem: any) => { const reason = window.prompt('Scrivi il motivo del ricorso:'); if (!reason) return; setWorking(`appeal-${claimItem.id}`); try { await api.post(`/claims/${claimItem.id}/appeal`, { message: reason }); setMessage('Ricorso inviato all’amministratore.'); await load() } catch { setMessage('Non riesco ad aprire il ricorso.') } finally { setWorking('') } }

  const credits = Math.max(0, Number(wallet?.balance ?? 0) - Number(wallet?.reserved ?? 0))
  const live = phase === 'LIVE'
  const direct = acquisitionMode === 'DIRECT'
  return <section className="prediction-panel auction-panel"><div><p className="eyebrow">Mercato del caos</p><h3>{direct ? 'Acquisto diretto' : 'Aste delle carte'}</h3><p><b>{credits}</b> crediti disponibili {wallet?.reserved ? `· ${wallet.reserved} impegnati nelle offerte` : ''}</p><p className="claim-help">{direct ? 'Ogni partecipante può acquistare la propria copia. Le carte valgono soltanto per questo evento.' : 'Ogni carta è esclusiva e viene assegnata a chi vince l’asta.'}</p>{live && <p className="claim-help">Quando una carta acquistata si verifica, premi <b>Conferma carta usata</b>: serviranno due conferme della crew.</p>}</div>
    <div className="auction-grid">{cards.map((card) => { const minimum = card.leaderId ? Number(card.currentBid) + Number(card.minIncrement) : Number(card.openingBid); const owned = direct ? Boolean(card.purchasedByCurrentUser) : card.status === 'WON' && card.ownerId === currentUserId; const closed = direct ? card.status !== 'AVAILABLE' : card.status !== 'OPEN'; return <article className={`auction-card ${closed ? 'is-closed' : ''}`} key={card.id}><img src={card.imageUrl} alt="" /><div><small>{card.rarity}</small><h4>{card.title}</h4><p>{card.description}</p>{direct ? <><strong>{card.directPrice} crediti</strong><span>{owned ? 'La possiedi per questo evento' : `Acquistabile per ${timeLeft(card.closesAt)}`}</span>{!owned && card.status === 'AVAILABLE' && <button type="button" className="btn btn-ghost" disabled={working === `buy-${card.id}`} onClick={() => void buy(card)}>{working === `buy-${card.id}` ? 'Acquisto…' : `Acquista per ${card.directPrice} crediti`}</button>}</> : <><strong>{card.currentBid ? `${card.currentBid} crediti` : `Base ${card.openingBid} crediti`}</strong><span>{card.status === 'OPEN' ? `Chiude tra ${timeLeft(card.closesAt)}` : card.status === 'WON' ? `Vinta da ${card.ownerName}` : 'Nessuna offerta'}</span>{card.status === 'OPEN' && <div className="auction-bid"><input className="input" type="number" min={minimum} value={amounts[card.id] ?? minimum} onChange={(event) => setAmounts((all) => ({ ...all, [card.id]: event.target.value }))} /><button type="button" className="btn btn-ghost" disabled={working === `bid-${card.id}`} onClick={() => void bid(card)}>{working === `bid-${card.id}` ? 'Invio…' : 'Rilancia'}</button></div>}</>}{owned && <button type="button" className="btn btn-ghost claim-action" disabled={!live || working === `claim-${card.id}`} onClick={() => void claim(card)}>{working === `claim-${card.id}` ? 'Invio…' : live ? '✓ Conferma carta usata' : 'Conferma carta usata (durante l’evento)'}</button>}</div></article> })}</div>
    {claims.length > 0 && <div className="claim-board"><p className="eyebrow">Verifiche della crew</p>{claims.map((claimItem) => <article key={claimItem.id}><div><strong>{claimItem.cardTitle}</strong><span>{claimItem.claimantName} · {claimItem.status}</span>{claimItem.note && <p>{claimItem.note}</p>}<small>{claimItem.votes.filter((voteItem: any) => voteItem.vote === 'CONFIRM').length} conferme · {claimItem.votes.filter((voteItem: any) => voteItem.vote === 'DENY').length} negazioni</small></div>{claimItem.status === 'PENDING' && <div><button type="button" onClick={() => void vote(claimItem, 'CONFIRM')} disabled={working === `vote-${claimItem.id}`}>Conferma</button><button type="button" onClick={() => void vote(claimItem, 'DENY')} disabled={working === `vote-${claimItem.id}`}>Nega</button></div>}{['CONFIRMED', 'DENIED'].includes(claimItem.status) && <button type="button" onClick={() => void appeal(claimItem)} disabled={working === `appeal-${claimItem.id}`}>Ricorso</button>}</article>)}</div>}
    {message && <p className="prediction-message" role="status">{message}</p>}
  </section>
}
