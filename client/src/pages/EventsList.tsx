import React, { useEffect, useState } from 'react'
import api from '../services/api'
import { Link } from 'react-router-dom'

const eventMood = (state?: string) => {
  const normalized = state?.toUpperCase() || ''
  if (normalized.includes('LIVE')) return { label: 'LIVE', className: 'event-live', icon: '⚡' }
  if (normalized.includes('CHIUS')) return { label: 'Pronostici chiusi', className: 'event-tense', icon: '◒' }
  return { label: state || 'IN ARRIVO', className: 'event-upcoming', icon: '✦' }
}

export default function EventsList() {
  const [events, setEvents] = useState<any[]>([])
  useEffect(() => { api.get('/events').then(r => setEvents(r.data.events)).catch(() => {}) }, [])
  return (
    <div>
      <div className="page-heading"><div><p className="eyebrow">Il prossimo capitolo</p><h2>Eventi</h2></div><Link to="/events/create" className="btn">+ Crea evento</Link></div>
      <div className="collection-grid">
        {events.map(e => {
          const mood = eventMood(e.state)
          return <div key={e.id} className={`game-card event-card ${mood.className}`}>
            {e.imageUrl && <img className="event-card-image" src={e.imageUrl} alt="" />}
            <span className="event-status"><i>{mood.icon}</i>{mood.label}</span><h3>{e.title}</h3><p>{e.description || 'Preparati: può succedere di tutto.'}</p>
            {e.liveUpdate && <p className="event-live-update">✦ {e.liveUpdate}</p>}
            <span className="event-wave" aria-hidden="true" />
            <Link to={`/events/${e.id}`}>Apri evento →</Link>
          </div>
        })}
      </div>
      {!events.length && <div className="empty-state">Qui compariranno le prossime sfide del tuo gruppo.</div>}
    </div>
  )
}
