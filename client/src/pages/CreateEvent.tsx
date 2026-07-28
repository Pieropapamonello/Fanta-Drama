import React, { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import api from '../services/api'
import { useNavigate } from 'react-router-dom'
import ImageForge from '../components/ImageForge'

const schema = z.object({ title: z.string().min(1), description: z.string().optional(), startsAt: z.string(), endsAt: z.string(), groupId: z.string(), imageUrl: z.string().optional() })

export default function CreateEvent() {
  const { register, handleSubmit, setValue, watch } = useForm({ resolver: zodResolver(schema) }); const navigate = useNavigate(); const [groups, setGroups] = useState<any[]>([]); const [error, setError] = useState<string | null>(null)
  useEffect(() => { api.get('/groups').then((res) => setGroups(res.data.groups)).catch(() => setError('Non riesco a caricare i gruppi.')) }, [])
  const onSubmit = async (data: any) => { try { setError(null); await api.post('/events', { ...data, startsAt: new Date(data.startsAt).toISOString(), endsAt: new Date(data.endsAt).toISOString() }); navigate('/events') } catch (err: any) { setError(err.response?.data?.error || 'Non riesco a creare l’evento.') } }
  return <form onSubmit={handleSubmit(onSubmit)} className="max-w-md"><h2 className="text-2xl mb-4">Crea Evento</h2><label className="block mb-2">Titolo</label><input {...register('title')} className="input" /><label className="block mt-4 mb-2">Descrizione</label><input {...register('description')} className="input" /><label className="block mt-4 mb-2">Inizio</label><input type="datetime-local" {...register('startsAt')} className="input" /><label className="block mt-4 mb-2">Fine</label><input type="datetime-local" {...register('endsAt')} className="input" /><label className="block mt-4 mb-2">Gruppo</label><select {...register('groupId')} className="input" defaultValue=""><option value="" disabled>Seleziona il gruppo</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select><ImageForge kind="EVENT" imageUrl={watch('imageUrl')} onChange={(url) => setValue('imageUrl', url)} />{error && <p className="profile-error">{error}</p>}<button className="btn mt-4">Crea evento</button></form>
}
