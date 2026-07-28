import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { generateImageAsset, generateSharedStarterAsset, uploadAvatarAsset } from '../services/assets'
import { starterAvatars } from '../data/starter-content'
import { db } from '../services/firebase'

const router = Router()
const generationSchema = z.object({ kind: z.enum(['CARD', 'EVENT', 'AVATAR']), description: z.string().trim().min(12).max(600) })
const uploadSchema = z.object({ dataUrl: z.string().min(32).max(3_500_000) })

router.post('/generate', requireAuth, async (req: AuthRequest, res) => {
  try {
    const data = generationSchema.parse(req.body)
    const imageUrl = await generateImageAsset(req.userId!, data.kind, data.description)
    return res.status(201).json({ imageUrl })
  } catch (error: any) {
    const message = error.message ?? 'image_generation_failed'
    const unavailable = /^(openai|gemini|grok|cloudflare)_image_generation_not_configured$/.test(message)
      || message === 'dropbox_storage_not_configured'
    return res.status(unavailable ? 503 : 400).json({ error: message })
  }
})

router.post('/avatar-upload', requireAuth, async (req: AuthRequest, res) => {
  try { return res.status(201).json({ imageUrl: await uploadAvatarAsset(req.userId!, uploadSchema.parse(req.body).dataUrl) }) }
  catch (error: any) { return res.status(400).json({ error: error.message ?? 'avatar_upload_failed' }) }
})

router.get('/starter-avatars', requireAuth, async (_req, res) => {
  const snapshot = await db.collection('sharedGeneratedAssets').where('kind', '==', 'AVATAR').get()
  const cached = new Map(snapshot.docs.map((doc) => [String(doc.data().key), String(doc.data().imageUrl)]))
  return res.json({ avatars: starterAvatars.map((avatar) => ({ ...avatar, imageUrl: avatar.imageUrl ?? cached.get(avatar.slug) })) })
})

router.post('/starter-avatar/:slug', requireAuth, async (req, res) => {
  const avatar = starterAvatars.find((item) => item.slug === req.params.slug)
  if (!avatar) return res.status(404).json({ error: 'starter_avatar_not_found' })
  try { return res.json({ imageUrl: avatar.imageUrl ?? await generateSharedStarterAsset('AVATAR', avatar.slug, avatar.prompt) }) }
  catch (error: any) { return res.status(503).json({ error: error.message ?? 'image_generation_failed' }) }
})

export default router
