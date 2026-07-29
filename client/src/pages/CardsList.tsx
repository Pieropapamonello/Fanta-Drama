import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import DramaCard, { DramaCardData } from '../components/DramaCard'
import api from '../services/api'

export default function CardsList() {
  const [cards, setCards] = useState<DramaCardData[]>([]); const [notice, setNotice] = useState('')
  useEffect(() => { api.get('/cards/library').then((response) => setCards(response.data.cards || [])).catch(() => setNotice('Non riesco a caricare il catalogo.')) }, [])
  return <div><div className="page-heading"><div><p className="eyebrow">L’arsenale del caos</p><h2>Carte Drama</h2></div><Link to="/cards/create" className="btn">+ Crea carta</Link></div><p className="page-lead">Ogni carta entra in asta per gli eventi. Non esistono più carte gratuite o punti fissi: vince chi offre più crediti.</p>{notice && <div className="deck-notice">{notice}</div>}<section className="deck-section library-section"><div className="deck-section-head"><div><p className="eyebrow">Catalogo approvato</p><h3>Carte disponibili <span>{cards.length}</span></h3></div><p>Le carte saranno messe all’asta quando viene creato un evento.</p></div><div className="drama-card-grid">{cards.map((card) => <DramaCard key={card.catalogCardId || card.slug} card={card} />)}</div></section></div>
}
