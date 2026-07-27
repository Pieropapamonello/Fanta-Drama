import React, { useEffect, useState } from 'react'
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

  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-web-app.js?61'
    script.async = true
    script.onload = async () => {
      try {
        const webApp = window.Telegram?.WebApp
        if (!webApp?.initData) throw new Error('Apri FantaDrama dal bot Telegram')
        webApp.ready()
        webApp.expand()
        const response = await api.post('/auth/telegram-miniapp', { initData: webApp.initData })
        const credential = await signInWithCustomToken(firebaseAuth, response.data.customToken)
        const token = await credential.user.getIdToken()
        localStorage.setItem('fd_token', token)
        setAuthToken(token)
        await api.post('/auth/bootstrap', { username: response.data.username })
        navigate('/dashboard', { replace: true })
      } catch (error: any) {
        setMessage(error.message || 'Impossibile accedere tramite Telegram.')
      }
    }
    document.head.appendChild(script)
    return () => script.remove()
  }, [navigate])

  return <p className="py-10 text-center">{message}</p>
}
