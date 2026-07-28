import React, { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Check, MapPin, Sparkles } from 'lucide-react'
import api from '../services/api'
import { useNavigate } from 'react-router-dom'
import { EmailAuthProvider, linkWithCredential } from 'firebase/auth'
import { firebaseAuth } from '../services/firebase'
import { setAuthToken } from '../services/api'

const avatars = [
  { value: '/characters/pulse.png', title: 'On fire', note: 'Sempre al centro della scena' },
  { value: '/characters/mischief.png', title: 'Intrigo', note: 'Un piano per ogni colpo di scena' },
  { value: '/characters/shock.png', title: 'Plot twist', note: 'Imprevedibile fino all’ultimo' },
  { value: '/characters/calm.png', title: 'In controllo', note: 'Legge la stanza in silenzio' },
]

type ProfileForm = { username: string; avatar: string; bio?: string; city?: string; crewRole?: string; motto?: string; notificationPreference?: 'TELEGRAM' | 'EMAIL' | 'BOTH' }

export default function ProfileSetup() {
  const navigate = useNavigate()
  const { register, handleSubmit, reset, setValue, watch } = useForm<ProfileForm>({ defaultValues: { avatar: avatars[0].value, crewRole: 'Jolly', notificationPreference: 'BOTH' } })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [profile, setProfile] = useState<any>(null)
  const [email, setEmail] = useState('')
  const [emailPassword, setEmailPassword] = useState('')
  const [contactMessage, setContactMessage] = useState('')
  const [isLinkingEmail, setIsLinkingEmail] = useState(false)
  const avatar = watch('avatar')
  const notificationPreference = watch('notificationPreference')

  const loadProfile = async () => {
    try {
      const response = await api.get('/profile/me')
      const user = response.data.user
      setProfile(user)
      reset({ username: user.username || '', avatar: avatars.some((item) => item.value === user.avatar) ? user.avatar : avatars[0].value, bio: user.bio || '', city: user.city || '', crewRole: user.crewRole || 'Jolly', motto: user.motto || '', notificationPreference: user.notificationPreference || 'BOTH' })
    } catch { setError('Non riesco a recuperare il profilo. Riprova.') }
  }

  useEffect(() => {
    void loadProfile().finally(() => setIsLoading(false))
  }, [reset])

  const connectEmail = async () => {
    if (!email || emailPassword.length < 8) { setContactMessage('Inserisci un’e-mail valida e una password di almeno 8 caratteri.'); return }
    const currentUser = firebaseAuth.currentUser
    if (!currentUser) { setContactMessage('Sessione scaduta: rientra nell’app e riprova.'); return }
    setIsLinkingEmail(true); setContactMessage('')
    try {
      const credential = await linkWithCredential(currentUser, EmailAuthProvider.credential(email, emailPassword))
      const token = await credential.user.getIdToken(true)
      localStorage.setItem('fd_token', token); setAuthToken(token)
      await loadProfile(); setEmail(''); setEmailPassword(''); setContactMessage('E-mail collegata correttamente.')
    } catch (err: any) {
      setContactMessage(err.code === 'auth/email-already-in-use' ? 'Questa e-mail appartiene già a un altro account.' : 'Non riesco a collegare l’e-mail. Controlla i dati e riprova.')
    } finally { setIsLinkingEmail(false) }
  }

  const connectTelegram = async () => {
    setContactMessage('')
    try {
      const response = await api.post('/profile/telegram-link')
      const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME
      if (!botUsername) throw new Error('bot_missing')
      setContactMessage('Apro il bot Telegram: premi Avvia per confermare il collegamento.')
      window.location.assign(`https://t.me/${botUsername}?start=link_${response.data.code}`)
    } catch { setContactMessage('Non riesco a generare il collegamento Telegram. Riprova.') }
  }

  const onSubmit = async (data: ProfileForm) => {
    setIsSaving(true); setError('')
    try {
      await api.put('/profile/me', data)
      navigate('/dashboard', { replace: true })
    } catch (err: any) {
      setError(err.response?.data?.error === 'username_taken' ? 'Questo nickname è già usato: scegline un altro.' : 'Non riesco a salvare il profilo. Riprova.')
    } finally { setIsSaving(false) }
  }

  if (isLoading) return <div className="empty-state">Sto preparando il tuo profilo…</div>
  return <form className="profile-setup" onSubmit={handleSubmit(onSubmit)}>
    <div className="profile-setup-copy"><p className="eyebrow">Il tuo alter ego</p><h2>Crea il tuo personaggio</h2><p>Queste informazioni saranno visibili solo nella tua esperienza FantaDrama. Puoi modificarle quando vuoi.</p></div>
    <section><div className="profile-section-title"><Sparkles size={17} /><div><strong>Scegli il tuo avatar</strong><span>Il tuo mood nella drama room</span></div></div><div className="avatar-picker">
      {avatars.map((item) => <button type="button" key={item.value} className={`avatar-choice ${avatar === item.value ? 'is-selected' : ''}`} onClick={() => setValue('avatar', item.value, { shouldValidate: true })}>
        <img src={item.value} alt="" /><span><b>{item.title}</b><small>{item.note}</small></span>{avatar === item.value && <i><Check size={13} /></i>}
      </button>)}
    </div></section>
    <section className="profile-fields"><label>Nickname in app<input className="input" {...register('username', { required: true, minLength: 3, maxLength: 30 })} placeholder="Come ti chiama la crew?" /></label><label>Ruolo nella crew<select className="input" {...register('crewRole')}><option>Jolly</option><option>Stratega</option><option>Creatore di caos</option><option>Osservatore</option><option>Regista del drama</option></select></label><label>Bio <small>opzionale</small><textarea className="input profile-textarea" {...register('bio', { maxLength: 160 })} maxLength={160} placeholder="Una frase che racconta il tuo stile…" /></label><label><MapPin size={14} /> Città <small>opzionale</small><input className="input" {...register('city', { maxLength: 48 })} maxLength={48} placeholder="Es. Roma" /></label><label className="profile-motto">Il tuo motto <small>opzionale</small><input className="input" {...register('motto', { maxLength: 90 })} maxLength={90} placeholder="Es. Il drama mi trova sempre." /></label></section>
    <section className="connection-section"><div className="profile-section-title"><Sparkles size={17} /><div><strong>Account e notifiche</strong><span>Collega i canali che vuoi usare</span></div></div><div className="connection-grid">
      <div className={`connection-card ${profile?.connections?.email ? 'is-connected' : ''}`}><b>✉ E-mail</b>{profile?.connections?.email ? <><span>{profile.email}</span><small>Collegata</small></> : <><input className="input" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nome@email.it" type="email" /><input className="input" value={emailPassword} onChange={(event) => setEmailPassword(event.target.value)} placeholder="Crea una password" type="password" /><button type="button" className="btn btn-ghost" onClick={connectEmail} disabled={isLinkingEmail}>{isLinkingEmail ? 'Collegamento…' : 'Collega e-mail'}</button></>}</div>
      <div className={`connection-card ${profile?.connections?.telegram ? 'is-connected' : ''}`}><b>✈ Telegram</b>{profile?.connections?.telegram ? <><span>@{profile.username || 'FantaDrama'}</span><small>Collegato</small></> : <><span>Ricevi gli aggiornamenti direttamente dal bot.</span><button type="button" className="btn btn-ghost" onClick={connectTelegram}>Collega Telegram</button></>}</div>
    </div><div className="notification-choice"><strong>Dove vuoi ricevere le notifiche?</strong><div><button type="button" className={notificationPreference === 'TELEGRAM' ? 'is-selected' : ''} onClick={() => setValue('notificationPreference', 'TELEGRAM')} disabled={!profile?.connections?.telegram}>Solo Telegram</button><button type="button" className={notificationPreference === 'EMAIL' ? 'is-selected' : ''} onClick={() => setValue('notificationPreference', 'EMAIL')} disabled={!profile?.connections?.email}>Solo e-mail</button><button type="button" className={notificationPreference === 'BOTH' ? 'is-selected' : ''} onClick={() => setValue('notificationPreference', 'BOTH')} disabled={!profile?.connections?.email && !profile?.connections?.telegram}>Entrambi</button></div></div>{contactMessage && <p className="contact-message" role="status">{contactMessage}</p>}</section>
    {error && <p className="profile-error" role="alert">{error}</p>}
    <button className="btn profile-save" disabled={isSaving}>{isSaving ? 'Salvataggio in corso…' : 'Entra nella drama room'}</button>
  </form>
}
