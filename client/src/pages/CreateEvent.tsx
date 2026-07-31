import React, { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Gavel, ShoppingBag } from 'lucide-react'
import api from '../services/api'
import { useNavigate, useSearchParams } from 'react-router-dom'
import ImageForge from '../components/ImageForge'

const schema = z.object({ title: z.string().min(1), description: z.string().optional(), startsAt: z.string().min(1), endsAt: z.string().min(1), groupId: z.string().min(1), acquisitionMode: z.enum(['AUCTION', 'DIRECT']), imageUrl: z.string().optional() })
type EventForm = z.infer<typeof schema>
const keyFor = (card: any) => card.catalogCardId ? `custom:${card.catalogCardId}` : `starter:${card.slug}`

export default function CreateEvent() {
  const { register, handleSubmit, setValue, watch } = useForm<EventForm>({ resolver: zodResolver(schema), defaultValues: { acquisitionMode: 'AUCTION' } })
  const navigate = useNavigate(); const [search] = useSearchParams(); const requestedGroupId = search.get('groupId') || ''
  const [groups, setGroups] = useState<any[]>([])
  const [cards, setCards] = useState<any[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [saving, setSaving] = useState(false)
  const mode = watch('acquisitionMode')

  useEffect(() => {
    Promise.all([api.get('/groups'), api.get('/cards/library')]).then(([groupData, cardData]) => {
      setGroups(groupData.data.groups || [])
      if (requestedGroupId) setValue('groupId', requestedGroupId)
      const library = cardData.data.cards || []; setCards(library); setSelected(new Set(library.map(keyFor)))
    }).catch(() => setError('Non riesco a caricare gruppi e carte.')).finally(() => setLoadingOptions(false))
  }, [requestedGroupId, setValue])

  const common = useMemo(() => cards.filter((card) => !card.catalogCardId), [cards])
  const community = useMemo(() => cards.filter((card) => card.catalogCardId), [cards])
  const toggle = (key: string) => setSelected((current) => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next })
  const onSubmit = async (data: any) => {
    if (!selected.size) { setError('Seleziona almeno una carta per questo evento.'); return }
    setSaving(true)
    try {
      setError(null)
      const response = await api.post('/events', { ...data, cardKeys: Array.from(selected), startsAt: new Date(data.startsAt).toISOString(), endsAt: new Date(data.endsAt).toISOString() })
      navigate(`/events/${response.data.event.id}`)
    } catch (err: any) {
      const code = err.response?.data?.error
      setError(code === 'event_needs_one_hour_auction' ? 'Con la modalità asta, l’evento deve iniziare tra più di un’ora.' : code === 'invalid_dates' ? 'La fine deve essere successiva all’inizio.' : code || 'Non riesco a creare l’evento.')
    } finally { setSaving(false) }
  }

  const cardSection = (title: string, list: any[]) => <section className="event-card-selection"><div><h3>{title}</h3><span>{list.filter((card) => selected.has(keyFor(card))).length}/{list.length} selezionate</span></div><div>{list.map((card) => { const key = keyFor(card); return <button type="button" key={key} className={selected.has(key) ? 'is-selected' : ''} onClick={() => toggle(key)}>{card.imageUrl ? <img src={card.imageUrl} alt="" /> : <i>{card.title?.slice(0, 1)}</i>}<span><b>{card.title}</b><small>{card.rarity}</small></span><em>{selected.has(key) ? '✓' : '+'}</em></button> })}</div></section>

  return <form onSubmit={handleSubmit(onSubmit)} className="event-create-form">
    <div><p className="eyebrow">Nuovo capitolo</p><h2>Crea evento</h2><p>Imposta il mercato e scegli esattamente quali carte saranno valide in questo evento.</p></div>
    <div className="event-form-grid"><label>Titolo<input {...register('title')} className="input" /></label><label>Gruppo<select {...register('groupId')} className="input" defaultValue=""><option value="" disabled>Seleziona il gruppo</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label><label className="is-wide">Descrizione<textarea {...register('description')} className="input" rows={3} /></label><label>Inizio<input type="datetime-local" {...register('startsAt')} className="input" /></label><label>Fine<input type="datetime-local" {...register('endsAt')} className="input" /></label></div>
    <section className="purchase-mode-picker"><div><p className="eyebrow">Come si comprano le carte?</p><h3>Modalità mercato</h3></div><div><label className={mode === 'AUCTION' ? 'is-selected' : ''}><input type="radio" value="AUCTION" {...register('acquisitionMode')} /><Gavel /><span><b>Asta esclusiva</b><small>Una sola copia: la carta va a chi offre più crediti.</small></span></label><label className={mode === 'DIRECT' ? 'is-selected' : ''}><input type="radio" value="DIRECT" {...register('acquisitionMode')} /><ShoppingBag /><span><b>Acquisto diretto</b><small>Più utenti possono acquistare la stessa carta per questo evento.</small></span></label></div></section>
    <section className="event-card-picker-head"><div><p className="eyebrow">Mazzo dell’evento</p><h3>Scegli le carte da generare</h3><p>Le carte acquistate saranno valide soltanto per questo evento.</p></div><button type="button" className="btn btn-ghost" onClick={() => setSelected(selected.size === cards.length ? new Set() : new Set(cards.map(keyFor)))}>{selected.size === cards.length ? 'Deseleziona tutte' : 'Seleziona tutte'}</button></section>
    {cardSection('Carte comuni', common)}{cardSection('Carte create dagli utenti', community)}
    <ImageForge kind="EVENT" imageUrl={watch('imageUrl')} onChange={(url) => setValue('imageUrl', url)} />
    {!loadingOptions && !groups.length && <p className="profile-error">Solo chi amministra una crew può creare un evento. Crea una crew oppure chiedi all’amministratore del gruppo.</p>}
    {error && <p className="profile-error">{error}</p>}
    <button className="btn event-create-submit" disabled={saving || loadingOptions || !groups.length}>{loadingOptions ? 'Carico gruppi e carte…' : saving ? 'Creo evento e carte…' : `Crea evento con ${selected.size} carte`}</button>
  </form>
}
