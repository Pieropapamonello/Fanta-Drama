import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signInWithCustomToken } from 'firebase/auth'
import api, { setAuthToken } from '../services/api'
import { firebaseAuth } from '../services/firebase'

export default function TelegramLogin() {
  const navigate = useNavigate()
  const [message, setMessage] = useState('Verifica dell’accesso Telegram…')

  useEffect(() => {
    const completeLogin = async () => {
      const payload = Object.fromEntries(new URLSearchParams(window.location.search).entries())
      const response = payload.ticket
        ? await api.post('/auth/telegram/complete', { ticket: payload.ticket })
        : await api.post('/auth/telegram', payload)
      const credential = await signInWithCustomToken(firebaseAuth, response.data.customToken)
      const token = await credential.user.getIdToken()
      localStorage.setItem('fd_token', token)
      setAuthToken(token)
      const bootstrap = await api.post('/auth/bootstrap', { username: response.data.username })
      navigate(bootstrap.data.user?.profileCompleted ? '/dashboard' : '/profile/setup', { replace: true })
    }
    completeLogin().catch(() => setMessage('Accesso Telegram non riuscito. Torna al login e riprova.'))
  }, [navigate])

  return <p className="py-8 text-center">{message}</p>
}
