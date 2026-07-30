import React, { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../services/api'
import PredictionForm from '../components/PredictionForm'

function timeLabel(target?: string) { const difference = new Date(target || '').getTime() - Date.now(); if (difference <= 0) return 'adesso'; const minutes = Math.ceil(difference / 60_000); return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min` }

export default function EventDetail() {
  const { id } = useParams()
  const [event, setEvent] = useState<any>(null)
  const [now, setNow] = useState(Date.now())
  const [selectedParticipant, setSelectedParticipant] = useState<any>(null)
  const load = useCallback(async () => { if (!id) return; try { const response = await api.get(`/events/${id}`); setEvent(response.data.event) } catch { setEvent(null) } }, [id])
  useEffect(() => { void load(); const refresh = window.setInterval(() => { if (document.visibilityState === 'visible') void load() }, 30_000); const clock = window.setInterval(() => setNow(Date.now()), 30_000); return () => { window.clearInterval(refresh); window.clearInterval(clock) } }, [load])
  if (!event) return <div className="empty-state">Sto caricando la drama room…</div>
  const mode = event.acquisitionMode === 'DIRECT' ? 'DIRECT' : 'AUCTION'
  const marketCloses = mode === 'AUCTION' ? new Date(new Date(event.startsAt).getTime() - 60 * 60 * 1000).toISOString() : event.endsAt
  const status = event.phase === 'LIVE' ? 'LIVE ORA' : event.phase === 'IN_ARRIVO' ? `${mode === 'AUCTION' ? 'ASTE' : 'ACQUISTI'} CHIUDONO TRA ${timeLabel(marketCloses)}` : event.phase === 'IN_VALUTAZIONE' ? 'VERIFICHE IN CORSO' : 'EVENTO CONCLUSO'; void now
  return <div className="event-detail-page"><section className="event-hero-detail">{event.imageUrl && <img src={event.imageUrl} alt="" />}<div><p className="eyebrow">{status}</p><h2>{event.title}</h2><p>{event.description || 'La crew è pronta al prossimo colpo di scena.'}</p><p className="event-live-update">{mode === 'AUCTION' ? 'Le aste chiudono un’ora prima dell’inizio. Ogni carta è esclusiva del vincitore e vale soltanto per questo evento.' : 'Ogni partecipante può acquistare una copia della stessa carta. Gli acquisti chiudono all’inizio e valgono soltanto per questo evento.'}</p>{event.liveUpdate && <p className="event-live-update">✦ {event.liveUpdate}</p>}</div></section>
    <section className="event-crew-panel"><div><p className="eyebrow">La crew dell’evento</p><h3>Chi partecipa <span>{event.participants?.length || 0}</span></h3><p>Apri un profilo per vedere stile, ruolo e carte acquistate per questo evento.</p></div><div className="event-participants">{(event.participants || []).map((participant: any) => <button type="button" key={participant.userId} className={selectedParticipant?.userId === participant.userId ? 'is-selected' : ''} onClick={() => setSelectedParticipant(participant)}>{participant.avatar ? <img src={participant.avatar} alt="" /> : <i>{participant.username?.slice(0, 1)}</i>}<span><b>{participant.username}</b><small>{participant.crewRole} · {participant.cards?.length || 0} carte</small></span></button>)}</div>{selectedParticipant && <article className="participant-profile"><button type="button" className="participant-close" onClick={() => setSelectedParticipant(null)}>×</button><div className="participant-profile-head">{selectedParticipant.avatar ? <img src={selectedParticipant.avatar} alt="" /> : <i>{selectedParticipant.username?.slice(0, 1)}</i>}<div><p className="eyebrow">Profilo giocatore</p><h3>{selectedParticipant.username}</h3><span>{selectedParticipant.crewRole}{selectedParticipant.city ? ` · ${selectedParticipant.city}` : ''}</span></div></div>{selectedParticipant.bio && <p>{selectedParticipant.bio}</p>}{selectedParticipant.motto && <blockquote>“{selectedParticipant.motto}”</blockquote>}<div className="participant-cards"><strong>Carte valide per questo evento</strong>{selectedParticipant.cards?.length ? selectedParticipant.cards.map((card: any) => <article key={card.id}>{card.imageUrl && <img src={card.imageUrl} alt="" />}<span><b>{card.title}</b><small>{card.rarity} · {card.state}</small></span></article>) : <p>Nessuna carta acquistata per ora.</p>}</div></article>}</section>
    <PredictionForm eventId={event.id} phase={event.phase} acquisitionMode={mode} closesAt={marketCloses} onSaved={() => void load()} />
  </div>
}
