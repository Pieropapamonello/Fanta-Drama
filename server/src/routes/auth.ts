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
const telegramMiniAppSchema = z.object({ initData: z.string().min(1).max(8192) })

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

function isValidTelegramMiniApp(initData: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return null
  const params = new URLSearchParams(initData)
  const receivedHash = params.get('hash')
  const authDate = Number(params.get('auth_date'))
  const rawUser = params.get('user')
  if (!receivedHash || !rawUser || !Number.isFinite(authDate) || Math.abs(Math.floor(Date.now() / 1000) - authDate) > 10 * 60) return null
  params.delete('hash')
  const checkString = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join('\n')
  const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest()
  const expected = crypto.createHmac('sha256', secret).update(checkString).digest('hex')
  if (receivedHash.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(receivedHash))) return null
  try {
    const user = JSON.parse(rawUser) as { id?: number, first_name?: string, last_name?: string, username?: string, photo_url?: string }
    return user.id && user.first_name ? user : null
  } catch { return null }
}

async function telegramCustomToken(user: { id: number, first_name: string, last_name?: string, username?: string, photo_url?: string }) {
  const userId = `telegram_${user.id}`
  const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ')
  try {
    await firebaseAuth.getUser(userId)
  } catch (error: any) {
    if (error.code !== 'auth/user-not-found') throw error
    await firebaseAuth.createUser({ uid: userId, displayName, photoURL: user.photo_url })
  }
  await db.collection('telegramLinks').doc(userId).set({ telegramUserId: String(user.id), username: user.username ?? null, chatId: String(user.id), updatedAt: new Date().toISOString() }, { merge: true })
  return { customToken: await firebaseAuth.createCustomToken(userId, { provider: 'telegram' }), username: user.username ?? user.first_name }
}

router.post('/telegram', async (req, res) => {
  try {
    const data = telegramSchema.parse(req.body)
    const authAgeSeconds = Math.floor(Date.now() / 1000) - Number(data.auth_date)
    if (authAgeSeconds < -60 || authAgeSeconds > 10 * 60 || !isValidTelegramLogin(data)) {
      return res.status(401).json({ error: 'invalid_telegram_login' })
    }

    return res.json(await telegramCustomToken({ id: Number(data.id), first_name: data.first_name, last_name: data.last_name, username: data.username, photo_url: data.photo_url }))
  } catch (error: any) {
    return res.status(400).json({ error: error.message ?? 'telegram_login_failed' })
  }
})

router.post('/telegram-miniapp', async (req, res) => {
  try {
    const { initData } = telegramMiniAppSchema.parse(req.body)
    const user = isValidTelegramMiniApp(initData)
    if (!user) {
      console.error('Telegram Mini App authentication failed: invalid initData')
      return res.status(401).json({ error: 'invalid_telegram_miniapp' })
    }
    return res.json(await telegramCustomToken({ id: user.id!, first_name: user.first_name!, last_name: user.last_name, username: user.username, photo_url: user.photo_url }))
  } catch (error: any) {
    console.error('Telegram Mini App authentication failed', error.message ?? error)
    return res.status(400).json({ error: error.message ?? 'telegram_miniapp_failed' })
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
