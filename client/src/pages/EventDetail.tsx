import React, { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../services/api'
import PredictionForm from '../components/PredictionForm'

function timeLabel(target?: string) {
  if (!target) return ''
  const difference = new Date(target).getTime() - Date.now()
  if (difference <= 0) return 'adesso'
  const minutes = Math.ceil(difference / 60_000)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  return `${hours} h ${minutes % 60} min`
}

export default function EventDetail() {
  const { id } = useParams()
  const [event, setEvent] = useState<any>(null)
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [now, setNow] = useState(Date.now())
  const load = useCallback(async () => {
    if (!id) return
    try {
      const [eventResponse, leaderboardResponse] = await Promise.all([api.get(`/events/${id}`), api.get(`/events/${id}/leaderboard`)])
      setEvent(eventResponse.data.event); setLeaderboard(leaderboardResponse.data.leaderboard || [])
    } catch { setEvent(null) }
  }, [id])
  useEffect(() => { void load(); const refresh = window.setInterval(() => void load(), 30_000); const clock = window.setInterval(() => setNow(Date.now()), 30_000); return () => { window.clearInterval(refresh); window.clearInterval(clock) } }, [load])
  if (!event) return <div className="empty-state">Sto caricando la drama room…</div>
  const deadline = event.closePredictionsAt || event.startsAt
  const status = event.phase === 'LIVE' ? 'LIVE ORA' : event.phase === 'IN_ARRIVO' ? `INIZIA TRA ${timeLabel(deadline)}` : event.phase === 'IN_VALUTAZIONE' ? 'RISULTATI IN ARRIVO' : 'EVENTO CONCLUSO'
  void now
  return <div className="event-detail-page">
    <section className="event-hero-detail">{event.imageUrl && <img src={event.imageUrl} alt="" />}<div><p className="eyebrow">{status}</p><h2>{event.title}</h2><p>{event.description || 'La crew e pronta al prossimo colpo di scena.'}</p>{event.liveUpdate && <p className="event-live-update">✦ {event.liveUpdate}</p>}</div></section>
    <div className="event-play-grid"><PredictionForm eventId={event.id} phase={event.phase} closesAt={event.closePredictionsAt || event.startsAt} onSaved={() => void load()} /><section className="leaderboard-panel"><p className="eyebrow">Classifica live</p><h3>La crew in classifica</h3>{leaderboard.length ? <ol>{leaderboard.map((player, index) => <li key={player.userId}><b>#{index + 1}</b>{player.avatar ? <img src={player.avatar} alt="" /> : <i>{player.username.slice(0, 1)}</i>}<span>{player.username}</span><strong>{player.points} pt</strong></li>)}</ol> : <p>Nessun punto assegnato: la classifica si accende alla chiusura dell’evento.</p>}</section></div>
  </div>
}
