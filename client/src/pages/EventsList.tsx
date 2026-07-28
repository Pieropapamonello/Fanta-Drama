import React, { useEffect, useState } from 'react'
import api from '../services/api'
import { Link } from 'react-router-dom'

export default function EventsList() {
  const [events, setEvents] = useState<any[]>([])
  useEffect(() => { api.get('/events').then(r => setEvents(r.data.events)).catch(() => {}) }, [])
  return (
    <div>
      <div className="page-heading"><div><p className="eyebrow">Il prossimo capitolo</p><h2>Eventi</h2></div><Link to="/events/create" className="btn">+ Crea evento</Link></div>
      <div className="collection-grid">
        {events.map(e => (
          <div key={e.id} className="game-card">
            <span className="eyebrow">{e.state || 'IN ARRIVO'}</span><h3>{e.title}</h3><p>{e.description || 'Preparati: può succedere di tutto.'}</p>
            <Link to={`/events/${e.id}`}>Apri evento →</Link>
          </div>
        ))}
      </div>
      {!events.length && <div className="empty-state">Qui compariranno le prossime sfide del tuo gruppo.</div>}
    </div>
  )
}
