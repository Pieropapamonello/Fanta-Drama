import React, { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../services/api'
import PredictionForm from '../components/PredictionForm'

function timeLabel(target?: string) { const difference = new Date(target || '').getTime() - Date.now(); if (difference <= 0) return 'adesso'; const minutes = Math.ceil(difference / 60_000); return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min` }

export default function EventDetail() {
  const { id } = useParams(); const [event, setEvent] = useState<any>(null); const [now, setNow] = useState(Date.now())
  const load = useCallback(async () => { if (!id) return; try { const response = await api.get(`/events/${id}`); setEvent(response.data.event) } catch { setEvent(null) } }, [id])
  useEffect(() => { void load(); const refresh = window.setInterval(() => void load(), 30_000); const clock = window.setInterval(() => setNow(Date.now()), 30_000); return () => { window.clearInterval(refresh); window.clearInterval(clock) } }, [load])
  if (!event) return <div className="empty-state">Sto caricando la drama room…</div>
  const auctionCloses = new Date(new Date(event.startsAt).getTime() - 60 * 60 * 1000).toISOString(); const status = event.phase === 'LIVE' ? 'LIVE ORA' : event.phase === 'IN_ARRIVO' ? `ASTE CHIUDONO TRA ${timeLabel(auctionCloses)}` : event.phase === 'IN_VALUTAZIONE' ? 'VERIFICHE IN CORSO' : 'EVENTO CONCLUSO'; void now
  return <div className="event-detail-page"><section className="event-hero-detail">{event.imageUrl && <img src={event.imageUrl} alt="" />}<div><p className="eyebrow">{status}</p><h2>{event.title}</h2><p>{event.description || 'La crew è pronta al prossimo colpo di scena.'}</p><p className="event-live-update">Le aste chiudono un’ora prima dell’inizio. Le carte vinte sono esclusive per questo evento.</p>{event.liveUpdate && <p className="event-live-update">✦ {event.liveUpdate}</p>}</div></section><PredictionForm eventId={event.id} phase={event.phase} closesAt={auctionCloses} onSaved={() => void load()} /></div>
}
