import { useEffect, useState } from 'react'
import { BellRing, Send } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import api from '../services/api'
import { enableDeviceNotifications } from '../services/push'

type Step = 'hidden' | 'ask-device' | 'suggest-telegram'

export default function LoginNotificationPrompt({ loggedIn }: { loggedIn: boolean }) {
  const location = useLocation(); const navigate = useNavigate()
  const [step, setStep] = useState<Step>('hidden')
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!loggedIn || location.pathname === '/profile/setup' || sessionStorage.getItem('fd_login_notification_prompt') === 'seen') return
    let active = true
    void api.get('/profile/me').then((response) => {
      if (!active || !response.data.user?.profileCompleted) return
      const telegramLinked = Boolean(response.data.user?.connections?.telegram)
      if (!('Notification' in window) || Notification.permission === 'granted') return
      setStep(telegramLinked ? 'ask-device' : Notification.permission === 'denied' ? 'suggest-telegram' : 'ask-device')
    }).catch(() => undefined)
    return () => { active = false }
  }, [loggedIn, location.pathname])

  const dismiss = () => { sessionStorage.setItem('fd_login_notification_prompt', 'seen'); setStep('hidden') }
  const enable = async () => {
    setWorking(true); setMessage('')
    try {
      const result = await enableDeviceNotifications()
      if (result.ok) { dismiss(); return }
      setMessage(result.message); setStep('suggest-telegram')
    } finally { setWorking(false) }
  }
  if (step === 'hidden') return null
  return <div className="login-notification-backdrop" role="presentation"><section className="login-notification-prompt" role="dialog" aria-modal="true" aria-labelledby="notification-login-title"><BellRing size={28} /><p className="eyebrow">Non perdere il drama</p><h2 id="notification-login-title">{step === 'ask-device' ? 'Attiva gli avvisi sul telefono' : 'Resta nel live della crew'}</h2>{step === 'ask-device' ? <p>Ti avviseremo subito per offerte, carte giocate e decisioni della crew, anche con FantaDrama chiusa.</p> : <p>{message || 'Senza avvisi sul telefono è più difficile seguire aste e conferme in tempo reale. Collega Telegram: il bot ti avviserà subito.'}</p>}<div className="login-notification-actions">{step === 'ask-device' ? <><button type="button" className="btn" onClick={() => void enable()} disabled={working}>{working ? 'Attivazione…' : 'Attiva avvisi'}</button><button type="button" className="btn btn-ghost" onClick={() => setStep('suggest-telegram')}>Non ora</button></> : <><button type="button" className="btn" onClick={() => { dismiss(); navigate('/profile/setup?connect=telegram') }}><Send size={16} /> Collega Telegram</button><button type="button" className="btn btn-ghost" onClick={dismiss}>Continua senza avvisi</button></>}</div></section></div>
}
