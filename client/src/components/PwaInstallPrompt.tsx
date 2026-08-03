import React, { useEffect, useState } from 'react'
import { Copy, Download, Share2, X } from 'lucide-react'
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
const isIos = () => (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) && !(window as any).MSStream

export default function PwaInstallPrompt() {
  const [deferred, setDeferred] = useState<InstallPrompt | null>(null)
  const [installed, setInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as any).standalone))
  const [showIosHelp, setShowIosHelp] = useState(false)
  const [copied, setCopied] = useState(false)
  useEffect(() => { const ready = (event: Event) => { event.preventDefault(); setDeferred(event as InstallPrompt) }; const done = () => { setInstalled(true); setDeferred(null) }; window.addEventListener('beforeinstallprompt', ready); window.addEventListener('appinstalled', done); return () => { window.removeEventListener('beforeinstallprompt', ready); window.removeEventListener('appinstalled', done) } }, [])
  const install = async () => { if (!deferred) return; await deferred.prompt(); const choice = await deferred.userChoice; if (choice.outcome === 'accepted') setDeferred(null) }
  if (installed) return null
  if (deferred) return <button type="button" className="pwa-install" aria-label="Installa app" onClick={() => void install()}><Download size={15} /><span>Installa app</span></button>
  if (!isIos()) return null
  const copyAddress = async () => { await navigator.clipboard.writeText(window.location.origin); setCopied(true) }
  return <><button type="button" className="pwa-install" aria-label="Come installare su iPhone" onClick={() => setShowIosHelp(true)}><Download size={15} /><span>Come installare</span></button>{showIosHelp && <div className="pwa-install-help-backdrop" role="presentation"><section className="pwa-install-help" role="dialog" aria-modal="true" aria-labelledby="ios-install-title"><button type="button" className="pwa-install-close" onClick={() => setShowIosHelp(false)} aria-label="Chiudi"><X size={18} /></button><strong id="ios-install-title">Aggiungi FantaDrama alla Home</strong><p>Su iPhone Apple non consente l’installazione automatica. Servono questi tre tocchi in Safari:</p><ol><li><span>1</span>Apri questa pagina in <b>Safari</b>.</li><li><span>2</span>Tocca <Share2 size={17} /> <b>Condividi</b>.</li><li><span>3</span>Scegli <b>Aggiungi alla schermata Home</b>, poi <b>Aggiungi</b>.</li></ol><button type="button" className="pwa-copy-address" onClick={() => void copyAddress()}><Copy size={16} />{copied ? 'Indirizzo copiato' : 'Copia indirizzo per Safari'}</button></section></div>}</>
}
