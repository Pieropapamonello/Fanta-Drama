import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { db, documentData } from '../services/firebase'

const router = Router()
const avatars = ['/characters/pulse.png', '/characters/mischief.png', '/characters/shock.png', '/characters/calm.png'] as const
const profileSchema = z.object({
  username: z.string().trim().min(3).max(30),
  avatar: z.enum(avatars),
  bio: z.string().trim().max(160).optional(),
  city: z.string().trim().max(48).optional(),
  crewRole: z.enum(['Stratega', 'Creatore di caos', 'Osservatore', 'Regista del drama', 'Jolly']).optional(),
  motto: z.string().trim().max(90).optional(),
})

router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  const snapshot = await db.collection('users').doc(req.userId!).get()
  if (!snapshot.exists) return res.status(404).json({ error: 'not_found' })
  return res.json({ user: documentData(snapshot.id, snapshot.data() as Record<string, unknown>) })
})

router.put('/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const data = profileSchema.parse(req.body)
    const duplicate = await db.collection('users').where('username', '==', data.username).limit(1).get()
    if (!duplicate.empty && duplicate.docs[0].id !== req.userId) return res.status(409).json({ error: 'username_taken' })
    const ref = db.collection('users').doc(req.userId!)
    const current = await ref.get()
    if (!current.exists) return res.status(404).json({ error: 'not_found' })
    const profile = {
      ...current.data(),
      username: data.username,
      avatar: data.avatar,
      bio: data.bio ?? '',
      city: data.city ?? '',
      crewRole: data.crewRole ?? 'Jolly',
      motto: data.motto ?? '',
      profileCompleted: true,
      updatedAt: new Date().toISOString(),
    }
    await ref.set(profile)
    return res.json({ user: documentData(ref.id, profile) })
  } catch (error: any) {
    return res.status(400).json({ error: error.message ?? 'invalid_profile' })
  }
})

export default router
