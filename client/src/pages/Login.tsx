import React, { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import api, { setAuthToken } from '../services/api'
import { firebaseAuth } from '../services/firebase'
import { signInWithCustomToken, signInWithEmailAndPassword } from 'firebase/auth'
import TelegramLoginButton from '../components/TelegramLoginButton'

declare global {
  interface Window {
    Telegram?: { WebApp?: { initData: string, ready: () => void, expand: () => void } }
  }
}
import { useNavigate } from 'react-router-dom'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
})

export default function Login() {
  const { register, handleSubmit } = useForm({ resolver: zodResolver(schema) })
  const navigate = useNavigate()
  useEffect(() => {
    const completeMiniAppLogin = async () => {
      const webApp = window.Telegram?.WebApp
      if (!webApp?.initData) return
      webApp.ready()
      webApp.expand()
      const response = await api.post('/auth/telegram-miniapp', { initData: webApp.initData })
      const credential = await signInWithCustomToken(firebaseAuth, response.data.customToken)
      const token = await credential.user.getIdToken()
      localStorage.setItem('fd_token', token)
      setAuthToken(token)
      await api.post('/auth/bootstrap', { username: response.data.username })
      navigate('/dashboard', { replace: true })
    }
    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-web-app.js?61'
    script.async = true
    script.onload = () => { completeMiniAppLogin().catch((error) => console.error('Telegram Mini App login failed', error)) }
    document.head.appendChild(script)
    return () => script.remove()
  }, [navigate])
  const onSubmit = async (data: any) => {
    try {
      const credential = await signInWithEmailAndPassword(firebaseAuth, data.email, data.password)
      const token = await credential.user.getIdToken()
      await api.post('/auth/bootstrap')
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
      <div className="mt-6 border-t pt-4 text-center text-sm text-slate-600">oppure accedi senza email</div>
      <TelegramLoginButton label="Accedi o registrati con Telegram" />
    </form>
  )
}
