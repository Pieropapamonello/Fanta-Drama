import React, { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import api, { setAuthToken } from '../services/api'
import { firebaseAuth } from '../services/firebase'
import { signInWithCustomToken, signInWithEmailAndPassword } from 'firebase/auth'
import TelegramLoginButton from '../components/TelegramLoginButton'
import { LoginPasskeyButton } from '../components/PasskeyButton'

declare global {
  interface Window {
    Telegram?: { WebApp?: { initData: string, ready: () => void, expand: () => void } }
  }
}
import { Link, useNavigate } from 'react-router-dom'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
})

export default function Login() {
  const { register, handleSubmit } = useForm({ resolver: zodResolver(schema) })
  const navigate = useNavigate()
  const [telegramMessage, setTelegramMessage] = useState<string | null>(null)
  const afterLoginPath = () => { const target = sessionStorage.getItem('fd_after_login'); sessionStorage.removeItem('fd_after_login'); return target || '/dashboard' }
  const telegramAttempted = useRef(false)
  useEffect(() => {
    const completeMiniAppLogin = async () => {
      const webApp = window.Telegram?.WebApp
      if (!webApp?.initData) return
      if (telegramAttempted.current) return
      telegramAttempted.current = true
      setTelegramMessage('Accesso Telegram in corso…')
      webApp.ready()
      webApp.expand()
      try {
        const response = await api.post('/auth/telegram-miniapp', { initData: webApp.initData })
        const credential = await signInWithCustomToken(firebaseAuth, response.data.customToken)
        const token = await credential.user.getIdToken()
        localStorage.setItem('fd_token', token)
        setAuthToken(token)
        const bootstrap = await api.post('/auth/bootstrap', { username: response.data.username })
        navigate(bootstrap.data.user?.profileCompleted ? afterLoginPath() : '/profile/setup', { replace: true })
      } catch (error: any) {
        const detail = error.response?.data?.error
        setTelegramMessage(`Accesso Telegram non riuscito${detail ? `: ${detail}` : ''}. Chiudi e riapri la Mini App dal bot.`)
        telegramAttempted.current = false
      }
    }
    if (window.Telegram?.WebApp) {
      void completeMiniAppLogin()
      return
    }
    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-web-app.js?61'
    script.async = true
    script.onload = () => { void completeMiniAppLogin() }
    document.head.appendChild(script)
    return () => script.remove()
  }, [navigate])
  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get('telegram_error')
    if (reason === 'not_configured') setTelegramMessage('L’accesso Telegram è in fase di attivazione. Riprova tra poco.')
    else if (reason) setTelegramMessage('Accesso Telegram annullato o non riuscito. Riprova quando vuoi.')
  }, [])
  const onSubmit = async (data: any) => {
    try {
      const credential = await signInWithEmailAndPassword(firebaseAuth, data.email, data.password)
      const token = await credential.user.getIdToken()
      const bootstrap = await api.post('/auth/bootstrap')
      localStorage.setItem('fd_token', token)
      setAuthToken(token)
      navigate(bootstrap.data.user?.profileCompleted ? afterLoginPath() : '/profile/setup')
    } catch (err: any) {
      console.error(err)
      alert('Errore login')
    }
  }
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="auth-card max-w-md">
      <div className="auth-heading">
        <p className="eyebrow">FantaDrama</p>
        <h2>Entra nel caos</h2>
        <p>Usa il metodo che preferisci. Potrai collegare gli altri metodi dal profilo.</p>
      </div>

      <section className="auth-telegram" aria-label="Accesso Telegram">
        <div>
          <span>IL PIÙ VELOCE</span>
          <strong>Continua con Telegram</strong>
          <small>Nessuna email o password necessaria.</small>
        </div>
        <TelegramLoginButton label="Continua con Telegram" />
      </section>

      {telegramMessage && <p className="auth-status" role="status">{telegramMessage}</p>}

      <div className="auth-divider"><span>oppure usa email</span></div>

      <div className="auth-email-fields">
        <label htmlFor="login-email">Email</label>
        <input id="login-email" autoComplete="email" {...register('email')} className="input" />
        <label htmlFor="login-password">Password</label>
        <input id="login-password" autoComplete="current-password" type="password" {...register('password')} className="input" />
        <button className="btn auth-email-submit">Accedi con email</button>
      </div>

      <div className="auth-passkey">
        <p>Hai già attivato impronta o passkey?</p>
        <LoginPasskeyButton onSuccess={() => navigate('/dashboard', { replace: true })} />
      </div>

      <p className="auth-register">Non hai un account? <Link to="/register">Registrati</Link></p>
    </form>
  )
}
