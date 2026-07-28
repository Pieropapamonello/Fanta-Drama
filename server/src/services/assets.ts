import crypto from 'crypto'
import { storage, db } from './firebase'

export type AssetKind = 'CARD' | 'EVENT' | 'AVATAR'
type ImageProvider = 'openai' | 'gemini' | 'grok' | 'cloudflare'
type AssetStorageProvider = 'firebase' | 'dropbox'
type GeneratedImage = { buffer: Buffer; contentType: string }

function imagePrompt(kind: AssetKind, description: string) {
  const style = 'Original FantaDrama social-game universe; refined glossy 3D editorial illustration; cinematic violet, indigo, cyan and hot-pink lighting; no text, no letters, no logos, no watermark, no celebrity, no recognizable real person, no copyrighted characters.'
  if (kind === 'CARD') return `Collectible game card artwork, vertical action composition. Subject: ${description}. ${style}`
  if (kind === 'EVENT') return `Premium social event key art, cinematic landscape composition with clear central subject. Subject: ${description}. ${style}`
  return `Square character avatar, head-and-shoulders of an original fictional adult. Description: ${description}. Friendly expressive face, centered for circular crop. ${style}`
}

function extensionFor(contentType: string) {
  return contentType === 'image/jpeg' ? 'jpg' : contentType === 'image/webp' ? 'webp' : 'png'
}

function assetStorageProvider(): AssetStorageProvider {
  const provider = (process.env.ASSET_STORAGE_PROVIDER ?? 'firebase').trim().toLowerCase()
  if (provider === 'firebase' || provider === 'dropbox') return provider
  throw new Error('unsupported_asset_storage_provider')
}

async function saveToFirebaseStorage(userId: string, kind: AssetKind, buffer: Buffer, contentType: string) {
  const extension = contentType === 'image/jpeg' ? 'jpg' : contentType === 'image/webp' ? 'webp' : 'png'
  const token = crypto.randomUUID()
  const path = `fantadrama/${kind.toLowerCase()}/${userId}/${crypto.randomUUID()}.${extension}`
  const file = storage.bucket().file(path)
  await file.save(buffer, { resumable: false, metadata: { contentType, metadata: { firebaseStorageDownloadTokens: token } } })
  return `https://firebasestorage.googleapis.com/v0/b/${storage.bucket().name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`
}

function dropboxAssetFolder() {
  const configured = (process.env.DROPBOX_ASSET_FOLDER ?? '/FantaDrama').trim()
  if (!configured || configured === '/') return ''
  return `/${configured.replace(/^\/+|\/+$/g, '')}`
}

function directDropboxUrl(sharedUrl: string) {
  const url = new URL(sharedUrl)
  url.searchParams.delete('dl')
  url.searchParams.set('raw', '1')
  return url.toString()
}

