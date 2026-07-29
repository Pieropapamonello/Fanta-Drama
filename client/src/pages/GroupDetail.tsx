import React, { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CalendarDays, CreditCard, PlusCircle, Send, ShoppingBag, Users } from 'lucide-react'
import api from '../services/api'

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' }) : 'Data da definire'
}

function Avatar({ person }: { person: any }) {
  return person.avatar ? <img src={person.avatar} alt="" /> : <i>{person.username?.slice(0, 1)}</i>
}

export default function GroupDetail() {
  const { groupId } = useParams()
  const [group, setGroup] = useState<any>(null)
  const [events, setEvents] = useState<any[]>([])
  const [messages, setMessages] = useState<any[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState('')
  const [selectedMember, setSelectedMember] = useState<any>(null)
  const [memberLoading, setMemberLoading] = useState(false)

  const load = useCallback(async () => {
    if (!groupId) return
    try {
      const [groupData, eventData, chatData] = await Promise.all([
        api.get(`/groups/${groupId}`), api.get(`/events?groupId=${groupId}`), api.get(`/groups/${groupId}/messages`)
      ])
      setGroup(groupData.data.group)
      setEvents(eventData.data.events || [])
      setMessages(chatData.data.messages || [])
    } catch { setNotice('Non riesco ad aprire questa stanza privata.') }
  }, [groupId])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), 10_000)
    return () => window.clearInterval(timer)
  }, [load])

  const send = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!groupId || !draft.trim()) return
    setSending(true); setNotice('')
    try {
      const response = await api.post(`/groups/${groupId}/messages`, { message: draft })
      setMessages((all) => [...all, response.data.message])
      setDraft('')
    } catch { setNotice('Non riesco a inviare il messaggio.') } finally { setSending(false) }
  }

  const openMember = async (memberId: string) => {
    if (!groupId) return
    setMemberLoading(true); setNotice('')
    try {
      const response = await api.get(`/groups/${groupId}/members/${memberId}`)
      setSelectedMember(response.data.member)
    } catch { setNotice('Non riesco a caricare il profilo del partecipante.') } finally { setMemberLoading(false) }
  }

  if (!group) return <div className="empty-state">Sto aprendo la stanza della crew…</div>

  return <div className="group-detail-page">
    <section className="group-detail-hero">
      <p className="eyebrow">Stanza privata</p><h2>{group.name}</h2>
      <p>{group.description || 'Qui si decide chi legge meglio il caos.'}</p>
      <div><span>Codice invito: <b>{group.code}</b></span><span><Users size={15} /> {group.members?.length || 0} partecipanti</span></div>
    </section>

    <section className="group-detail-grid">
      <div className="group-events-panel">
        <div className="group-panel-head">
          <div><p className="eyebrow">Eventi della crew</p><h3>Compra e gioca le carte</h3></div>
          <div className="group-action-links">
            <Link to="/cards/create" className="btn btn-ghost"><PlusCircle size={15} /> Crea carta</Link>
            <Link to={`/groups/${group.id}/cards`} className="btn btn-ghost"><CreditCard size={15} /> Carte</Link>
            <Link to="/events/create" className="btn">+ Evento</Link>
          </div>
        </div>
        <p className="group-auction-note">Le aste si aprono automaticamente per tutte le carte quando viene creato un evento. Da un evento puoi comprare o rilanciare con i tuoi crediti.</p>
        {events.length ? <div className="group-events-list">{events.map((item) => <article key={item.id}>
          <div><span className="event-date"><CalendarDays size={15} /> Inizio {formatDate(item.startsAt)}</span><h4>{item.title}</h4><p>{item.description || 'Un nuovo capitolo è pronto.'}</p><small>Fine: {formatDate(item.endsAt)}</small></div>
          <Link to={`/events/${item.id}`} className="btn"><ShoppingBag size={15} /> Compra carte</Link>
        </article>)}</div> : <div className="empty-state">Non ci sono ancora eventi. Crea un evento per aprire le aste delle carte per tutta la crew.</div>}
      </div>

      <aside className="group-members-panel">
        <p className="eyebrow">Partecipanti</p><h3>La tua crew</h3>
        <p className="member-hint">Tocca un partecipante per vedere profilo e carte acquistate.</p>
        {(group.members || []).map((member: any) => <button type="button" key={member.id} onClick={() => void openMember(member.id)}>
          <Avatar person={member} /><div><b>{member.username}</b><span>{member.crewRole}{member.city ? ` · ${member.city}` : ''}</span></div><small>Apri</small>
        </button>)}
        {memberLoading && <p className="member-hint">Apro il profilo…</p>}
      </aside>
    </section>

    {selectedMember && <section className="group-member-profile">
      <button type="button" className="participant-close" onClick={() => setSelectedMember(null)}>×</button>
      <div className="participant-profile-head"><Avatar person={selectedMember} /><div><p className="eyebrow">Profilo partecipante</p><h3>{selectedMember.username}</h3><span>{selectedMember.crewRole}{selectedMember.city ? ` · ${selectedMember.city}` : ''}</span></div></div>
      {selectedMember.bio && <p>{selectedMember.bio}</p>}
      {selectedMember.motto && <blockquote>“{selectedMember.motto}”</blockquote>}
      <div className="participant-cards"><strong>Carte acquistate / offerte in testa</strong>
        {selectedMember.cards?.length ? selectedMember.cards.map((card: any) => <Link key={card.id} to={`/events/${card.eventId}`}>
          {card.imageUrl ? <img src={card.imageUrl} alt="" /> : <i>✦</i>}
          <span><b>{card.title}</b><small>{card.rarity} · {card.state} · {card.credits} crediti</small><em>{card.eventTitle}</em></span>
        </Link>) : <p>Per ora non ha carte acquistate né offerte in testa in questa crew.</p>}
      </div>
    </section>}

    <section className="group-chat-panel">
      <div><p className="eyebrow">Chat privata</p><h3>Parla con la crew</h3><span>Solo i membri di {group.name} possono leggere e scrivere qui.</span></div>
      <div className="group-chat-messages">{messages.length ? messages.map((message: any) => <article key={message.id}><Avatar person={message} /><div><b>{message.username}</b><p>{message.message}</p><small>{formatDate(message.createdAt)}</small></div></article>) : <p>Nessun messaggio ancora. Rompi il ghiaccio.</p>}</div>
      <form onSubmit={send}><input className="input" value={draft} maxLength={700} onChange={(event) => setDraft(event.target.value)} placeholder="Scrivi alla crew…" /><button className="btn" disabled={sending || !draft.trim()}>{sending ? 'Invio…' : <><Send size={15} /> Invia</>}</button></form>
      {notice && <p className="profile-error">{notice}</p>}
    </section>
  </div>
}
