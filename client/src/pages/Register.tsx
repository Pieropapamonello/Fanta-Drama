import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import api, { setAuthToken } from '../services/api'
import { firebaseAuth } from '../services/firebase'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import TelegramLoginButton from '../components/TelegramLoginButton'
import { useNavigate } from 'react-router-dom'

const schema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(8),
  confirm: z.string().min(8)
}).refine((d) => d.password === d.confirm, { message: "Le password non corrispondono", path: ['confirm'] })

export default function Register() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) })
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const onSubmit = async (data: any) => {
    setError('')
    try {
      const credential = await createUserWithEmailAndPassword(firebaseAuth, data.email.trim(), data.password)
      const token = await credential.user.getIdToken(true)
      localStorage.setItem('fd_token', token)
      setAuthToken(token)
      const bootstrap = await api.post('/auth/bootstrap', { username: data.username })
      navigate(bootstrap.data.user?.profileCompleted ? '/dashboard' : '/profile/setup')
    } catch (err: any) {
      console.error(err)
      setError(err.code === 'auth/email-already-in-use' ? 'Questa email è già registrata. Prova ad accedere.' : 'Non riesco a creare l’account. Controlla i dati e riprova.')
    }
  }
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-md">
      <h2 className="text-2xl mb-4">Registrati</h2>
      <label className="block mb-2">Username</label>
      <input {...register('username')} className="input" autoComplete="username" />
      {errors.username && <p className="profile-error">Inserisci almeno 3 caratteri.</p>}
      <label className="block mb-2 mt-4">Email</label>
      <input type="email" autoComplete="email" {...register('email')} className="input" />
      {errors.email && <p className="profile-error">Inserisci un indirizzo email valido.</p>}
      <label className="block mb-2 mt-4">Password</label>
      <input type="password" autoComplete="new-password" {...register('password')} className="input" />
      {errors.password && <p className="profile-error">La password deve avere almeno 8 caratteri.</p>}
      <label className="block mb-2 mt-4">Conferma Password</label>
      <input type="password" autoComplete="new-password" {...register('confirm')} className="input" />
      {errors.confirm && <p className="profile-error">Le password non corrispondono.</p>}
      {error && <p className="profile-error" role="alert">{error}</p>}
      <button className="btn mt-4" disabled={isSubmitting}>{isSubmitting ? 'Creazione account…' : 'Crea account'}</button>
      <div className="mt-6 border-t pt-4 text-center text-sm text-slate-600">oppure registrati senza email</div>
      <TelegramLoginButton label="Registrati con Telegram" />
    </form>
  )
}
