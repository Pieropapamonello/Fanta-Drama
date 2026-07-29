import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, CheckCheck } from 'lucide-react'
import api from '../services/api'

export default function Notifications() {
  const [items, setItems] = useState<any[]>([])
  useEffect(() => { void api.get('/profile/notifications').then((response) => setItems(response.data.notifications || [])).catch(() => undefined) }, [])
  const markRead = async () => { await api.post('/profile/notifications/read'); setItems((current) => current.map((item) => ({ ...item, readAt: new Date().toISOString() }))) }
  return <div className="notifications-page"><div className="page-heading"><div><p className="eyebrow">Sempre nel loop</p><h2>Notifiche</h2></div>{Boolean(items.some((item) => !item.readAt)) && <button className="btn btn-ghost" type="button" onClick={() => void markRead()}><CheckCheck size={16} /> Segna tutte lette</button>}</div><p className="page-lead">Qui trovi tutti gli aggiornamenti FantaDrama, anche se scegli Telegram o e-mail.</p>{items.length ? <div className="notification-list">{items.map((item) => <Link to={item.path || '/dashboard'} className={`notification-item ${item.readAt ? '' : 'is-unread'}`} key={item.id}><Bell size={17} /><div><b>{item.title}</b><p>{item.message}</p><small>{new Date(item.createdAt).toLocaleString('it-IT')}</small></div></Link>)}</div> : <div className="empty-state">Nessun aggiornamento per ora. Quando la crew muove qualcosa, lo vedrai qui.</div>}</div>
}
