import React, { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Check, MapPin, Sparkles } from 'lucide-react'
import api from '../services/api'
import { useNavigate } from 'react-router-dom'

const avatars = [
  { value: '/characters/pulse.png', title: 'On fire', note: 'Sempre al centro della scena' },
  { value: '/characters/mischief.png', title: 'Intrigo', note: 'Un piano per ogni colpo di scena' },
  { value: '/characters/shock.png', title: 'Plot twist', note: 'Imprevedibile fino all’ultimo' },
  { value: '/characters/calm.png', title: 'In controllo', note: 'Legge la stanza in silenzio' },
]

type ProfileForm = { username: string; avatar: string; bio?: string; city?: string; crewRole?: string; motto?: string }

export default function ProfileSetup() {
  const navigate = useNavigate()
  const { register, handleSubmit, reset, setValue, watch } = useForm<ProfileForm>({ defaultValues: { avatar: avatars[0].value, crewRole: 'Jolly' } })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const avatar = watch('avatar')

  useEffect(() => {
    api.get('/profile/me').then((response) => {
      const user = response.data.user
      reset({ username: user.username || '', avatar: avatars.some((item) => item.value === user.avatar) ? user.avatar : avatars[0].value, bio: user.bio || '', city: user.city || '', crewRole: user.crewRole || 'Jolly', motto: user.motto || '' })
    }).catch(() => setError('Non riesco a recuperare il profilo. Riprova.')).finally(() => setIsLoading(false))
  }, [reset])

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
    {error && <p className="profile-error" role="alert">{error}</p>}
    <button className="btn profile-save" disabled={isSaving}>{isSaving ? 'Salvataggio in corso…' : 'Entra nella drama room'}</button>
  </form>
}
