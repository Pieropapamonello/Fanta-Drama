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

function emailLoginErrorMessage(error: any) {
  const code = String(error?.code ?? error?.response?.data?.error ?? '')
  if (['auth/invalid-credential', 'auth/invalid-login-credentials', 'auth/wrong-password', 'auth/user-not-found'].includes(code)) return 'E-mail o password non corretti. Controlla di usare lo stesso metodo con cui ti sei registrato.'
  if (code === 'auth/too-many-requests') return 'Troppi tentativi ravvicinati. Attendi qualche minuto, poi riprova oppure reimposta la password da Firebase.'
  if (code === 'auth/network-request-failed') return 'Non riesco a raggiungere Firebase. Controlla la connessione e riprova.'
  if (code === 'auth/operation-not-allowed') return 'L’accesso e-mail non è attivo nel progetto Firebase. Va abilitato in Authentication → Sign-in method.'
  if (code === 'missing_token' || code === 'invalid_token') return 'L’accesso è riuscito, ma il token non è stato accettato dal server. Riprova una volta: ora l’app lo salva prima di aprire il profilo.'
  return 'L’accesso non è stato completato. Riprova tra poco.'
}

export default function Login() {
  const { register, handleSubmit } = useForm({ resolver: zodResolver(schema) })
  const navigate = useNavigate()
  const [telegramMessage, setTelegramMessage] = useState<string | null>(null)
  const [emailMessage, setEmailMessage] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)
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
    if (emailLoading) return
    setEmailLoading(true); setEmailMessage('')
    try {
      const credential = await signInWithEmailAndPassword(firebaseAuth, data.email.trim(), data.password)
      const token = await credential.user.getIdToken(true)
      localStorage.setItem('fd_token', token)
      setAuthToken(token)
      const bootstrap = await api.post('/auth/bootstrap')
      navigate(bootstrap.data.user?.profileCompleted ? afterLoginPath() : '/profile/setup')
    } catch (err: any) {
      console.error(err)
      setEmailMessage(emailLoginErrorMessage(err))
    } finally { setEmailLoading(false) }
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
        {emailMessage && <p className="auth-status" role="alert">{emailMessage}</p>}
        <button className="btn auth-email-submit" disabled={emailLoading}>{emailLoading ? 'Accesso…' : 'Accedi con email'}</button>
      </div>

      <div className="auth-passkey">
        <p>Hai già attivato impronta o passkey?</p>
        <LoginPasskeyButton onSuccess={() => navigate('/dashboard', { replace: true })} />
      </div>

      <p className="auth-register">Non hai un account? <Link to="/register">Registrati</Link></p>
    </form>
  )
}
