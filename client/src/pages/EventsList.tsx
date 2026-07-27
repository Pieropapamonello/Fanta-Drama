import React, { useEffect, useState } from 'react'
import api from '../services/api'
import { Link } from 'react-router-dom'

export default function EventsList() {
  const [events, setEvents] = useState<any[]>([])
  useEffect(() => { api.get('/events').then(r => setEvents(r.data.events)).catch(() => {}) }, [])
  return (
    <div>
      <h2 className="text-2xl mb-4">Eventi</h2>
      <div className="space-y-2">
        {events.map(e => (
          <div key={e.id} className="p-3 border rounded">
            <h3 className="font-semibold">{e.title}</h3>
            <p className="text-sm">{e.description}</p>
            <Link to={`/events/${e.id}`} className="text-indigo-600">Apri</Link>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <Link to="/events/create" className="btn">Crea evento</Link>
      </div>
    </div>
  )
}
