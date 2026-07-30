import React, { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream

export default function PwaInstallPrompt() {
  const [deferred, setDeferred] = useState<InstallPrompt | null>(null)
  const [installed, setInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as any).standalone))
  const [showIosHelp, setShowIosHelp] = useState(false)
  useEffect(() => { const ready = (event: Event) => { event.preventDefault(); setDeferred(event as InstallPrompt) }; const done = () => { setInstalled(true); setDeferred(null) }; window.addEventListener('beforeinstallprompt', ready); window.addEventListener('appinstalled', done); return () => { window.removeEventListener('beforeinstallprompt', ready); window.removeEventListener('appinstalled', done) } }, [])
  const install = async () => { if (!deferred) return; await deferred.prompt(); const choice = await deferred.userChoice; if (choice.outcome === 'accepted') setDeferred(null) }
  if (installed) return null
  if (deferred) return <button type="button" className="pwa-install" aria-label="Installa app" onClick={() => void install()}><Download size={15} /><span>Installa app</span></button>
  if (!isIos()) return null
  return <><button type="button" className="pwa-install" aria-label="Installa su iPhone" onClick={() => setShowIosHelp(true)}><Download size={15} /><span>Installa su iPhone</span></button>{showIosHelp && <div className="pwa-install-help" role="dialog" aria-modal="true"><strong>Installa FantaDrama</strong><p>Apri il menu Condividi di Safari o Brave, scegli “Aggiungi a Home” e conferma “Apri come app web”.</p><button type="button" onClick={() => setShowIosHelp(false)}>Ho capito</button></div>}</>
}
