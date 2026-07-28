import React, { useEffect, useState } from 'react'
import api from '../services/api'
import { Link } from 'react-router-dom'

export default function GroupsList() {
  const [groups, setGroups] = useState<any[]>([])
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  useEffect(() => {
    api.get('/groups').then((res) => setGroups(res.data.groups)).catch(() => {})
  }, [])
  const deleteGroup = async (group: any) => {
    if (!window.confirm(`Eliminare “${group.name}”? Verranno rimossi anche eventi, personaggi e pronostici collegati.`)) return
    try {
      setDeletingId(group.id)
      setMessage(null)
      await api.delete(`/groups/${group.id}`)
      setGroups((items) => items.filter((item) => item.id !== group.id))
      setMessage('Gruppo eliminato.')
    } catch (error: any) {
      setMessage(error.response?.data?.error || 'Non riesco a eliminare il gruppo.')
    } finally { setDeletingId(null) }
  }
  return (
    <div>
      <div className="page-heading"><div><p className="eyebrow">La tua crew</p><h2>I miei gruppi</h2></div><div className="flex gap-2"><Link to="/groups/join" className="btn btn-ghost">Entra</Link><Link to="/groups/create" className="btn">+ Crea</Link></div></div>
      <div className="collection-grid">
        {groups.map(g => (
          <div key={g.id} className="game-card">
            <span className="eyebrow">Gruppo privato</span><h3>{g.name}</h3><p>{g.description || 'Qui si decide chi legge meglio il caos.'}</p>
            <p className="meta">Codice invito: <strong>{g.code}</strong></p>
            <div className="mt-3 flex items-center gap-3"><Link to={`/groups/${g.id}/characters`}>Gestisci personaggi →</Link><button type="button" className="text-xs text-rose-300" onClick={() => deleteGroup(g)} disabled={deletingId === g.id}>{deletingId === g.id ? 'Eliminazione…' : 'Elimina'}</button></div>
          </div>
        ))}
      </div>
      {!groups.length && <div className="empty-state">Non fai ancora parte di nessun gruppo. Creane uno o usa un codice invito.</div>}
      {message && <p className="mt-4 text-sm text-slate-300" role="status">{message}</p>}
      <div className="mt-4"><Link to="/characters/create" className="btn btn-ghost">Aggiungi un personaggio</Link></div>
    </div>
  )
}
