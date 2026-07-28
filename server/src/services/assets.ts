import crypto from 'crypto'
import { storage, db } from './firebase'

export type AssetKind = 'CARD' | 'EVENT' | 'AVATAR'

function imagePrompt(kind: AssetKind, description: string) {
  const style = 'Original FantaDrama social-game universe; refined glossy 3D editorial illustration; cinematic violet, indigo, cyan and hot-pink lighting; no text, no letters, no logos, no watermark, no celebrity, no recognizable real person, no copyrighted characters.'
  if (kind === 'CARD') return `Collectible game card artwork, vertical action composition. Subject: ${description}. ${style}`
  if (kind === 'EVENT') return `Premium social event key art, cinematic landscape composition with clear central subject. Subject: ${description}. ${style}`
  return `Square character avatar, head-and-shoulders of an original fictional adult. Description: ${description}. Friendly expressive face, centered for circular crop. ${style}`
}

async function saveToStorage(userId: string, kind: AssetKind, buffer: Buffer, contentType: string) {
  const extension = contentType === 'image/jpeg' ? 'jpg' : contentType === 'image/webp' ? 'webp' : 'png'
  const token = crypto.randomUUID()
  const path = `fantadrama/${kind.toLowerCase()}/${userId}/${crypto.randomUUID()}.${extension}`
  const file = storage.bucket().file(path)
  await file.save(buffer, { resumable: false, metadata: { contentType, metadata: { firebaseStorageDownloadTokens: token } } })
  return `https://firebasestorage.googleapis.com/v0/b/${storage.bucket().name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`
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

export async function generateImageAsset(userId: string, kind: AssetKind, description: string) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('openai_image_generation_not_configured')
  await consumeQuota(userId)
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-image-2', prompt: imagePrompt(kind, description), size: kind === 'EVENT' ? '1536x1024' : '1024x1024', quality: 'medium', output_format: 'png' })
  })
  if (!response.ok) throw new Error(`image_generation_failed_${response.status}`)
  const responseData = await response.json() as { data?: Array<{ b64_json?: string, url?: string }> }
  const image = responseData.data?.[0]
  let buffer: Buffer | undefined
  if (image?.b64_json) buffer = Buffer.from(image.b64_json, 'base64')
  else if (image?.url) { const download = await fetch(image.url); if (download.ok) buffer = Buffer.from(await download.arrayBuffer()) }
  if (!buffer) throw new Error('image_generation_empty_response')
  return saveToStorage(userId, kind, buffer, 'image/png')
}

export async function uploadAvatarAsset(userId: string, dataUrl: string) {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl)
  if (!match) throw new Error('invalid_image_upload')
  const buffer = Buffer.from(match[2], 'base64')
  if (buffer.length > 2_500_000) throw new Error('image_too_large')
  return saveToStorage(userId, 'AVATAR', buffer, match[1])
}
