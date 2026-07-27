import React from 'react'
import { useForm } from 'react-hook-form'
import api from '../services/api'

export default function PredictionForm({ eventId }: { eventId: string }) {
  const { register, handleSubmit } = useForm()
  const onSubmit = async (data: any) => {
    try {
      await api.post('/predictions', { eventId, cardId: data.cardId, value: data.value, credits: Number(data.credits) })
      alert('Pronostico inviato')
    } catch (err) { alert('Errore') }
  }
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-md">
      <label className="block mb-2">CardId (per MVP)</label>
      <input {...register('cardId')} className="input" />
      <label className="block mb-2 mt-4">Risposta</label>
      <input {...register('value')} className="input" />
      <label className="block mb-2 mt-4">Crediti</label>
      <input type="number" {...register('credits')} className="input" />
      <button className="btn mt-4">Invia pronostico</button>
    </form>
  )
}
