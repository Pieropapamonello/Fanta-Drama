import React, { useEffect, useState } from 'react'
import { BellRing, CalendarDays, Check, ChevronLeft, ChevronRight, Gavel, Layers, Sparkles, Users, X } from 'lucide-react'
import api from '../services/api'

type TutorialManagerProps = { loggedIn: boolean }

const steps = [
  {
    eyebrow: 'Benvenuto nella drama room',
    title: 'La partita vive con la tua crew',
    copy: 'Crea un gruppo o entra con un codice invito. Nella stanza trovi partecipanti, eventi, chat e profili.',
    icon: Users,
    visual: <div className="tutorial-crew-visual"><span>D</span><span>C</span><span>H</span><i>+3 amici</i></div>,
    hint: 'Inizia da Crew nella barra in basso.'
  },
  {
    eyebrow: 'Prima dell’evento',
    title: 'Compra le carte con i crediti',
    copy: 'Apri un evento, scegli una carta e fai un’offerta. Nelle aste puoi rilanciare fino alla scadenza; nell’acquisto diretto la prendi subito.',
    icon: Gavel,
    visual: <div className="tutorial-card-visual"><Sparkles /><strong>Plot twist</strong><small>Offerta attuale</small><b>120 crediti</b></div>,
    hint: 'I crediti sono virtuali e ogni carta vale solo per il suo evento.'
  },
  {
    eyebrow: 'Durante il live',
    title: 'Gioca la carta quando accade',
    copy: 'Segnala l’avvenimento dalla pagina dell’evento. Due persone della crew lo confermano; in caso di dubbio puoi chiedere il giudizio admin.',
    icon: CalendarDays,
    visual: <div className="tutorial-vote-visual"><span><Check /> Confermo</span><span>2 verifiche</span></div>,
    hint: 'Le conferme aggiornano automaticamente risultati e crediti.'
  },
  {
    eyebrow: 'Non perdere un rilancio',
    title: 'Scegli dove ricevere gli avvisi',
    copy: 'Nel Profilo puoi attivare notifiche sul telefono, Telegram ed e-mail, anche contemporaneamente.',
    icon: BellRing,
    visual: <div className="tutorial-notice-visual"><BellRing /><div><strong>Nuova offerta</strong><small>Apri e rilancia subito</small></div></div>,
    hint: 'Puoi riaprire questa guida in qualsiasi momento dal Profilo.'
  }
]

export default function OnboardingTutorial({ loggedIn }: TutorialManagerProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!loggedIn) { setOpen(false); return }
    let active = true
    void api.get('/profile/me').then(({ data }) => {
      if (active && data.user?.profileCompleted && !data.user?.tutorialCompletedAt) {
        setStep(0)
        setOpen(true)
      }
    }).catch(() => undefined)
    return () => { active = false }
  }, [loggedIn])

  useEffect(() => {
    const show = () => { setStep(0); setOpen(true) }
    window.addEventListener('fd:open-tutorial', show)
    window.addEventListener('fd:profile-completed', show)
    return () => {
      window.removeEventListener('fd:open-tutorial', show)
      window.removeEventListener('fd:profile-completed', show)
    }
  }, [])

  const close = React.useCallback(async () => {
    if (saving) return
    setSaving(true)
    try { await api.post('/profile/tutorial/complete') } catch { /* It can safely reappear later. */ }
    finally { setSaving(false); setOpen(false) }
  }, [saving])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') void close() }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [close, open])

  if (!open) return null
  const current = steps[step]
  const Icon = current.icon
  return <div className="tutorial-backdrop" role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
    <section className="tutorial-dialog">
      <button type="button" className="tutorial-close" onClick={() => void close()} aria-label="Chiudi tutorial" autoFocus><X /></button>
      <div className="tutorial-progress" aria-label={`Passaggio ${step + 1} di ${steps.length}`}>
        {steps.map((_, index) => <i key={index} className={index <= step ? 'is-active' : ''} />)}
      </div>
      <div className="tutorial-icon"><Icon /></div>
      <p className="eyebrow">{current.eyebrow}</p>
      <h2 id="tutorial-title">{current.title}</h2>
      <p className="tutorial-copy">{current.copy}</p>
      <div className="tutorial-visual">{current.visual}</div>
      <p className="tutorial-hint"><Layers size={15} /> {current.hint}</p>
      <div className="tutorial-actions">
        <button type="button" className="btn btn-ghost" onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={step === 0}><ChevronLeft /> Indietro</button>
        {step < steps.length - 1
          ? <button type="button" className="btn" onClick={() => setStep((value) => value + 1)}>Continua <ChevronRight /></button>
          : <button type="button" className="btn" onClick={() => void close()} disabled={saving}>{saving ? 'Salvo…' : 'Inizia a giocare'} <Check /></button>}
      </div>
    </section>
  </div>
}
