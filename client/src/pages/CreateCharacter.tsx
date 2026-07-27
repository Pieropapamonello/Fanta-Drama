import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import api from '../services/api'
import { useNavigate } from 'react-router-dom'

const schema = z.object({ name: z.string().min(1), nickname: z.string().optional(), groupId: z.string() })

export default function CreateCharacter() {
  const { register, handleSubmit } = useForm({ resolver: zodResolver(schema) })
  const navigate = useNavigate()
  const onSubmit = async (data: any) => {
    try {
      await api.post('/characters', data)
      navigate('/groups')
    } catch (err) { alert('Errore') }
  }
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-md">
      <h2 className="text-2xl mb-4">Crea personaggio</h2>
      <label className="block mb-2">Nome</label>
      <input {...register('name')} className="input" />
      <label className="block mt-4 mb-2">Nickname</label>
      <input {...register('nickname')} className="input" />
      <label className="block mt-4 mb-2">GroupId</label>
      <input {...register('groupId')} className="input" />
      <button className="btn mt-4">Crea</button>
    </form>
  )
}
