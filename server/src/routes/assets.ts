import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { generateImageAsset, uploadAvatarAsset } from '../services/assets'

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
    return res.status(message === 'openai_image_generation_not_configured' ? 503 : 400).json({ error: message })
  }
})

router.post('/avatar-upload', requireAuth, async (req: AuthRequest, res) => {
  try { return res.status(201).json({ imageUrl: await uploadAvatarAsset(req.userId!, uploadSchema.parse(req.body).dataUrl) }) }
  catch (error: any) { return res.status(400).json({ error: error.message ?? 'avatar_upload_failed' }) }
})

export default router
