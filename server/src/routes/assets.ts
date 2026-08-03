import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { generateImageAsset, uploadAvatarAsset, uploadImageAsset } from '../services/assets'
import { starterAvatars, starterCards } from '../data/starter-content'
import { db } from '../services/firebase'

const router = Router()
const generationSchema = z.object({ kind: z.enum(['CARD', 'EVENT', 'AVATAR']), description: z.string().trim().min(12).max(600) })
const uploadSchema = z.object({ dataUrl: z.string().min(32).max(3_500_000) })

router.post('/generate', requireAuth, async (req: AuthRequest, res) => {
  try {
    const data = generationSchema.parse(req.body)
    const asset = await generateImageAsset(req.userId!, data.kind, data.description)
    return res.status(201).json(asset)
  } catch (error: any) {
    const message = error.message ?? 'image_generation_failed'
    console.error('Image generation failed', { kind: req.body?.kind, userId: req.userId, code: message })
    const unavailable = /^(openai|gemini|grok|cloudflare)_image_generation_not_configured$/.test(message)
      || message === 'dropbox_storage_not_configured'
    return res.status(unavailable ? 503 : 400).json({ error: message })
  }
})

router.post('/avatar-upload', requireAuth, async (req: AuthRequest, res) => {
  try { return res.status(201).json({ imageUrl: await uploadAvatarAsset(req.userId!, uploadSchema.parse(req.body).dataUrl) }) }
  catch (error: any) {
    const message = error.message ?? 'avatar_upload_failed'
    console.error('Avatar upload failed', { userId: req.userId, code: message })
    return res.status(400).json({ error: message })
  }
})

router.post('/upload', requireAuth, async (req: AuthRequest, res) => {
  try {
    const data = z.object({ kind: z.enum(['CARD', 'EVENT']), dataUrl: z.string().min(32).max(3_500_000) }).parse(req.body)
    return res.status(201).json(await uploadImageAsset(req.userId!, data.kind, data.dataUrl))
  } catch (error: any) {
    const message = error.message ?? 'image_upload_failed'
    console.error('Image upload failed', { kind: req.body?.kind, userId: req.userId, code: message })
    return res.status(400).json({ error: message })
  }
})

router.get('/base-images', requireAuth, async (req, res) => {
  const kind = req.query.kind === 'EVENT' ? 'EVENT' : 'CARD'
  const catalog = await db.collection('cardCatalog').orderBy('createdAt', 'desc').limit(80).get()
  const images = [
    ...starterCards.filter((card) => Boolean(card.imageUrl)).map((card) => ({ id: `starter:${card.slug}`, title: card.title, imageUrl: card.imageUrl })),
    ...catalog.docs.filter((card) => Boolean(card.data().imageUrl) && !card.data().eventId).map((card) => ({ id: `catalog:${card.id}`, title: String(card.data().title ?? 'Illustrazione FantaDrama'), imageUrl: String(card.data().imageUrl) }))
  ]
  const unique = [...new Map(images.map((image) => [image.imageUrl, image])).values()].slice(0, kind === 'EVENT' ? 24 : 48)
  return res.json({ images: unique })
})

router.get('/starter-avatars', requireAuth, async (_req, res) => {
  return res.json({ avatars: starterAvatars.filter((avatar) => Boolean(avatar.imageUrl)) })
})

router.post('/starter-avatar/:slug', requireAuth, async (req, res) => {
  const avatar = starterAvatars.find((item) => item.slug === req.params.slug)
  if (!avatar) return res.status(404).json({ error: 'starter_avatar_not_found' })
  if (!avatar.imageUrl) return res.status(409).json({ error: 'starter_avatar_artwork_pending' })
  return res.json({ imageUrl: avatar.imageUrl })
})

export default router
