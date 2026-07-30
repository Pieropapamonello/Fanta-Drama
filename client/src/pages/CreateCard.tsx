import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import api from '../services/api'
import { useNavigate, useSearchParams } from 'react-router-dom'
import ImageForge from '../components/ImageForge'

const schema = z.object({ title: z.string().trim().min(3), description: z.string().trim().min(12), directPrice: z.coerce.number().int().min(1).max(1_000_000), imageUrl: z.string().url(), imageStoragePath: z.string().optional() })

export default function CreateCard() {
  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema), defaultValues: { directPrice: 100 } })
  const navigate = useNavigate(); const [search] = useSearchParams(); const eventId = search.get('eventId'); const [error, setError] = useState('')
  const dedicated = Boolean(eventId)
  const onSubmit = async (data: any) => {
    try { await api.post('/cards', { ...data, ...(eventId ? { eventId } : {}) }); navigate(eventId ? `/events/${eventId}` : '/cards') }
    catch (err: any) {
      const code = err.response?.data?.error
      setError(code === 'event_not_found' ? 'Questo evento non esiste più oppure è stato eliminato. Torna alla lista eventi e riaprilo.' : code === 'event_access_denied' ? 'Non fai parte del gruppo di questo evento.' : code === 'join_event_before_creating_card' ? 'Aderisci prima all’evento, poi potrai creare una carta dedicata.' : code || 'Errore nella creazione della carta.')
    }
  }
  return <form onSubmit={handleSubmit(onSubmit)} className="max-w-md">
    <p className="eyebrow">{dedicated ? 'Mazzo dell’evento' : 'Collezione condivisa'}</p><h2 className="text-2xl mb-4">{dedicated ? 'Crea una carta dedicata' : 'Crea una carta unica'}</h2>
    <p className="page-lead">{dedicated ? 'Sarà valida solo per questo evento ed entrerà subito nel suo mercato, ad asta o in acquisto diretto.' : 'La carta entra subito nel catalogo e sarà messa all’asta nei nuovi eventi.'}</p>
    <label className="block mb-2">Titolo</label><input {...register('title')} className="input" placeholder="Es. Brindisi proibito" />{errors.title && <p className="profile-error">Inserisci almeno 3 caratteri.</p>}
    <label className="block mt-4 mb-2">Effetto / descrizione unica</label><textarea {...register('description')} className="input profile-textarea" placeholder="Es. Indovina chi farà il brindisi più imbarazzante della serata." />{errors.description && <p className="profile-error">Descrivi la carta con almeno 12 caratteri.</p>}
    <label className="block mt-4 mb-2">Prezzo in acquisto diretto</label><input {...register('directPrice', { valueAsNumber: true })} className="input" type="number" min="1" step="1" inputMode="numeric" />
    <p className="field-help">100 crediti è il prezzo base. Lo potrai modificare in seguito dalla sezione Carte; nelle aste conta invece l’offerta dei giocatori.</p>{errors.directPrice && <p className="profile-error">Inserisci un prezzo intero maggiore di zero.</p>}
    <ImageForge kind="CARD" imageUrl={watch('imageUrl')} onChange={(url, storagePath) => { setValue('imageUrl', url, { shouldValidate: true }); setValue('imageStoragePath', storagePath) }} />
    {errors.imageUrl && <p className="profile-error">Genera l’immagine unica della carta prima di pubblicarla.</p>}{error && <p className="profile-error">{error}</p>}
    <button className="btn mt-4" disabled={isSubmitting}>{isSubmitting ? 'Pubblicazione…' : dedicated ? 'Aggiungi al mercato evento' : 'Pubblica carta per tutti'}</button>
  </form>
}
