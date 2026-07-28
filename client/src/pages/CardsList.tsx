import React, { useEffect, useState } from 'react'
import api from '../services/api'
import { Link } from 'react-router-dom'

export default function CardsList() {
  const [cards, setCards] = useState<any[]>([])
  useEffect(() => { api.get('/cards').then(r => setCards(r.data.cards)).catch(() => {}) }, [])
  return (
    <div>
      <div className="page-heading"><div><p className="eyebrow">L'arsenale del caos</p><h2>Carte Drama</h2></div><Link to="/cards/create" className="btn">+ Nuova carta</Link></div>
      <div className="collection-grid">
        {cards.map(c => (
          <div key={c.id} className="game-card">
            <span className="eyebrow">{c.rarity || 'COMMON'} · {c.basePoints || 0} pt</span>
            <h3>{c.title}</h3><p>{c.description || 'Una nuova possibilità di far esplodere la serata.'}</p>
          </div>
        ))}
      </div>
      {!cards.length && <div className="empty-state">Nessuna carta ancora. Crea la prima scintilla di drama.</div>}
    </div>
  )
}
