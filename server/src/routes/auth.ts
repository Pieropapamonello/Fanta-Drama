import { Router } from 'express'
import { z } from 'zod'
import crypto from 'crypto'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { db, documentData, firebaseAuth } from '../services/firebase'

const router = Router()
const schema = z.object({ username: z.string().trim().min(3).max(30).optional() })
const telegramSchema = z.object({
  id: z.string().regex(/^\d+$/),
  first_name: z.string().trim().min(1).max(64),
  last_name: z.string().trim().max(64).optional(),
  username: z.string().trim().min(1).max(64).optional(),
  photo_url: z.string().url().optional(),
  auth_date: z.string().regex(/^\d+$/),
  hash: z.string().regex(/^[a-f0-9]{64}$/i)
}).strict()

function isValidTelegramLogin(data: z.infer<typeof telegramSchema>) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return false
  const checkString = Object.entries(data)
    .filter(([key]) => key !== 'hash')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
  const secret = crypto.createHash('sha256').update(token).digest()
  const expected = crypto.createHmac('sha256', secret).update(checkString).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(data.hash.toLowerCase()))
}

router.post('/telegram', async (req, res) => {
  try {
    const data = telegramSchema.parse(req.body)
    const authAgeSeconds = Math.floor(Date.now() / 1000) - Number(data.auth_date)
    if (authAgeSeconds < -60 || authAgeSeconds > 10 * 60 || !isValidTelegramLogin(data)) {
      return res.status(401).json({ error: 'invalid_telegram_login' })
    }

    const userId = `telegram_${data.id}`
    const displayName = [data.first_name, data.last_name].filter(Boolean).join(' ')
    try {
      await firebaseAuth.getUser(userId)
    } catch (error: any) {
      if (error.code !== 'auth/user-not-found') throw error
      await firebaseAuth.createUser({ uid: userId, displayName, photoURL: data.photo_url })
    }
    await db.collection('telegramLinks').doc(userId).set({
      telegramUserId: data.id,
      username: data.username ?? null,
      chatId: data.id,
      updatedAt: new Date().toISOString()
    }, { merge: true })
    const customToken = await firebaseAuth.createCustomToken(userId, { provider: 'telegram' })
    return res.json({ customToken, username: data.username ?? data.first_name })
  } catch (error: any) {
    return res.status(400).json({ error: error.message ?? 'telegram_login_failed' })
  }
})

router.post('/bootstrap', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { username } = schema.parse(req.body)
    const userRecord = await firebaseAuth.getUser(req.userId!)
    const ref = db.collection('users').doc(req.userId!)
    const existing = await ref.get()

    if (!existing.exists) {
      const baseUsername = username ?? userRecord.email?.split('@')[0] ?? 'Giocatore'
      const duplicate = await db.collection('users').where('username', '==', baseUsername).limit(1).get()
      const finalUsername = duplicate.empty ? baseUsername : `${baseUsername}-${req.userId!.slice(0, 5)}`
      const user = { username: finalUsername, email: userRecord.email ?? '', avatar: userRecord.photoURL ?? null, createdAt: new Date().toISOString() }
      await ref.set(user)
      return res.status(201).json({ user: documentData(req.userId!, user) })
    }

    return res.json({ user: documentData(req.userId!, existing.data() as Record<string, unknown>) })
  } catch (error: any) {
    return res.status(400).json({ error: error.message ?? 'bootstrap_failed' })
  }
})

export default router
