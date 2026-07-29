import React, { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CalendarDays, Send, ShoppingBag, Users } from 'lucide-react'
import api from '../services/api'

function formatDate(value?: string) { return value ? new Date(value).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' }) : 'Data da definire' }

export default function GroupDetail() {
  const { groupId } = useParams()
  const [group, setGroup] = useState<any>(null); const [events, setEvents] = useState<any[]>([]); const [messages, setMessages] = useState<any[]>([]); const [draft, setDraft] = useState(''); const [sending, setSending] = useState(false); const [notice, setNotice] = useState('')
  const load = useCallback(async () => {
    if (!groupId) return
    try {
      const [groupData, eventData, chatData] = await Promise.all([api.get(`/groups/${groupId}`), api.get(`/events?groupId=${groupId}`), api.get(`/groups/${groupId}/messages`)])
      setGroup(groupData.data.group); setEvents(eventData.data.events || []); setMessages(chatData.data.messages || [])
    } catch { setNotice('Non riesco ad aprire questa stanza privata.') }
  }, [groupId])
  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 10_000); return () => window.clearInterval(timer) }, [load])
  const send = async (event: React.FormEvent) => {
    event.preventDefault(); if (!groupId || !draft.trim()) return
    setSending(true); setNotice('')
    try { const response = await api.post(`/groups/${groupId}/messages`, { message: draft }); setMessages((all) => [...all, response.data.message]); setDraft('') } catch { setNotice('Non riesco a inviare il messaggio.') } finally { setSending(false) }
  }
  if (!group) return <div className="empty-state">Sto aprendo la stanza della crew…</div>
  return <div className="group-detail-page"><section className="group-detail-hero"><p className="eyebrow">Stanza privata</p><h2>{group.name}</h2><p>{group.description || 'Qui si decide chi legge meglio il caos.'}</p><div><span>Codice invito: <b>{group.code}</b></span><span><Users size={15} /> {group.members?.length || 0} partecipanti</span></div></section><section className="group-detail-grid"><div className="group-events-panel"><div className="group-panel-head"><div><p className="eyebrow">Eventi della crew</p><h3>Compra e gioca le carte</h3></div><Link to="/events/create" className="btn btn-ghost">+ Evento</Link></div>{events.length ? <div className="group-events-list">{events.map((item) => <article key={item.id}><div><span className="event-date"><CalendarDays size={15} /> Inizio {formatDate(item.startsAt)}</span><h4>{item.title}</h4><p>{item.description || 'Un nuovo capitolo è pronto.'}</p><small>Fine: {formatDate(item.endsAt)}</small></div><Link to={`/events/${item.id}`} className="btn"><ShoppingBag size={15} /> Dettagli e aste</Link></article>)}</div> : <div className="empty-state">Non ci sono eventi: crea il primo capitolo della crew.</div>}</div><aside className="group-members-panel"><p className="eyebrow">Partecipanti</p><h3>La tua crew</h3>{(group.members || []).map((member: any) => <article key={member.id}>{member.avatar ? <img src={member.avatar} alt="" /> : <i>{member.username?.slice(0, 1)}</i>}<div><b>{member.username}</b><span>{member.crewRole}{member.city ? ` · ${member.city}` : ''}</span></div></article>)}</aside></section><section className="group-chat-panel"><div><p className="eyebrow">Chat privata</p><h3>Parla con la crew</h3><span>Solo i membri di {group.name} possono leggere e scrivere qui.</span></div><div className="group-chat-messages">{messages.length ? messages.map((message: any) => <article key={message.id}><>{message.avatar ? <img src={message.avatar} alt="" /> : <i>{message.username?.slice(0, 1)}</i>}</><div><b>{message.username}</b><p>{message.message}</p><small>{formatDate(message.createdAt)}</small></div></article>) : <p>Nessun messaggio ancora. Rompi il ghiaccio.</p>}</div><form onSubmit={send}><input className="input" value={draft} maxLength={700} onChange={(event) => setDraft(event.target.value)} placeholder="Scrivi alla crew…" /><button className="btn" disabled={sending || !draft.trim()}>{sending ? 'Invio…' : <><Send size={15} /> Invia</>}</button></form>{notice && <p className="profile-error">{notice}</p>}</section></div>
}
