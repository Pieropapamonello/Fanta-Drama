import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../services/api'
import PredictionForm from '../components/PredictionForm'

export default function EventDetail() {
  const { id } = useParams()
  const [event, setEvent] = useState<any>(null)
  useEffect(() => { if (id) api.get(`/events/${id}`).then(r => setEvent(r.data.event)).catch(() => {}) }, [id])
  return (
    <div>
      {event ? (
        <>
          <h2 className="text-2xl mb-4">{event.title}</h2>
          {event.imageUrl && (
            <img
              className="event-detail-image mb-4"
              src={event.imageUrl}
              alt={`Illustrazione di ${event.title}`}
            />
          )}
          <p className="mb-4">{event.description}</p>
          {event.liveUpdate && <p className="event-live-update event-detail-update">✦ {event.liveUpdate}</p>}
          <PredictionForm eventId={event.id} />
        </>
      ) : <p>Caricamento...</p>}
    </div>
  )
}
