import React, { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import api from '../services/api'

type Props = { eventId: string; phase?: string; closesAt?: string; onSaved?: () => void }
type FormData = { cardId: string; value: string; credits: number }

export default function PredictionForm({ eventId, phase, closesAt, onSaved }: Props) {
  const { register, handleSubmit, watch, setValue } = useForm<FormData>({ defaultValues: { credits: 10, value: '' } })
  const [cards, setCards] = useState<any[]>([])
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const selectedId = watch('cardId')
  const credits = watch('credits')
  const closed = phase === 'CONCLUSO' || phase === 'PRONOSTICI_CHIUSI' || phase === 'IN_VALUTAZIONE'

  useEffect(() => { void api.get('/cards').then((response) => setCards(response.data.cards || [])).catch(() => setMessage('Non riesco a caricare il tuo mazzo.')) }, [])

  const submit = async (data: FormData) => {
    setSaving(true); setMessage('')
    try {
      await api.post('/predictions', { eventId, cardId: data.cardId, value: data.value, credits: Number(data.credits) })
      setMessage('Pronostico salvato: la crew vedra il tuo coraggio al momento giusto.')
      onSaved?.()
    } catch (error: any) {
      const code = error.response?.data?.error
      setMessage(code === 'credits_exceeded' ? 'Puoi puntare al massimo 100 crediti per evento.' : code === 'predictions_closed' ? 'I pronostici per questo evento sono chiusi.' : 'Non riesco a salvare il pronostico. Riprova.')
    } finally { setSaving(false) }
  }

  if (closed) return <section className="prediction-panel"><p className="eyebrow">Fase conclusa</p><h3>Pronostici chiusi</h3><p>Guarda la classifica per scoprire come e andata alla crew.</p></section>
  return <section className="prediction-panel"><div><p className="eyebrow">La tua mossa</p><h3>Fai il tuo pronostico</h3><p>{closesAt ? `Hai tempo fino al ${new Date(closesAt).toLocaleString('it-IT')}.` : 'Scegli una carta dal tuo mazzo e punta i crediti.'}</p></div>
    {!cards.length ? <p className="prediction-empty">Il tuo mazzo e vuoto. Apri Carte Drama e aggiungi una carta prima di pronosticare.</p> : <form onSubmit={handleSubmit(submit)}>
      <div className="prediction-card-picker">{cards.map((card) => <button type="button" key={card.id} className={selectedId === card.id ? 'is-selected' : ''} onClick={() => setValue('cardId', card.id, { shouldValidate: true })}><img src={card.imageUrl} alt="" /><span><b>{card.title}</b><small>{card.basePoints} pt base</small></span></button>)}</div>
      <label>La tua previsione<input className="input" {...register('value', { required: true, minLength: 2, maxLength: 120 })} placeholder="Es. il brindisi parte in ritardo" /></label>
      <label className="credit-control">Crediti da puntare <b>{credits || 0}</b><input type="range" min="0" max="100" step="5" {...register('credits', { valueAsNumber: true })} /></label>
      <button className="btn" disabled={saving || !selectedId}>{saving ? 'Salvataggio…' : 'Conferma pronostico'}</button>
    </form>}
    {message && <p className="prediction-message" role="status">{message}</p>}
  </section>
}
