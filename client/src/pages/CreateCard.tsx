import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import api from '../services/api'
import { useNavigate } from 'react-router-dom'
import ImageForge from '../components/ImageForge'

const schema = z.object({ title: z.string().trim().min(3), description: z.string().trim().min(12), imageUrl: z.string().url(), imageStoragePath: z.string().optional() })
export default function CreateCard() {
  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) })
  const navigate = useNavigate(); const [error, setError] = useState('')
  const onSubmit = async (data: any) => { try { await api.post('/cards', data); navigate('/cards') } catch (err: any) { setError(err.response?.data?.error || 'Errore nella creazione della carta.') } }
  return <form onSubmit={handleSubmit(onSubmit)} className="max-w-md"><p className="eyebrow">Collezione condivisa</p><h2 className="text-2xl mb-4">Crea una carta unica</h2><p className="page-lead">La carta entra subito nel catalogo e sarà messa all’asta nei nuovi eventi. Mantienila originale e adatta alla crew.</p><label className="block mb-2">Titolo</label><input {...register('title')} className="input" placeholder="Es. Brindisi proibito" />{errors.title && <p className="profile-error">Inserisci almeno 3 caratteri.</p>}<label className="block mt-4 mb-2">Effetto / descrizione unica</label><textarea {...register('description')} className="input profile-textarea" placeholder="Es. Indovina chi farà il brindisi più imbarazzante della serata." />{errors.description && <p className="profile-error">Descrivi la carta con almeno 12 caratteri.</p>}<ImageForge kind="CARD" imageUrl={watch('imageUrl')} onChange={(url, storagePath) => { setValue('imageUrl', url, { shouldValidate: true }); setValue('imageStoragePath', storagePath) }} />{errors.imageUrl && <p className="profile-error">Genera l’immagine unica della carta prima di pubblicarla.</p>}{error && <p className="profile-error">{error}</p>}<button className="btn mt-4" disabled={isSubmitting}>{isSubmitting ? 'Pubblicazione…' : 'Pubblica carta per tutti'}</button></form>
}
