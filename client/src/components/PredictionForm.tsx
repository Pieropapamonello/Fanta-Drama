import React, { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Clock3, Gavel, ImagePlus, Play, Search, ShieldQuestion, ShoppingBag, X } from 'lucide-react'
import api from '../services/api'
import DramaCard from './DramaCard'

type Props = { eventId: string; phase?: string; acquisitionMode?: 'AUCTION' | 'DIRECT'; closesAt?: string; onSaved?: () => void }

function claimLabel(status: string) {
  if (status === 'CONFIRMED') return 'Confermata'
  if (status === 'DENIED') return 'Contestata'
  return 'In verifica'
}

function localTime(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
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
  const [playCard, setPlayCard] = useState<any>(null)
  const [playNote, setPlayNote] = useState('')
  const [proofImageUrl, setProofImageUrl] = useState('')
  const [proofVideoUrl, setProofVideoUrl] = useState('')
  const [proofUploading, setProofUploading] = useState(false)
  const [appealTarget, setAppealTarget] = useState<any>(null)
  const [appealDraft, setAppealDraft] = useState('')
  const [reviewTab, setReviewTab] = useState<'PENDING' | 'CONFIRMED' | 'DENIED' | 'ALL'>('PENDING')
  const [celebration, setCelebration] = useState('')
  const [cardQuery, setCardQuery] = useState('')
  const loadingRef = useRef(false)
  const dialogRef = useRef<HTMLElement>(null)

  const load = async () => {
    if (loadingRef.current) return
    loadingRef.current = true
    try {
      const cardData = await api.get(`/auctions/event/${eventId}`)
      setCards(cardData.data.auctions || [])
      setWallet(cardData.data.wallet)
      setCurrentUserId(cardData.data.currentUserId || '')
    } catch (error: any) {
      const code = error.response?.data?.error
      setMessage(code === 'join_event_first' ? 'Entra nell evento prima di aprire il mercato.' : code === 'event_not_found' ? 'Non posso aprire il mercato di questo evento.' : `Non riesco a caricare le carte${code ? ` (${code})` : ''}.`)
    }
    try { const claimData = await api.get(`/claims/event/${eventId}`); setClaims(claimData.data.claims || []) } catch { /* Keep the market usable while verification refreshes. */ }
    finally { loadingRef.current = false }
  }

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load() }, 30_000)
    return () => window.clearInterval(timer)
  }, [eventId])

  useEffect(() => {
    if (!selectedCard && !playCard && !appealTarget) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const frame = window.requestAnimationFrame(() => dialogRef.current?.scrollTo({ top: 0 }))
    return () => {
      window.cancelAnimationFrame(frame)
      document.body.style.overflow = previousOverflow
    }
  }, [selectedCard, playCard, appealTarget])

  const openCard = (card: any) => {
    const minimum = card.leaderId ? Number(card.currentBid) + Number(card.minIncrement) : Number(card.openingBid)
    setAmount(String(minimum)); setSelectedCard(card); setMessage('')
  }
  const bid = async (card: any) => {
    const offer = Number(amount); setWorking(`bid-${card.id}`); setMessage('')
    try { await api.post(`/auctions/${card.id}/bid`, { amount: offer }); setSelectedCard(null); setMessage(`Offerta di ${offer} crediti registrata.`); await load(); onSaved?.() }
    catch (error: any) {
      const code = error.response?.data?.error; const minimum = card.leaderId ? card.currentBid + card.minIncrement : card.openingBid
      setMessage(code === 'insufficient_credits' ? 'Non hai abbastanza crediti disponibili.' : code === 'bid_too_low' ? `Devi offrire almeno ${minimum} crediti.` : code === 'auction_closed' ? 'L asta e gia chiusa.' : 'Non riesco a registrare il rilancio.')
    } finally { setWorking('') }
  }
  const buy = async (card: any) => {
    setWorking(`buy-${card.id}`); setMessage('')
    try { await api.post(`/auctions/${card.id}/buy`); setSelectedCard(null); setMessage(`${card.title} acquistata: vale solo per questo evento.`); await load(); onSaved?.() }
    catch (error: any) {
      const code = error.response?.data?.error
      setMessage(code === 'insufficient_credits' ? 'Non hai abbastanza crediti disponibili.' : code === 'direct_purchase_closed' ? 'Gli acquisti per questo evento sono chiusi.' : 'Non riesco a completare l acquisto.')
    } finally { setWorking('') }
  }
  const play = async (card: any) => {
    setWorking(`play-${card.id}`); setMessage('')
    try {
      const response = await api.post(`/claims/event/${eventId}`, { auctionId: card.id, note: playNote, proofImageUrl: proofImageUrl || undefined, proofVideoUrl: proofVideoUrl || undefined })
      setSelectedCard(null); setPlayCard(null); setPlayNote(''); setProofImageUrl(''); setProofVideoUrl('')
      setMessage(response.data.mergedWithExistingVerification ? 'Carta giocata: e gia in verifica per la crew. La tua copia seguira lo stesso risultato.' : `Carta giocata: vale ${cardValue(card)} punti e attende due conferme oppure una decisione admin.`)
      await load(); onSaved?.()
    } catch (error: any) {
      const code = error.response?.data?.error
      setMessage(code === 'claim_not_available' ? 'Puoi giocare una carta soltanto durante l evento.' : code === 'card_already_played' || code === 'claim_already_exists' ? 'Questa carta e gia stata giocata e non puo essere riutilizzata.' : 'Non riesco a giocare la carta.')
    } finally { setWorking('') }
  }
  const vote = async (claimItem: any, decision: 'CONFIRM' | 'DENY') => {
    setWorking(`vote-${claimItem.id}`); setMessage('')
    try {
      const result = (await api.post(`/claims/${claimItem.id}/vote`, { vote: decision })).data
      setMessage(result.alreadyVoted ? 'Avevi gia registrato questa decisione.' : result.status === 'CONFIRMED' ? 'Carta confermata: punti assegnati e crew avvisata.' : result.status === 'DENIED' ? 'Carta contestata: la crew e stata avvisata.' : `${decision === 'CONFIRM' ? 'Conferma' : 'Contestazione'} registrata: ${result.confirms} conferme e ${result.denies} contestazioni.`)
      if (result.status === 'CONFIRMED') { setCelebration('Carta confermata! La classifica si e aggiornata.'); window.setTimeout(() => setCelebration(''), 3600) }
      await load(); onSaved?.()
    } catch (error: any) {
      const code = error.response?.data?.error
      setMessage(code === 'claimant_cannot_vote' ? 'Non puoi approvare la tua stessa carta.' : code === 'claim_already_resolved' ? 'Questa carta e gia stata risolta.' : 'Non riesco a registrare la decisione.')
    } finally { setWorking('') }
  }
  const submitAppeal = async () => {
    const reason = appealDraft.trim(); if (!reason || !appealTarget) return
    setWorking(`appeal-${appealTarget.id}`)
    try { await api.post(`/claims/${appealTarget.id}/appeal`, { message: reason }); setMessage('Richiesta inviata all amministratore.'); setAppealTarget(null); setAppealDraft(''); await load() }
    catch (error: any) { setMessage(error.response?.data?.error === 'appeal_already_exists' ? 'Hai gia una richiesta aperta per questa carta.' : 'Non riesco a contattare l amministratore.') }
    finally { setWorking('') }
  }
  const uploadProof = async (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) { setMessage('Puoi allegare una foto oppure incollare un link pubblico a un video.'); return }
    if (file.size > 2_300_000) { setMessage('La foto e troppo grande: scegli un file sotto i 2 MB.'); return }
    setProofUploading(true); setMessage('')
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('file_read_failed')); reader.readAsDataURL(file) })
      const response = await api.post('/assets/upload', { kind: 'CARD', dataUrl })
      setProofImageUrl(response.data.imageUrl); setMessage('Foto allegata alla verifica.')
    } catch { setMessage('Non riesco a caricare la foto della prova.') } finally { setProofUploading(false) }
  }

  const credits = Math.max(0, Number(wallet?.balance ?? 0) - Number(wallet?.reserved ?? 0))
  const live = phase === 'LIVE'; const finished = phase === 'CONCLUSO'; const direct = acquisitionMode === 'DIRECT'
  const ownership = (card: any) => direct ? Boolean(card.purchasedByCurrentUser) : card.status === 'WON' && card.ownerId === currentUserId
  const cardValue = (card: any) => Math.max(1, Number(direct ? card.directPrice : card.currentBid || card.openingBid || 0))
  const claimFor = (card: any) => claims.find((claim) => claim.auctionId === card.id && claim.userId === currentUserId)
  const cardAction = (card: any) => {
    const claim = claimFor(card)
    if (ownership(card) && claim) return claim.status === 'PENDING' ? 'Carta in verifica' : `Carta ${claimLabel(claim.status).toLowerCase()}`
    if (ownership(card)) return live ? `Gioca carta - ${cardValue(card)} punti` : finished ? 'Evento concluso' : 'Carta acquistata - apri dettagli'
    if (finished) return 'Mercato chiuso'
    if (direct && card.status === 'AVAILABLE') return `Acquista - ${card.directPrice} crediti`
    if (!direct && card.status === 'OPEN') return 'Apri e fai la tua offerta'
    return 'Apri i dettagli'
  }
  const renderCard = (card: any) => <DramaCard key={card.id} card={{ ...card, effect: card.description, flavor: direct ? `Valore: ${card.directPrice} crediti e punti.` : card.currentBid ? `Offerta attuale: ${card.currentBid} crediti.` : `Base d asta: ${card.openingBid} crediti.` }} badge={ownership(card) ? claimFor(card) ? claimLabel(claimFor(card).status).toUpperCase() : 'TUA CARTA' : finished ? 'CHIUSA' : direct ? 'DIRETTA' : 'ASTA'} actionLabel={cardAction(card)} onAction={() => openCard(card)} onInspect={() => openCard(card)} />
  const searchText = cardQuery.trim().toLocaleLowerCase('it-IT')
  const matchesSearch = (card: any) => !searchText || [card.title, card.description, card.rarity, card.type].some((value) => String(value ?? '').toLocaleLowerCase('it-IT').includes(searchText))
  const playableCards = cards.filter((card) => ownership(card) && !claimFor(card) && matchesSearch(card))
  const marketCards = cards.filter((card) => !ownership(card) && matchesSearch(card))
  const selectedClaim = selectedCard ? claimFor(selectedCard) : null
  const verificationGroups = Object.values(claims.reduce((groups: Record<string, any>, claim: any) => {
    const key = String(claim.cardKey || claim.auctionId)
    if (!groups[key]) groups[key] = { key, claims: [] }
    groups[key].claims.push(claim)
    return groups
  }, {})).map((group: any) => {
    const canonical = group.claims.find((claim: any) => claim.status === 'PENDING') || group.claims[0]
    const status = canonical.status
    const confirms = canonical.votes.filter((voteItem: any) => voteItem.vote === 'CONFIRM').length
    const denies = canonical.votes.filter((voteItem: any) => voteItem.vote === 'DENY').length
    return { ...group, canonical, status, confirms, denies }
  }).sort((a: any, b: any) => (a.status === 'PENDING' ? -1 : 1) - (b.status === 'PENDING' ? -1 : 1)) as any[]
  const visibleVerifications = verificationGroups.filter((group) => reviewTab === 'ALL' || group.status === reviewTab)

  return <section className="prediction-panel auction-panel" id="mercato-evento">
    <div><p className="eyebrow">Mercato del caos</p><h3>{finished ? 'Mercato concluso' : direct ? 'Acquisto diretto' : 'Aste delle carte'}</h3><p><b>{credits}</b> crediti disponibili per questo evento {wallet?.reserved ? `- ${wallet.reserved} impegnati nelle offerte` : ''}</p><p className="claim-help">{finished ? 'L evento e terminato: le carte restano consultabili, ma non possono piu essere acquistate o giocate.' : direct ? 'Ogni partecipante puo acquistare la propria copia. Ogni copia giocata vale i crediti spesi e non puo essere riutilizzata.' : 'Ogni carta e esclusiva: chi la vince puo giocarla una sola volta e ottiene punti pari all offerta vincente.'}</p>{live && <p className="claim-help">Tocca una carta acquistata e premi Gioca carta: due giocatori devono approvarla, oppure decide subito l amministratore.</p>}</div>
    <section className="owned-event-cards" id="mie-carte"><div className="market-section-heading"><div><p className="eyebrow">Il tuo mazzo evento</p><h4>Carte acquistate da giocare</h4></div><span>{playableCards.length}</span></div>{playableCards.length ? <div className="drama-card-grid event-card-grid">{playableCards.map(renderCard)}</div> : <p className="market-empty">Non hai carte ancora da giocare in questo evento.</p>}</section>
    <section className="event-market-cards"><div className="market-section-heading"><div><p className="eyebrow">Catalogo evento</p><h4>{finished ? 'Carte dell evento' : 'Carte da acquistare o puntare'}</h4></div><span>{marketCards.length}</span></div><label className="event-card-search"><Search size={17} /><input value={cardQuery} onChange={(event) => setCardQuery(event.target.value)} placeholder="Cerca una carta dell'evento..." aria-label="Cerca una carta dell'evento" />{cardQuery && <button type="button" onClick={() => setCardQuery('')} aria-label="Cancella ricerca"><X size={15} /></button>}</label>{marketCards.length ? <div className="drama-card-grid event-card-grid">{marketCards.map(renderCard)}</div> : <p className="market-empty">Nessuna carta corrisponde alla ricerca.</p>}</section>

    {selectedCard && <div className="auction-offer-backdrop" role="presentation" onMouseDown={() => !working && setSelectedCard(null)}><section ref={dialogRef} role="dialog" aria-modal="true" aria-label={selectedCard.title} onMouseDown={(event) => event.stopPropagation()}><button type="button" className="participant-close" onClick={() => setSelectedCard(null)} disabled={Boolean(working)}>x</button>{selectedCard.imageUrl && <img src={selectedCard.imageUrl} alt="" />}<p className="eyebrow">{selectedCard.rarity} - {direct ? 'Acquisto diretto' : 'Asta esclusiva'}</p><h3>{selectedCard.title}</h3><p>{selectedCard.description}</p>{selectedClaim ? <div className="auction-offer-form"><span className="offer-current">Carta giocata - {claimLabel(selectedClaim.status)} - valore {selectedClaim.spentCredits ?? selectedClaim.rewardCredits ?? cardValue(selectedCard)} punti</span><button type="button" className="btn btn-ghost" disabled={working === `appeal-${selectedClaim.id}`} onClick={() => setAppealTarget(selectedClaim)}><ShieldQuestion size={16} /> Chiedi intervento admin</button></div> : ownership(selectedCard) ? <div className="auction-offer-form"><span className="offer-current">Valore della carta: {cardValue(selectedCard)} punti. Dopo averla giocata non potra piu essere usata.</span><button type="button" className="btn" disabled={!live} onClick={() => { setSelectedCard(null); setPlayCard(selectedCard) }}><Play size={16} />{live ? `Gioca carta - ${cardValue(selectedCard)} punti` : finished ? 'Evento concluso' : 'Potrai giocarla durante l evento'}</button></div> : direct && selectedCard.status === 'AVAILABLE' && !finished ? <div className="auction-offer-form"><span className="offer-current">Prezzo e valore: {selectedCard.directPrice} crediti / punti - disponibili {credits}</span><button type="button" className="btn" disabled={working === `buy-${selectedCard.id}`} onClick={() => void buy(selectedCard)}><ShoppingBag size={16} />{working === `buy-${selectedCard.id}` ? 'Acquisto...' : `Acquista per ${selectedCard.directPrice} crediti`}</button></div> : !direct && selectedCard.status === 'OPEN' && !finished ? <div className="auction-offer-form"><label>La tua offerta<input className="input" type="number" min={selectedCard.leaderId ? selectedCard.currentBid + selectedCard.minIncrement : selectedCard.openingBid} value={amount} onChange={(event) => setAmount(event.target.value)} /></label><small>Crediti disponibili: {credits} - se vinci, la carta varra l offerta vincente.</small><button type="button" className="btn" disabled={working === `bid-${selectedCard.id}`} onClick={() => void bid(selectedCard)}><Gavel size={16} />{working === `bid-${selectedCard.id}` ? 'Invio...' : 'Fai offerta'}</button></div> : <p className="profile-error">{finished ? 'L evento e concluso: il mercato non accetta piu acquisti o offerte.' : direct ? 'Gli acquisti per questa carta sono chiusi.' : selectedCard.status === 'WON' ? `Carta assegnata a ${selectedCard.ownerName}.` : 'Asta terminata senza offerte.'}</p>}</section></div>}

    {playCard && <div className="auction-offer-backdrop" role="presentation" onMouseDown={() => !working && setPlayCard(null)}><section ref={dialogRef} className="play-proof-dialog" role="dialog" aria-modal="true" aria-label="Gioca carta" onMouseDown={(event) => event.stopPropagation()}><button type="button" className="participant-close" onClick={() => setPlayCard(null)} disabled={Boolean(working)}>x</button>{playCard.imageUrl && <img src={playCard.imageUrl} alt="" />}<p className="eyebrow">Gioca una carta</p><h3>{playCard.title}</h3><p>Racconta alla crew cosa e successo. Puoi allegare una foto o un link video: la prova e facoltativa, ma rende la verifica piu chiara.</p><label>Dettaglio dell accaduto<textarea className="input" value={playNote} maxLength={500} onChange={(event) => setPlayNote(event.target.value)} placeholder="Es. e successo davvero durante la cena..." /></label><label className="proof-upload"><ImagePlus size={16} /> Allega foto<input type="file" accept="image/*" onChange={(event) => void uploadProof(event.target.files?.[0])} /></label>{proofImageUrl && <img className="proof-preview" src={proofImageUrl} alt="Prova allegata" />}<label>Link a video (facoltativo)<input className="input" type="url" value={proofVideoUrl} onChange={(event) => setProofVideoUrl(event.target.value)} placeholder="https://..." /></label><button type="button" className="btn" disabled={proofUploading || working === `play-${playCard.id}`} onClick={() => void play(playCard)}><Play size={16} />{proofUploading ? 'Carico foto...' : working === `play-${playCard.id}` ? 'Invio...' : `Gioca carta - ${cardValue(playCard)} punti`}</button></section></div>}

    {verificationGroups.length > 0 && <section className="claim-board" id="verifiche-carte"><div className="verification-heading"><div><p className="eyebrow">Sala VAR del drama</p><h4>Carte giocate e verifiche</h4><small>Una decisione vale per tutte le copie della stessa carta usate nello stesso evento.</small></div><Clock3 size={22} /></div><div className="verification-tabs"><button type="button" onClick={() => document.getElementById('mie-carte')?.scrollIntoView({ behavior: 'smooth' })}>Da giocare <b>{playableCards.length}</b></button>{(['PENDING', 'CONFIRMED', 'DENIED', 'ALL'] as const).map((tab) => <button key={tab} type="button" className={reviewTab === tab ? 'is-active' : ''} onClick={() => setReviewTab(tab)}>{tab === 'PENDING' ? 'In verifica' : tab === 'CONFIRMED' ? 'Confermate' : tab === 'DENIED' ? 'Contestazioni' : 'Tutte'} <b>{tab === 'ALL' ? verificationGroups.length : verificationGroups.filter((group) => group.status === tab).length}</b></button>)}</div>{visibleVerifications.length ? visibleVerifications.map((group) => { const claim = group.canonical; const canVote = claim.status === 'PENDING' && claim.userId !== currentUserId; return <article className={`verification-card is-${String(group.status).toLowerCase()}`} key={group.key}><div className="verification-status"><span>{claim.status === 'CONFIRMED' ? <CheckCircle2 size={16} /> : <Clock3 size={16} />}</span><div><strong>{claim.cardTitle}</strong><small>{claim.status === 'PENDING' ? `${group.confirms}/2 conferme necessarie` : claimLabel(claim.status)}</small></div><b>{claim.spentCredits ?? claim.rewardCredits ?? 0} pt</b></div><div className="vote-track" aria-label={`${group.confirms} di 2 conferme`}><i className={group.confirms > 0 ? 'is-filled' : ''} /><i className={group.confirms > 1 ? 'is-filled' : ''} /><span>{group.confirms} conferme - {group.denies} contestazioni</span></div><p className="verification-note">{claim.note || 'Nessun dettaglio aggiunto dal giocatore.'}</p>{claim.proofImageUrl && <a className="verification-proof" href={claim.proofImageUrl} target="_blank" rel="noreferrer"><img src={claim.proofImageUrl} alt="Prova allegata" /> Apri foto prova</a>}{claim.proofVideoUrl && <a className="verification-video" href={claim.proofVideoUrl} target="_blank" rel="noreferrer">Apri video prova</a>}<div className="verification-players">{group.claims.map((item: any) => <span key={item.id}>{item.claimantAvatarUrl ? <img src={item.claimantAvatarUrl} alt="" /> : <i>{String(item.claimantName || 'G').slice(0, 1)}</i>}{item.claimantName}{item.autoPlayed ? ' (auto)' : ''}</span>)}</div><div className="verification-timeline"><span>Giocata {localTime(claim.createdAt)} da {claim.claimantName}</span>{claim.votes.map((voteItem: any) => <span key={voteItem.id}>{voteItem.vote === 'CONFIRM' ? 'Conferma' : 'Contestazione'} {localTime(voteItem.updatedAt || voteItem.createdAt)}</span>)}{claim.adminReviewRequested && <span>In revisione admin</span>}</div><div className="verification-actions">{canVote && <><button type="button" className="btn" onClick={() => void vote(claim, 'CONFIRM')} disabled={working === `vote-${claim.id}`}><CheckCircle2 size={15} /> Approva</button><button type="button" className="btn btn-ghost" onClick={() => void vote(claim, 'DENY')} disabled={working === `vote-${claim.id}`}>Contesta</button></>}<button type="button" className="btn btn-ghost" onClick={() => setAppealTarget(claim)} disabled={working === `appeal-${claim.id}`}><ShieldQuestion size={15} /> Ricorso admin</button></div></article> }) : <p className="market-empty">Nessuna carta in questa sezione.</p>}</section>}
    {appealTarget && <div className="auction-offer-backdrop" role="presentation" onMouseDown={() => !working && setAppealTarget(null)}><section ref={dialogRef} className="appeal-dialog" role="dialog" aria-modal="true" aria-label="Ricorso admin" onMouseDown={(event) => event.stopPropagation()}><button type="button" className="participant-close" onClick={() => setAppealTarget(null)}>x</button><p className="eyebrow">Ricorso</p><h3>Chiedi una decisione admin</h3><p>Spiega cosa deve controllare l amministratore per {appealTarget.cardTitle}. Le prove allegate alla carta restano visibili.</p><textarea className="input" value={appealDraft} minLength={4} maxLength={1000} onChange={(event) => setAppealDraft(event.target.value)} placeholder="Descrivi la contestazione..." /><button type="button" className="btn" disabled={appealDraft.trim().length < 4 || working === `appeal-${appealTarget.id}`} onClick={() => void submitAppeal()}><ShieldQuestion size={16} /> Invia ricorso</button></section></div>}
    {celebration && <div className="confirmation-celebration" role="status"><CheckCircle2 size={28} /><strong>{celebration}</strong></div>}
    {message && <p className="prediction-message" role="status">{message}</p>}
  </section>
}
