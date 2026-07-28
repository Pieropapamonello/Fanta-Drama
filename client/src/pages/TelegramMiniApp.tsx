import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signInWithCustomToken } from 'firebase/auth'
import api, { setAuthToken } from '../services/api'
import { firebaseAuth } from '../services/firebase'

declare global {
  interface Window {
    Telegram?: { WebApp?: { initData: string, ready: () => void, expand: () => void } }
  }
}

export default function TelegramMiniApp() {
  const navigate = useNavigate()
  const [message, setMessage] = useState('Connessione sicura a Telegram…')
  const attempted = useRef(false)

  useEffect(() => {
    const completeLogin = async () => {
      if (attempted.current) return
      const webApp = window.Telegram?.WebApp
      if (!webApp?.initData) {
        setMessage('Apri FantaDrama dal pulsante “Apri FantaDrama” nel bot Telegram.')
        return
      }
      attempted.current = true
      webApp.ready()
      webApp.expand()
      try {
        const response = await api.post('/auth/telegram-miniapp', { initData: webApp.initData })
        const credential = await signInWithCustomToken(firebaseAuth, response.data.customToken)
        const token = await credential.user.getIdToken()
        localStorage.setItem('fd_token', token)
        setAuthToken(token)
        const bootstrap = await api.post('/auth/bootstrap', { username: response.data.username })
        navigate(bootstrap.data.user?.profileCompleted ? '/dashboard' : '/profile/setup', { replace: true })
      } catch (error: any) {
        attempted.current = false
        const code = error.response?.data?.error
        setMessage(code === 'invalid_telegram_miniapp'
          ? 'La verifica Telegram non è riuscita. Chiudi questa schermata e riapri FantaDrama dal bot.'
          : 'Non riesco a completare l’accesso. Riprova tra qualche secondo dal pulsante del bot.')
      }
    }

    if (window.Telegram?.WebApp) {
      void completeLogin()
      return
    }
    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-web-app.js?61'
    script.async = true
    script.onload = () => { void completeLogin() }
    document.head.appendChild(script)
    return () => script.remove()
  }, [navigate])

  return <div className="telegram-gate"><span className="telegram-gate-orb" aria-hidden="true" /><p>{message}</p></div>
}
