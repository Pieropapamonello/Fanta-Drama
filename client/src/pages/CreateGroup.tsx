import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import api from '../services/api'
import { useNavigate } from 'react-router-dom'

const schema = z.object({ name: z.string().min(1), description: z.string().optional() })

export default function CreateGroup() {
  const { register, handleSubmit } = useForm({ resolver: zodResolver(schema) })
  const navigate = useNavigate()
  const onSubmit = async (data: any) => {
    try {
      const res = await api.post('/groups', data)
      navigate('/groups')
    } catch (err) { alert('Errore') }
  }
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-md">
      <h2 className="text-2xl mb-4">Crea gruppo</h2>
      <label className="block mb-2">Nome</label>
      <input {...register('name')} className="input" />
      <label className="block mt-4 mb-2">Descrizione</label>
      <input {...register('description')} className="input" />
      <button className="btn mt-4">Crea</button>
    </form>
  )
}