async function dropboxRequest(endpoint: string, accessToken: string, body: unknown, contentType = 'application/json') {
  return fetch(`https://api.dropboxapi.com/2/${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'content-type': contentType },
    body: JSON.stringify(body)
  })
}

async function ensureDropboxFolder(accessToken: string, path: string) {
  let current = ''
  for (const part of path.split('/').filter(Boolean)) {
    current += `/${part}`
    const response = await dropboxRequest('files/create_folder_v2', accessToken, { path: current, autorename: false })
    // 409 is the normal response when a previous upload has already created the folder.
    if (!response.ok && response.status !== 409) {
      const raw = await response.text()
      let payload: { error_summary?: string, error?: string } | null = null
      try { payload = JSON.parse(raw) as { error_summary?: string, error?: string } } catch { /* The fallback below covers plain-text API errors. */ }
      const reason = (payload?.error_summary ?? payload?.error ?? raw).replace(/[^a-z0-9 .:_-]/gi, '').slice(0, 180).trim() || 'unknown'
      throw new Error(`dropbox_folder_create_failed_${response.status}_${reason}`)
    }
  }
}

async function saveToDropbox(userId: string, kind: AssetKind, buffer: Buffer, contentType: string) {
  const accessToken = process.env.DROPBOX_ACCESS_TOKEN?.trim()
  if (!accessToken) throw new Error('dropbox_storage_not_configured')
  const folder = `${dropboxAssetFolder()}/${kind.toLowerCase()}/${userId}`
  await ensureDropboxFolder(accessToken, folder)
  const path = `${folder}/${crypto.randomUUID()}.${extensionFor(contentType)}`
  const upload = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'content-type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify({ path, mode: 'add', autorename: false, mute: true })
    },
    body: new Uint8Array(buffer)
  })
  if (!upload.ok) throw new Error(`dropbox_upload_failed_${upload.status}`)

  const sharedLink = await dropboxRequest('sharing/create_shared_link_with_settings', accessToken, {
    path,
    settings: { requested_visibility: 'public' }
  })
  if (sharedLink.ok) {
    const payload = await sharedLink.json() as { url?: string }
    if (payload.url) return directDropboxUrl(payload.url)
  }

  // Dropbox returns an error when a public link already exists for this path.
  const existingLinks = await dropboxRequest('sharing/list_shared_links', accessToken, { path, direct_only: true })
  if (existingLinks.ok) {
    const payload = await existingLinks.json() as { links?: Array<{ url?: string }> }
    const url = payload.links?.[0]?.url
    if (url) return directDropboxUrl(url)
  }
  throw new Error(`dropbox_shared_link_failed_${sharedLink.status}`)
}

async function saveToStorage(userId: string, kind: AssetKind, buffer: Buffer, contentType: string) {
  if (assetStorageProvider() === 'dropbox') return saveToDropbox(userId, kind, buffer, contentType)
  return saveToFirebaseStorage(userId, kind, buffer, contentType)
}

async function consumeQuota(userId: string) {
  const date = new Date().toISOString().slice(0, 10)
  const ref = db.collection('imageGenerationQuotas').doc(`${userId}_${date}`)
  const limit = Number(process.env.AI_IMAGE_DAILY_LIMIT ?? 6)
  await db.runTransaction(async (transaction) => {
    const current = await transaction.get(ref)
    const count = Number(current.data()?.count ?? 0)
    if (count >= limit) throw new Error('daily_generation_limit_reached')
    transaction.set(ref, { userId, date, count: count + 1, updatedAt: new Date().toISOString() }, { merge: true })
  })
}

function providerFromEnvironment(value: string | undefined, allowAuto = true): ImageProvider {
  const provider = (value ?? 'openai').trim().toLowerCase()
  if (allowAuto && provider === 'auto') {
    if (process.env.CLOUDFLARE_AI_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID) return 'cloudflare'
    if (process.env.GEMINI_API_KEY) return 'gemini'
    if (process.env.OPENAI_API_KEY) return 'openai'
    if (process.env.XAI_API_KEY) return 'grok'
  }
  if (provider === 'openai' || provider === 'gemini' || provider === 'grok' || provider === 'cloudflare') return provider
  throw new Error('unsupported_image_provider')
}

async function generateWithOpenAI(kind: AssetKind, prompt: string): Promise<GeneratedImage> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('openai_image_generation_not_configured')
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: process.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-2', prompt, size: kind === 'EVENT' ? '1536x1024' : '1024x1024', quality: 'medium', output_format: 'png' })
  })
  if (!response.ok) throw new Error(`image_generation_failed_${response.status}`)
  const responseData = await response.json() as { data?: Array<{ b64_json?: string, url?: string }> }
  const image = responseData.data?.[0]
  let buffer: Buffer | undefined
  if (image?.b64_json) buffer = Buffer.from(image.b64_json, 'base64')
  else if (image?.url) { const download = await fetch(image.url); if (download.ok) buffer = Buffer.from(await download.arrayBuffer()) }
  if (!buffer) throw new Error('image_generation_empty_response')
  return { buffer, contentType: 'image/png' }
}

async function generateWithGemini(kind: AssetKind, prompt: string): Promise<GeneratedImage> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('gemini_image_generation_not_configured')
  const model = process.env.GEMINI_IMAGE_MODEL ?? 'gemini-3.1-flash-image'
  const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['IMAGE'],
        responseFormat: { image: { aspectRatio: kind === 'EVENT' ? '16:9' : '1:1', imageSize: '1K' } }
      }
    })
  })
  if (!response.ok) throw new Error(`image_generation_failed_${response.status}`)
  const responseData = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> } }> }
  const inlineData = responseData.candidates?.flatMap((candidate) => candidate.content?.parts ?? []).find((part) => part.inlineData?.data)?.inlineData
  if (!inlineData?.data) throw new Error('image_generation_empty_response')
  return { buffer: Buffer.from(inlineData.data, 'base64'), contentType: inlineData.mimeType ?? 'image/png' }
}

async function generateWithGrok(kind: AssetKind, prompt: string): Promise<GeneratedImage> {
  const apiKey = process.env.XAI_API_KEY
  if (!apiKey) throw new Error('grok_image_generation_not_configured')
  const response = await fetch('https://api.x.ai/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: process.env.GROK_IMAGE_MODEL ?? 'grok-imagine-image', prompt, aspect_ratio: kind === 'EVENT' ? '16:9' : '1:1', response_format: 'b64_json' })
  })
  if (!response.ok) throw new Error(`image_generation_failed_${response.status}`)
  const responseData = await response.json() as { data?: Array<{ b64_json?: string; url?: string }> }
  const image = responseData.data?.[0]
  let buffer: Buffer | undefined
  if (image?.b64_json) buffer = Buffer.from(image.b64_json, 'base64')
  else if (image?.url) { const download = await fetch(image.url); if (download.ok) buffer = Buffer.from(await download.arrayBuffer()) }
  if (!buffer) throw new Error('image_generation_empty_response')
  return { buffer, contentType: 'image/jpeg' }
}

async function generateWithCloudflare(kind: AssetKind, prompt: string): Promise<GeneratedImage> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  const apiToken = process.env.CLOUDFLARE_AI_TOKEN
  if (!accountId || !apiToken) throw new Error('cloudflare_image_generation_not_configured')
  const model = process.env.CLOUDFLARE_IMAGE_MODEL ?? '@cf/stabilityai/stable-diffusion-xl-base-1.0'
  const eventImage = kind === 'EVENT'
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${model}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      prompt,
      negative_prompt: 'text, letters, logo, watermark, celebrity, recognizable real person, copyrighted character, blurry, low quality',
      width: eventImage ? 1024 : 768,
      height: eventImage ? 576 : 1024,
      num_steps: 12,
      guidance: 7.5
    })
  })
  if (!response.ok) throw new Error(`image_generation_failed_${response.status}`)
  const contentType = response.headers.get('content-type') ?? ''
  const payload = Buffer.from(await response.arrayBuffer())
  if (contentType.startsWith('image/')) return { buffer: payload, contentType }
  try {
    const body = JSON.parse(payload.toString('utf8')) as { result?: string; success?: boolean }
    if (body.result) return { buffer: Buffer.from(body.result.replace(/^data:image\/\w+;base64,/, ''), 'base64'), contentType: 'image/png' }
  } catch { /* The binary response path above handles the normal image result. */ }
  throw new Error('image_generation_empty_response')
}

async function generateWithProvider(provider: ImageProvider, kind: AssetKind, prompt: string) {
  if (provider === 'cloudflare') return generateWithCloudflare(kind, prompt)
  if (provider === 'gemini') return generateWithGemini(kind, prompt)
  if (provider === 'grok') return generateWithGrok(kind, prompt)
  return generateWithOpenAI(kind, prompt)
}

export async function generateImageAsset(userId: string, kind: AssetKind, description: string) {
  const provider = providerFromEnvironment(process.env.AI_IMAGE_PROVIDER)
  const fallback = process.env.AI_IMAGE_FALLBACK_PROVIDER ? providerFromEnvironment(process.env.AI_IMAGE_FALLBACK_PROVIDER, false) : undefined
  await consumeQuota(userId)
  let generated: GeneratedImage
  try {
    generated = await generateWithProvider(provider, kind, imagePrompt(kind, description))
  } catch (error) {
    if (!fallback || fallback === provider) throw error
    generated = await generateWithProvider(fallback, kind, imagePrompt(kind, description))
  }
  return saveToStorage(userId, kind, generated.buffer, generated.contentType)
}

export async function uploadAvatarAsset(userId: string, dataUrl: string) {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl)
  if (!match) throw new Error('invalid_image_upload')
  const buffer = Buffer.from(match[2], 'base64')
  if (buffer.length > 2_500_000) throw new Error('image_too_large')
  return saveToStorage(userId, 'AVATAR', buffer, match[1])
}
