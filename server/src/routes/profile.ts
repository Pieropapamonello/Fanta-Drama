import { Router } from 'express'
import { z } from 'zod'
import crypto from 'crypto'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { db, documentData, firebaseAuth } from '../services/firebase'

const router = Router()
const avatars = ['/characters/pulse.png', '/characters/mischief.png', '/characters/shock.png', '/characters/calm.png'] as const
const profileSchema = z.object({
  username: z.string().trim().min(3).max(30), avatar: z.enum(avatars), bio: z.string().trim().max(160).optional(), city: z.string().trim().max(48).optional(),
  crewRole: z.enum(['Stratega', 'Creatore di caos', 'Osservatore', 'Regista del drama', 'Jolly']).optional(), motto: z.string().trim().max(90).optional(),
  notificationPreference: z.enum(['TELEGRAM', 'EMAIL', 'BOTH']).optional(),
})

async function profileWithConnections(userId: string) {
  const [snapshot, authUser, link] = await Promise.all([db.collection('users').doc(userId).get(), firebaseAuth.getUser(userId), db.collection('telegramLinks').doc(userId).get()])
  if (!snapshot.exists) return null
  const user = snapshot.data() as Record<string, unknown>
  return { id: snapshot.id, ...user, email: authUser.email ?? '', connections: { email: Boolean(authUser.email), telegram: link.exists && Boolean(link.data()?.chatId) } }
}

router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  const user = await profileWithConnections(req.userId!)
  if (!user) return res.status(404).json({ error: 'not_found' })
  return res.json({ user })
})

router.put('/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const data = profileSchema.parse(req.body)
    const duplicate = await db.collection('users').where('username', '==', data.username).limit(1).get()
    if (!duplicate.empty && duplicate.docs[0].id !== req.userId) return res.status(409).json({ error: 'username_taken' })
    const ref = db.collection('users').doc(req.userId!)
    const current = await ref.get()
    if (!current.exists) return res.status(404).json({ error: 'not_found' })
    const authUser = await firebaseAuth.getUser(req.userId!)
    const profile = { ...current.data(), username: data.username, avatar: data.avatar, email: authUser.email ?? '', bio: data.bio ?? '', city: data.city ?? '', crewRole: data.crewRole ?? 'Jolly', motto: data.motto ?? '', notificationPreference: data.notificationPreference ?? 'BOTH', profileCompleted: true, updatedAt: new Date().toISOString() }
    await ref.set(profile)
    return res.json({ user: await profileWithConnections(req.userId!) })
  } catch (error: any) { return res.status(400).json({ error: error.message ?? 'invalid_profile' }) }
})

router.post('/telegram-link', requireAuth, async (req: AuthRequest, res) => {
  const code = crypto.randomBytes(20).toString('base64url')
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()
  await db.collection('telegramLinkRequests').doc(code).set({ userId: req.userId!, expiresAt, createdAt: new Date().toISOString(), usedAt: null })
  return res.json({ code, expiresAt })
})

export default router
