import React, { useEffect, useState } from 'react'
import api from '../services/api'
import { Link } from 'react-router-dom'
import { Share2 } from 'lucide-react'

export default function GroupsList() {
  const [groups, setGroups] = useState<any[]>([])
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  useEffect(() => {
    api.get('/groups')
      .then((res) => setGroups(res.data.groups))
      .catch(() => setLoadError('Non riesco a caricare le tue crew. Riprova tra poco.'))
      .finally(() => setIsLoading(false))
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
  const shareGroup = async (group: any) => {
    const url = `${window.location.origin}/groups/join?code=${encodeURIComponent(group.code)}`
    try {
      if (navigator.share) await navigator.share({ title: `Entra in ${group.name} su FantaDrama`, text: `Unisciti alla mia crew “${group.name}” su FantaDrama.`, url })
      else { await navigator.clipboard.writeText(url); setMessage('Link invito copiato: incollalo su WhatsApp, Telegram o dove preferisci.') }
    } catch (error: any) { if (error?.name !== 'AbortError') setMessage('Non riesco a condividere ora. Riprova.') }
  }
  return (
    <div>
      <div className="page-heading"><div><p className="eyebrow">La tua crew</p><h2>I miei gruppi</h2></div><div className="flex gap-2"><Link to="/groups/join" className="btn btn-ghost">Entra</Link><Link to="/groups/create" className="btn">+ Crea</Link></div></div>
      <div className="collection-grid">
        {groups.map(g => (
          <div key={g.id} className="game-card">
            <span className="eyebrow">Gruppo privato</span><h3>{g.name}</h3><p>{g.description || 'Qui si decide chi legge meglio il caos.'}</p><Link className="group-open-link" to={`/groups/${g.id}`}>Apri stanza gruppo →</Link>
            <p className="meta">Codice invito: <strong>{g.code}</strong></p><div className="group-member-preview">{(g.members || []).slice(0, 5).map((member: any) => <span key={member.id} title={member.username}>{member.avatar ? <img src={member.avatar} alt="" /> : <i>{member.username?.slice(0, 1)}</i>}</span>)}<b>{g.memberCount || 0} membri nella crew</b></div>
            <div className="mt-3 flex items-center gap-3"><Link to={`/groups/${g.id}/characters`}>Gestisci personaggi →</Link><button type="button" className="group-share" onClick={() => void shareGroup(g)}><Share2 size={14} /> Invita</button>{g.currentUserRole === 'ADMIN' && <button type="button" className="text-xs text-rose-300" onClick={() => deleteGroup(g)} disabled={deletingId === g.id}>{deletingId === g.id ? 'Eliminazione…' : 'Elimina'}</button>}</div>
          </div>
        ))}
      </div>
      {isLoading && <div className="empty-state">Carico le tue crew…</div>}
      {!isLoading && !groups.length && !loadError && <div className="empty-state">Non fai ancora parte di nessun gruppo. Creane uno o usa un codice invito.</div>}
      {loadError && <div className="empty-state" role="alert">{loadError}</div>}
      {message && <p className="mt-4 text-sm text-slate-300" role="status">{message}</p>}
      {groups.some((group) => group.currentUserRole === 'ADMIN') && <div className="mt-4"><Link to="/characters/create" className="btn btn-ghost">Aggiungi un personaggio</Link></div>}
    </div>
  )
}
