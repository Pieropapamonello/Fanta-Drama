import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import api from '../services/api'
import { useNavigate } from 'react-router-dom'

const schema = z.object({ title: z.string().min(1), description: z.string().optional(), startsAt: z.string(), endsAt: z.string(), groupId: z.string() })

export default function CreateEvent() {
  const { register, handleSubmit } = useForm({ resolver: zodResolver(schema) })
  const navigate = useNavigate()
  const onSubmit = async (data: any) => {
    try { await api.post('/events', data); navigate('/events') } catch (err) { alert('Errore') }
  }
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-md">
      <h2 className="text-2xl mb-4">Crea Evento</h2>
      <label className="block mb-2">Titolo</label>
      <input {...register('title')} className="input" />
      <label className="block mt-4 mb-2">Descrizione</label>
      <input {...register('description')} className="input" />
      <label className="block mt-4 mb-2">Inizio (ISO)</label>
      <input {...register('startsAt')} className="input" />
      <label className="block mt-4 mb-2">Fine (ISO)</label>
      <input {...register('endsAt')} className="input" />
      <label className="block mt-4 mb-2">GroupId</label>
      <input {...register('groupId')} className="input" />
      <button className="btn mt-4">Crea</button>
    </form>
  )
}
