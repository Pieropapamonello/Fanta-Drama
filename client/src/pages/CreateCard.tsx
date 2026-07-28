import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import api from '../services/api'
import { useNavigate } from 'react-router-dom'
import ImageForge from '../components/ImageForge'

const schema = z.object({ title: z.string().min(1), description: z.string().optional(), basePoints: z.number().optional(), imageUrl: z.string().optional() })

export default function CreateCard() {
  const { register, handleSubmit, setValue, watch } = useForm({ resolver: zodResolver(schema) })
  const navigate = useNavigate(); const [error, setError] = useState('')
  const onSubmit = async (data: any) => { try { await api.post('/cards', data); navigate('/cards') } catch (err: any) { setError(err.response?.data?.error || 'Errore nella creazione della carta.') } }
  return <form onSubmit={handleSubmit(onSubmit)} className="max-w-md"><h2 className="text-2xl mb-4">Crea Carta</h2><label className="block mb-2">Titolo</label><input {...register('title')} className="input" /><label className="block mt-4 mb-2">Effetto / descrizione</label><input {...register('description')} className="input" /><label className="block mt-4 mb-2">Punti base</label><input type="number" {...register('basePoints', { valueAsNumber: true })} className="input" /><ImageForge kind="CARD" imageUrl={watch('imageUrl')} onChange={(url) => setValue('imageUrl', url)} />{error && <p className="profile-error">{error}</p>}<button className="btn mt-4">Crea carta</button></form>
}
