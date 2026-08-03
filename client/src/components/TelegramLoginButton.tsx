import React, { useEffect, useRef, useState } from 'react'
import { signInWithCustomToken } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import api, { setAuthToken } from '../services/api'
import { firebaseAuth } from '../services/firebase'

export default function TelegramLoginButton({ label = 'Continua con Telegram — senza email' }: { label?: string }) {
  const navigate = useNavigate()
  const [message, setMessage] = useState('')
  const completing = useRef(false)

  useEffect(() => {
    const complete = async (ticket: string) => {
      if (completing.current) return
      completing.current = true
      setMessage('Completo l’accesso…')
      try {
        const response = await api.post('/auth/telegram/complete', { ticket })
        const credential = await signInWithCustomToken(firebaseAuth, response.data.customToken)
        const token = await credential.user.getIdToken()
        localStorage.setItem('fd_token', token)
        setAuthToken(token)
        const bootstrap = await api.post('/auth/bootstrap', { username: response.data.username })
        const requested = sessionStorage.getItem('fd_after_login')
        sessionStorage.removeItem('fd_after_login')
        navigate(bootstrap.data.user?.profileCompleted ? requested || '/dashboard' : '/profile/setup', { replace: true })
      } catch {
        completing.current = false
        setMessage('Non riesco a completare l’accesso Telegram. Riprova.')
      }
    }
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.data?.type !== 'fd:telegram-login-ticket' || typeof event.data.ticket !== 'string') return
      void complete(event.data.ticket)
    }
    window.addEventListener('message', receive)
    return () => window.removeEventListener('message', receive)
  }, [navigate])

  const openTelegram = () => {
    setMessage('Conferma in Telegram: al termine tornerai qui automaticamente.')
    const popup = window.open('/api/auth/telegram/oidc/start?popup=1', 'fantadrama-telegram-login', 'popup,width=520,height=760')
    if (!popup) window.location.assign('/api/auth/telegram/oidc/start')
  }

  return <div className="telegram-login-action"><button type="button" onClick={openTelegram} className="btn telegram-login-button inline-flex w-full justify-center" disabled={completing.current}>{label}</button>{message && <small role="status">{message}</small>}</div>
}
