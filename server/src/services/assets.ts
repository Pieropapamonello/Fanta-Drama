import crypto from 'crypto'
import { storage, db } from './firebase'

export type AssetKind = 'CARD' | 'EVENT' | 'AVATAR'
type ImageProvider = 'openai' | 'gemini' | 'grok' | 'cloudflare'
type AssetStorageProvider = 'firebase' | 'dropbox'
type GeneratedImage = { buffer: Buffer; contentType: string }
export type StoredAsset = { imageUrl: string; storagePath?: string }

let cachedDropboxAccessToken: { value: string; expiresAt: number } | null = null

function imagePrompt(kind: AssetKind, description: string) {
  const style = 'Original FantaDrama social-game universe; refined glossy 3D editorial illustration; cinematic violet, indigo, cyan and hot-pink lighting; family-friendly social party mood; no text, no letters, no logos, no watermark, no celebrity, no recognizable real person, no copyrighted characters.'
  if (kind === 'CARD') return `Collectible game card artwork, vertical composition. Represent this request literally as a clear object or a cheerful party-table scene: ${description}. Keep the subject central and immediately understandable. Do not invent monsters, reptiles, animals, skeletons, horror, violence, masks, or strange characters. Prefer elegant objects, decorations, food, table settings, lights, confetti, cards, or an empty place setting when appropriate. No people unless the description explicitly asks for them. No readable writing anywhere. ${style}`
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

async function saveToFirebaseStorage(userId: string, kind: AssetKind, buffer: Buffer, contentType: string): Promise<StoredAsset> {
  const extension = contentType === 'image/jpeg' ? 'jpg' : contentType === 'image/webp' ? 'webp' : 'png'
  const token = crypto.randomUUID()
  const path = `fantadrama/${kind.toLowerCase()}/${userId}/${crypto.randomUUID()}.${extension}`
  const file = storage.bucket().file(path)
  await file.save(buffer, { resumable: false, metadata: { contentType, metadata: { firebaseStorageDownloadTokens: token } } })
  return { imageUrl: `https://firebasestorage.googleapis.com/v0/b/${storage.bucket().name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`, storagePath: path }
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

/**
 * Dropbox access tokens are intentionally short-lived.  When OAuth refresh
 * credentials are configured this obtains and caches a fresh one; the legacy
 * static token remains supported while the account is being migrated.
 */
async function getDropboxAccessToken() {
  if (cachedDropboxAccessToken && cachedDropboxAccessToken.expiresAt > Date.now()) return cachedDropboxAccessToken.value
  const refreshToken = process.env.DROPBOX_REFRESH_TOKEN?.trim()
  const appKey = process.env.DROPBOX_APP_KEY?.trim()
  const appSecret = process.env.DROPBOX_APP_SECRET?.trim()
  if (refreshToken && appKey && appSecret) {
    const authorization = Buffer.from(`${appKey}:${appSecret}`).toString('base64')
    const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: { Authorization: `Basic ${authorization}`, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }).toString()
    })
    if (!response.ok) throw new Error(`dropbox_token_refresh_failed_${response.status}`)
    const payload = await response.json() as { access_token?: string; expires_in?: number }
    if (!payload.access_token) throw new Error('dropbox_token_refresh_failed_missing_token')
    cachedDropboxAccessToken = { value: payload.access_token, expiresAt: Date.now() + Math.max(60, Number(payload.expires_in ?? 14400) - 120) * 1000 }
    return cachedDropboxAccessToken.value
  }
  const staticToken = process.env.DROPBOX_ACCESS_TOKEN?.trim()
  if (!staticToken) throw new Error('dropbox_storage_not_configured')
  return staticToken
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

