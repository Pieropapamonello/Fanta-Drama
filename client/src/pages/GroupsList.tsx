import React, { useEffect, useState } from 'react'
import api from '../services/api'
import { Link } from 'react-router-dom'

export default function GroupsList() {
  const [groups, setGroups] = useState<any[]>([])
  useEffect(() => {
    api.get('/groups').then((res) => setGroups(res.data.groups)).catch(() => {})
  }, [])
  return (
    <div>
      <div className="page-heading"><div><p className="eyebrow">La tua crew</p><h2>I miei gruppi</h2></div><div className="flex gap-2"><Link to="/groups/join" className="btn btn-ghost">Entra</Link><Link to="/groups/create" className="btn">+ Crea</Link></div></div>
      <div className="collection-grid">
        {groups.map(g => (
          <div key={g.id} className="game-card">
            <span className="eyebrow">Gruppo privato</span><h3>{g.name}</h3><p>{g.description || 'Qui si decide chi legge meglio il caos.'}</p>
            <p className="meta">Codice invito: <strong>{g.code}</strong></p><Link to={`/groups/${g.id}/characters`}>Gestisci personaggi →</Link>
          </div>
        ))}
      </div>
      {!groups.length && <div className="empty-state">Non fai ancora parte di nessun gruppo. Creane uno o usa un codice invito.</div>}
      <div className="mt-4"><Link to="/characters/create" className="btn btn-ghost">Aggiungi un personaggio</Link></div>
    </div>
  )
}
