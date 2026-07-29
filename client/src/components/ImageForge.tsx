import React, { useState } from 'react'
import { Image, Sparkles } from 'lucide-react'
import api from '../services/api'

type Kind = 'CARD' | 'EVENT' | 'AVATAR'

export default function ImageForge({ kind, imageUrl, onChange }: { kind: Kind; imageUrl?: string; onChange: (url: string, storagePath?: string) => void }) {
  const [description, setDescription] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [message, setMessage] = useState('')
  const labels = { CARD: 'Illustrazione carta', EVENT: 'Immagine evento', AVATAR: 'Avatar IA' }

  const generate = async () => {
    if (description.trim().length < 12) { setMessage('Descrivi l’immagine con almeno 12 caratteri.'); return }
    setIsGenerating(true); setMessage('L’IA sta creando la tua immagine…')
    try {
      const response = await api.post('/assets/generate', { kind, description })
      onChange(response.data.imageUrl, response.data.storagePath); setMessage('Immagine pronta: verrà salvata insieme al contenuto.')
    } catch (error: any) {
      const code = error.response?.data?.error
      const configured = /^(openai|gemini|grok|cloudflare)_image_generation_not_configured$/.test(code ?? '')
      const cloudflare = /^image_generation_failed_\d+$/.test(code ?? '')
      const dropbox = /^dropbox_/.test(code ?? '')
      const dropboxMessage = code?.includes('expired_access_token') || code?.includes('_401_') ? 'Il token Dropbox è scaduto o non è valido. Generane uno nuovo e aggiorna DROPBOX_ACCESS_TOKEN su Render.' : code?.includes('folder_create_failed_403') || code?.includes('upload_failed_403') ? 'Dropbox rifiuta il permesso di scrittura: abilita files.content.write per la chiave Dropbox.' : code?.includes('shared_link_failed') ? 'L’immagine è stata caricata, ma Dropbox non permette di creare il link pubblico: abilita sharing.write e sharing.read.' : 'L’immagine è stata creata ma Dropbox non riesce a salvarla. Controlla DROPBOX_ACCESS_TOKEN e i permessi files.content.read, files.content.write, sharing.read e sharing.write.'
      setMessage(configured ? 'La generazione IA deve ancora essere attivata dall’amministratore.' : code === 'daily_generation_limit_reached' ? 'Hai raggiunto il limite giornaliero di immagini IA.' : cloudflare ? `Cloudflare AI non ha completato la richiesta (${code.replace('image_generation_failed_', 'errore ')}). Riprova tra poco.` : dropbox ? dropboxMessage : 'Non riesco a generare l’immagine. Riprova tra poco.')
    } finally { setIsGenerating(false) }
  }

  return <div className="image-forge"><div className="image-forge-title"><Image size={16} /><div><strong>{labels[kind]} generata dall’IA</strong><span>Descrivi ciò che vuoi: niente marchi o persone reali.</span></div></div><textarea className="input profile-textarea" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={600} placeholder={kind === 'AVATAR' ? 'Es. ragazza con capelli ricci, sorriso ironico, look viola neon…' : 'Es. una torta di compleanno che esplode in coriandoli viola durante una festa…'} /><button type="button" className="btn btn-ghost" onClick={generate} disabled={isGenerating}><Sparkles size={15} />{isGenerating ? 'Generazione…' : 'Genera immagine'}</button>{imageUrl && <img className="image-forge-preview" src={imageUrl} alt="Anteprima generata" />}{message && <p className="contact-message" role="status">{message}</p>}</div>
}
