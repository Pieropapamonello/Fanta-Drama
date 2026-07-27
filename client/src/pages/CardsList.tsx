import React, { useEffect, useState } from 'react'
import api from '../services/api'
import { Link } from 'react-router-dom'

export default function CardsList() {
  const [cards, setCards] = useState<any[]>([])
  useEffect(() => { api.get('/cards').then(r => setCards(r.data.cards)).catch(() => {}) }, [])
  return (
    <div>
      <h2 className="text-2xl mb-4">Carte Drama</h2>
      <div className="grid gap-3">
        {cards.map(c => (
          <div key={c.id} className="p-3 border rounded shadow-sm">
            <h3 className="font-semibold">{c.title}</h3>
            <p className="text-sm">{c.description}</p>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <Link to="/cards/create" className="btn">Crea carta</Link>
      </div>
    </div>
  )
}
