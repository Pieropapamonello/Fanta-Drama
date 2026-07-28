import React, { useEffect, useMemo, useState } from 'react'
import api from '../services/api'
import { Link } from 'react-router-dom'
import DramaCard, { DramaCardData } from '../components/DramaCard'

export default function CardsList() {
  const [cards, setCards] = useState<DramaCardData[]>([])
  const [library, setLibrary] = useState<DramaCardData[]>([])
  const [adding, setAdding] = useState<string | null>(null)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    Promise.all([api.get('/cards'), api.get('/cards/library')])
      .then(([owned, catalogue]) => { setCards(owned.data.cards); setLibrary(catalogue.data.cards) })
      .catch(() => setNotice('Non riesco a caricare il mazzo. Riprova tra poco.'))
  }, [])

  const ownedSlugs = useMemo(() => new Set(cards.map((card) => card.librarySlug)), [cards])
  const addToDeck = async (card: DramaCardData) => {
    if (!card.slug) return
    setAdding(card.slug); setNotice('')
    try {
      const response = await api.post(`/cards/library/${card.slug}`)
      if (!cards.some((owned) => owned.id === response.data.card.id)) setCards((current) => [response.data.card, ...current])
      setNotice(response.data.alreadyAdded ? 'Questa carta era già nel tuo mazzo.' : `${card.title} è stata aggiunta al tuo mazzo.`)
    } catch { setNotice('Non sono riuscito ad aggiungere la carta. Riprova.') } finally { setAdding(null) }
  }

  return <div>
    <div className="page-heading"><div><p className="eyebrow">L'arsenale del caos</p><h2>Carte Drama</h2></div><Link to="/cards/create" className="btn">+ Crea carta</Link></div>
    <p className="page-lead">Scegli le carte del tuo mazzo: ogni carta ha un’illustrazione, una rarità e un effetto che accende la serata.</p>
    {notice && <div className="deck-notice" role="status">{notice}</div>}

    <section className="deck-section">
      <div className="deck-section-head"><div><p className="eyebrow">Collezione personale</p><h3>Il tuo mazzo <span>{cards.length}</span></h3></div></div>
      {cards.length ? <div className="drama-card-grid owned-card-grid">{cards.map(card => <DramaCard key={card.id} card={card} />)}</div> : <div className="empty-state">Il tuo mazzo è vuoto: scegli una carta dal catalogo qui sotto.</div>}
    </section>

    <section className="deck-section library-section">
      <div className="deck-section-head"><div><p className="eyebrow">Mazzo FantaDrama</p><h3>Scegli le tue carte <span>{library.length}</span></h3></div><p>Ogni carta può essere aggiunta una sola volta.</p></div>
      <div className="drama-card-grid">{library.map(card => <DramaCard key={card.slug} card={card} owned={ownedSlugs.has(card.slug)} isAdding={adding === card.slug} onAction={() => addToDeck(card)} actionLabel="Aggiungi al mazzo" />)}</div>
    </section>
  </div>
}