async function saveToDropbox(userId: string, kind: AssetKind, buffer: Buffer, contentType: string): Promise<StoredAsset> {
  const accessToken = await getDropboxAccessToken()
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
    if (payload.url) return { imageUrl: directDropboxUrl(payload.url), storagePath: path }
  }

  // Dropbox returns an error when a public link already exists for this path.
  const existingLinks = await dropboxRequest('sharing/list_shared_links', accessToken, { path, direct_only: true })
  if (existingLinks.ok) {
    const payload = await existingLinks.json() as { links?: Array<{ url?: string }> }
    const url = payload.links?.[0]?.url
    if (url) return { imageUrl: directDropboxUrl(url), storagePath: path }
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
  // SDXL was retired from the current Workers AI catalogue.  Transparently
  // migrate an old Render value as well as the default so old deployments do
  // not keep returning a cryptic HTTP 400.
  const configuredModel = process.env.CLOUDFLARE_IMAGE_MODEL?.trim()
  const model = !configuredModel || configuredModel === '@cf/stabilityai/stable-diffusion-xl-base-1.0'
    ? '@cf/lykon/dreamshaper-8-lcm'
    : configuredModel
  const eventImage = kind === 'EVENT'
  const flux = model.includes('flux-')
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${model}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiToken}`, 'content-type': 'application/json' },
    body: JSON.stringify(flux ? { prompt, steps: 4, seed: Math.floor(Math.random() * 2_147_483_647) } : {
      prompt,
      negative_prompt: 'text, letters, logo, watermark, celebrity, recognizable real person, copyrighted character, blurry, low quality',
      width: eventImage ? 1024 : 768,
      height: eventImage ? 576 : 1024,
      num_steps: 12,
      guidance: 7.5
    })
  })
  if (!response.ok) {
    const detail = (await response.text()).replace(/\s+/g, ' ').slice(0, 500)
    console.warn('Cloudflare image generation rejected', { status: response.status, model, detail })
    throw new Error(`image_generation_failed_${response.status}`)
  }
  const contentType = response.headers.get('content-type') ?? ''
  const payload = Buffer.from(await response.arrayBuffer())
  if (contentType.startsWith('image/')) return { buffer: payload, contentType }
  try {
    const body = JSON.parse(payload.toString('utf8')) as { result?: string | { image?: string }; success?: boolean }
    const encoded = typeof body.result === 'string' ? body.result : body.result?.image
    if (encoded) return { buffer: Buffer.from(encoded.replace(/^data:image\/\w+;base64,/, ''), 'base64'), contentType: flux ? 'image/jpeg' : 'image/png' }
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

// Starter artwork belongs to the shared FantaDrama catalogue. It is generated once,
// cached in Firestore and then reused by every player without consuming a player's quota.
export async function generateSharedStarterAsset(kind: AssetKind, key: string, description: string) {
  const ref = db.collection('sharedGeneratedAssets').doc(`${kind.toLowerCase()}_${key}`)
  const existing = await ref.get()
  const cached = existing.data()?.imageUrl
  if (typeof cached === 'string' && cached) return cached
  const provider = providerFromEnvironment(process.env.AI_IMAGE_PROVIDER)
  const generated = await generateWithProvider(provider, kind, imagePrompt(kind, description))
  const asset = await saveToStorage('catalogue', kind, generated.buffer, generated.contentType)
  await ref.set({ kind, key, imageUrl: asset.imageUrl, storagePath: asset.storagePath ?? null, createdAt: new Date().toISOString() })
  return asset.imageUrl
}

export async function uploadAvatarAsset(userId: string, dataUrl: string) {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl)
  if (!match) throw new Error('invalid_image_upload')
  const buffer = Buffer.from(match[2], 'base64')
  if (buffer.length > 2_500_000) throw new Error('image_too_large')
  return (await saveToStorage(userId, 'AVATAR', buffer, match[1])).imageUrl
}

export async function deleteDropboxAsset(storagePath?: string) {
  if (!storagePath || assetStorageProvider() !== 'dropbox') return { deleted: false, reason: 'no_dropbox_path' }
  const root = dropboxAssetFolder()
  if (!storagePath.startsWith(`${root}/`)) throw new Error('invalid_dropbox_asset_path')
  const accessToken = await getDropboxAccessToken()
  const response = await dropboxRequest('files/delete_v2', accessToken, { path: storagePath })
  if (!response.ok && response.status !== 409) throw new Error(`dropbox_delete_failed_${response.status}`)
  return { deleted: response.ok }
}
