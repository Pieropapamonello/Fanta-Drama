import { Router } from 'express'
import { z } from 'zod'
import crypto from 'crypto'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { db, documentData, firebaseAuth } from '../services/firebase'
import { ensureWallet } from '../services/auctions'

const router = Router()
const avatars = ['/characters/pulse.png', '/characters/mischief.png', '/characters/shock.png', '/characters/calm.png', '/avatars/common/violet-curly.png', '/avatars/common/silver-blue.png'] as const
const profileSchema = z.object({
  username: z.string().trim().min(3).max(30), avatar: z.union([z.enum(avatars), z.string().url().max(2048)]), bio: z.string().trim().max(160).optional(), city: z.string().trim().max(48).optional(),
  crewRole: z.enum(['Stratega', 'Creatore di caos', 'Osservatore', 'Regista del drama', 'Jolly']).optional(), motto: z.string().trim().max(90).optional(),
  notificationPreference: z.enum(['IN_APP', 'TELEGRAM', 'EMAIL', 'BOTH', 'ALL']).optional(),
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

router.get('/overview', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!
  const [groups, cards, scores, notifications, wallet] = await Promise.all([
    db.collection('groups').where('memberIds', 'array-contains', userId).get(),
    db.collection('cards').where('authorId', '==', userId).get(),
    db.collection('scores').where('userId', '==', userId).get(),
    db.collection('notifications').where('userId', '==', userId).get(), ensureWallet(userId)
  ])
  const groupIds = new Set(groups.docs.map((group) => group.id))
  const allEvents = await db.collection('events').get()
  const nextEvents = allEvents.docs
    .filter((event) => groupIds.has(String(event.data().groupId)) && event.data().state !== 'PRONOSTICI_CHIUSI' && new Date(event.data().endsAt).getTime() > Date.now())
    .sort((left, right) => String(left.data().startsAt).localeCompare(String(right.data().startsAt)))
    .slice(0, 3)
    .map((event) => documentData(event.id, event.data() as Record<string, unknown>))
  const recentNotifications = notifications.docs
    .map((notification) => documentData(notification.id, notification.data() as Record<string, unknown>))
    .sort((left, right) => String(right.createdAt ?? '').localeCompare(String(left.createdAt ?? '')))
    .slice(0, 4)
  return res.json({
    stats: { groups: groups.size, cards: cards.size, credits: Math.max(0, Number(wallet.data()?.balance ?? 1000) - Number(wallet.data()?.reserved ?? 0)), reservedCredits: Number(wallet.data()?.reserved ?? 0) },
    nextEvents, recentNotifications
  })
})

router.get('/notifications', requireAuth, async (req: AuthRequest, res) => {
  const snapshot = await db.collection('notifications').where('userId', '==', req.userId!).get()
  const notifications = snapshot.docs.map((item) => documentData(item.id, item.data() as Record<string, unknown>)).sort((left, right) => String(right.createdAt ?? '').localeCompare(String(left.createdAt ?? ''))).slice(0, 50)
  return res.json({ notifications })
})

router.post('/notifications/read', requireAuth, async (req: AuthRequest, res) => {
  const snapshot = await db.collection('notifications').where('userId', '==', req.userId!).get()
  const batch = db.batch(); snapshot.docs.forEach((item) => batch.update(item.ref, { readAt: new Date().toISOString() })); await batch.commit()
  return res.json({ ok: true })
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
    const profile = { ...current.data(), username: data.username, avatar: data.avatar, email: authUser.email ?? '', bio: data.bio ?? '', city: data.city ?? '', crewRole: data.crewRole ?? 'Jolly', motto: data.motto ?? '', notificationPreference: data.notificationPreference ?? 'ALL', profileCompleted: true, updatedAt: new Date().toISOString() }
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
