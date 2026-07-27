import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import api, { setAuthToken } from '../services/api'
import { useNavigate } from 'react-router-dom'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
})

export default function Login() {
  const { register, handleSubmit } = useForm({ resolver: zodResolver(schema) })
  const navigate = useNavigate()
  const onSubmit = async (data: any) => {
    try {
      const res = await api.post('/auth/login', data)
      const token = res.data.token
      localStorage.setItem('fd_token', token)
      setAuthToken(token)
      navigate('/dashboard')
    } catch (err: any) {
      console.error(err)
      alert('Errore login')
    }
  }
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-md">
      <h2 className="text-2xl mb-4">Accedi</h2>
      <label className="block mb-2">Email</label>
      <input {...register('email')} className="input" />
      <label className="block mt-4 mb-2">Password</label>
      <input type="password" {...register('password')} className="input" />
      <button className="btn mt-4">Accedi</button>
    </form>
  )
}
