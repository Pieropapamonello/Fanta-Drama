import React, { useState } from 'react'
import { Image, Sparkles } from 'lucide-react'
import api from '../services/api'

type Kind = 'CARD' | 'EVENT' | 'AVATAR'

export default function ImageForge({ kind, imageUrl, onChange }: { kind: Kind; imageUrl?: string; onChange: (url: string) => void }) {
  const [description, setDescription] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [message, setMessage] = useState('')
  const labels = { CARD: 'Illustrazione carta', EVENT: 'Immagine evento', AVATAR: 'Avatar IA' }

  const generate = async () => {
    if (description.trim().length < 12) { setMessage('Descrivi l’immagine con almeno 12 caratteri.'); return }
    setIsGenerating(true); setMessage('L’IA sta creando la tua immagine…')
    try {
      const response = await api.post('/assets/generate', { kind, description })
      onChange(response.data.imageUrl); setMessage('Immagine pronta: verrà salvata insieme al contenuto.')
    } catch (error: any) {
      const code = error.response?.data?.error
      setMessage(/^(openai|gemini|grok|cloudflare)_image_generation_not_configured$/.test(code ?? '') ? 'La generazione IA deve ancora essere attivata dall’amministratore.' : code === 'daily_generation_limit_reached' ? 'Hai raggiunto il limite giornaliero di immagini IA.' : 'Non riesco a generare l’immagine. Modifica la descrizione e riprova.')
    } finally { setIsGenerating(false) }
  }

  return <div className="image-forge"><div className="image-forge-title"><Image size={16} /><div><strong>{labels[kind]} generata dall’IA</strong><span>Descrivi ciò che vuoi: niente marchi o persone reali.</span></div></div><textarea className="input profile-textarea" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={600} placeholder={kind === 'AVATAR' ? 'Es. ragazza con capelli ricci, sorriso ironico, look viola neon…' : 'Es. una torta di compleanno che esplode in coriandoli viola durante una festa…'} /><button type="button" className="btn btn-ghost" onClick={generate} disabled={isGenerating}><Sparkles size={15} />{isGenerating ? 'Generazione…' : 'Genera immagine'}</button>{imageUrl && <img className="image-forge-preview" src={imageUrl} alt="Anteprima generata" />}{message && <p className="contact-message" role="status">{message}</p>}</div>
}
