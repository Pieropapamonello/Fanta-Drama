import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import api, { setAuthToken } from '../services/api'
import { firebaseAuth } from '../services/firebase'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'

const schema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(8),
  confirm: z.string().min(8)
}).refine((d) => d.password === d.confirm, { message: "Le password non corrispondono", path: ['confirm'] })

export default function Register() {
  const { register, handleSubmit } = useForm({ resolver: zodResolver(schema) })
  const navigate = useNavigate()
  const onSubmit = async (data: any) => {
    try {
      const credential = await createUserWithEmailAndPassword(firebaseAuth, data.email, data.password)
      const token = await credential.user.getIdToken()
      await api.post('/auth/bootstrap', { username: data.username })
      localStorage.setItem('fd_token', token)
      setAuthToken(token)
      navigate('/dashboard')
    } catch (err) {
      console.error(err)
      alert('Errore registrazione')
    }
  }
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-md">
      <h2 className="text-2xl mb-4">Registrati</h2>
      <label className="block mb-2">Username</label>
      <input {...register('username')} className="input" />
      <label className="block mb-2 mt-4">Email</label>
      <input {...register('email')} className="input" />
      <label className="block mb-2 mt-4">Password</label>
      <input type="password" {...register('password')} className="input" />
      <label className="block mb-2 mt-4">Conferma Password</label>
      <input type="password" {...register('confirm')} className="input" />
      <button className="btn mt-4">Crea account</button>
    </form>
  )
}
