import React, { useEffect, useState } from 'react'
import { Image, Sparkles, Upload } from 'lucide-react'
import api from '../services/api'

type Kind = 'CARD' | 'EVENT' | 'AVATAR'
type ImageSource = 'AI' | 'UPLOAD' | 'BASE'

function uploadErrorMessage(error: any) {
  const code = String(error?.response?.data?.error ?? '')
  if (code.includes('expired_access_token') || code.includes('_401_')) return 'Dropbox ha rifiutato il token: va rigenerato o aggiornato su Render.'
  if (code.includes('_403') || code.includes('shared_link_failed')) return 'Dropbox ha rifiutato il caricamento o il link pubblico: controlla i permessi files.content.write e sharing.write.'
  if (code === 'image_too_large') return 'L’immagine supera 2,5 MB. Scegline una più piccola.'
  if (code === 'invalid_image_upload') return 'Usa un file PNG, JPG o WebP valido.'
  return 'Non riesco a caricare questa immagine. Riprova.'
}

export default function ImageForge({ kind, imageUrl, onChange }: { kind: Kind; imageUrl?: string; onChange: (url: string, storagePath?: string, source?: ImageSource) => void | Promise<void> }) {
  const [description, setDescription] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [baseImages, setBaseImages] = useState<any[]>([])
  const labels = { CARD: 'Illustrazione carta', EVENT: 'Immagine evento', AVATAR: 'Avatar IA' }

  useEffect(() => {
    if (kind === 'AVATAR') return
    void api.get(`/assets/base-images?kind=${kind}`).then((response) => setBaseImages(response.data.images || [])).catch(() => undefined)
  }, [kind])

  const generate = async () => {
    if (description.trim().length < 12) { setMessage("Descrivi l'immagine con almeno 12 caratteri."); return }
    setIsGenerating(true); setMessage("L'IA sta creando la tua immagine...")
    try {
      const response = await api.post('/assets/generate', { kind, description })
      await onChange(response.data.imageUrl, response.data.storagePath, 'AI')
      setMessage(kind === 'AVATAR' ? 'Avatar generato e salvato nel profilo.' : kind === 'CARD' ? 'Immagine caricata nell’archivio. Ora premi “Pubblica carta”.' : 'Immagine caricata nell’archivio. Ora salva l’evento.')
    } catch (error: any) {
      const code = error.response?.data?.error
      const configured = /^(openai|gemini|grok|cloudflare)_image_generation_not_configured$/.test(code ?? '')
      const cloudflare = /^image_generation_failed_\d+$/.test(code ?? '')
      const dropbox = /^dropbox_/.test(code ?? '')
      const dropboxMessage = code?.includes('expired_access_token') || code?.includes('_401_') ? 'Il token Dropbox e scaduto o non e valido. Generane uno nuovo e aggiorna DROPBOX_ACCESS_TOKEN su Render.' : code?.includes('folder_create_failed_403') || code?.includes('upload_failed_403') ? 'Dropbox rifiuta il permesso di scrittura: abilita files.content.write per la chiave Dropbox.' : code?.includes('shared_link_failed') ? 'L immagine e stata caricata, ma Dropbox non permette di creare il link pubblico: abilita sharing.write e sharing.read.' : "L'immagine e stata creata ma Dropbox non riesce a salvarla. Controlla DROPBOX_ACCESS_TOKEN e i permessi files.content.read, files.content.write, sharing.read e sharing.write."
      setMessage(configured ? "La generazione IA deve ancora essere attivata dall'amministratore." : code === 'daily_generation_limit_reached' ? 'Hai raggiunto il limite giornaliero di immagini IA.' : cloudflare ? `Cloudflare AI non ha completato la richiesta (${code.replace('image_generation_failed_', 'errore ')}). Riprova tra poco.` : dropbox ? dropboxMessage : "Non riesco a generare l'immagine. Riprova tra poco.")
    } finally { setIsGenerating(false) }
  }

  const upload = async (file?: File) => {
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2_500_000) { setMessage('Scegli un PNG, JPG o WebP fino a 2,5 MB.'); return }
    setIsUploading(true); setMessage("Carico l'immagine...")
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file) })
      const response = await api.post('/assets/upload', { kind, dataUrl })
      await onChange(response.data.imageUrl, response.data.storagePath, 'UPLOAD')
      setMessage(kind === 'CARD' ? 'Immagine caricata nell’archivio. Ora premi “Pubblica carta”.' : 'Immagine caricata nell’archivio. Ora salva l’evento.')
    } catch (error: any) { setMessage(uploadErrorMessage(error)) } finally { setIsUploading(false) }
  }

  return <div className="image-forge">
    <div className="image-forge-title"><Image size={16} /><div><strong>{labels[kind]}: scegli come crearla</strong><span>Generala con IA, caricane una tua oppure scegli un'illustrazione base.</span></div></div>
    <textarea className="input profile-textarea" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={600} placeholder={kind === 'AVATAR' ? 'Es. ragazza con capelli ricci, sorriso ironico, look viola neon...' : 'Es. una torta di compleanno che esplode in coriandoli viola durante una festa...'} />
    <div className="image-forge-actions">
      <button type="button" className="btn btn-ghost" onClick={generate} disabled={isGenerating}><Sparkles size={15} />{isGenerating ? 'Generazione...' : 'Genera con IA'}</button>
      {kind !== 'AVATAR' && <label className="btn btn-ghost image-upload-button"><Upload size={15} />{isUploading ? 'Caricamento...' : 'Carica la tua immagine'}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void upload(event.target.files?.[0])} disabled={isUploading} /></label>}
    </div>
    {baseImages.length > 0 && <div className="base-image-picker"><strong>Oppure usa un'illustrazione base</strong><span>Non usa crediti IA: seleziona quella che si adatta meglio alla carta.</span><div>{baseImages.map((item) => <button type="button" key={item.id} className={imageUrl === item.imageUrl ? 'is-selected' : ''} onClick={() => { onChange(item.imageUrl, undefined, 'BASE'); setMessage('Illustrazione base selezionata.') }}><img src={item.imageUrl} alt={item.title} /><small>{item.title}</small></button>)}</div></div>}
    {imageUrl && <img className="image-forge-preview" src={imageUrl} alt="Anteprima selezionata" />}
    {message && <p className="contact-message" role="status">{message}</p>}
  </div>
}
