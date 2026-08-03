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
const telegramLoginTicketSchema = z.object({ ticket: z.string().regex(/^[A-Za-z0-9_-]{32,128}$/) })

const appUrl = (process.env.PUBLIC_APP_URL || 'https://fanta-drama.onrender.com').replace(/\/$/, '')
const telegramLoginCallbackUrl = process.env.TELEGRAM_LOGIN_REDIRECT_URL || `${appUrl}/api/auth/telegram/oidc/callback`

function randomUrlToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url')
}

function telegramLoginConfig() {
  const clientId = process.env.TELEGRAM_LOGIN_CLIENT_ID
  const clientSecret = process.env.TELEGRAM_LOGIN_CLIENT_SECRET
  return clientId && clientSecret ? { clientId, clientSecret } : null
}

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
  if (!receivedHash || !rawUser || !Number.isFinite(authDate) || Math.abs(Math.floor(Date.now() / 1000) - authDate) > 24 * 60 * 60) return null
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
  const existingLink = await db.collection('telegramLinks').where('telegramUserId', '==', String(user.id)).limit(1).get()
  const userId = existingLink.empty ? `telegram_${user.id}` : existingLink.docs[0].id
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

// Browser login: Telegram is used only for authorization, then redirects back
// to FantaDrama. This is intentionally separate from Mini App authentication.
router.get('/telegram/oidc/start', async (_req, res) => {
  const config = telegramLoginConfig()
  if (!config) return res.redirect(`${appUrl}/login?telegram_error=not_configured`)
  const state = randomUrlToken()
  const codeVerifier = randomUrlToken(48)
  const nonce = randomUrlToken()
  const challenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url')
  await db.collection('telegramOidcRequests').doc(state).set({
    codeVerifier, nonce, redirectUri: telegramLoginCallbackUrl,
    createdAt: new Date().toISOString(), expiresAt: Date.now() + 10 * 60 * 1000
  })
  const params = new URLSearchParams({
    client_id: config.clientId, redirect_uri: telegramLoginCallbackUrl, response_type: 'code',
    scope: 'openid profile telegram:bot_access', state, nonce,
    code_challenge: challenge, code_challenge_method: 'S256'
  })
  return res.redirect(`https://oauth.telegram.org/auth?${params.toString()}`)
})

router.get('/telegram/oidc/callback', async (req, res) => {
  const error = typeof req.query.error === 'string' ? req.query.error : null
  const state = typeof req.query.state === 'string' ? req.query.state : ''
  const code = typeof req.query.code === 'string' ? req.query.code : ''
  if (error || !state || !code) return res.redirect(`${appUrl}/login?telegram_error=${encodeURIComponent(error || 'cancelled')}`)
  const config = telegramLoginConfig()
  if (!config) return res.redirect(`${appUrl}/login?telegram_error=not_configured`)
  try {
    const requestRef = db.collection('telegramOidcRequests').doc(state)
    const request = await requestRef.get()
    const pending = request.data() as { codeVerifier?: string, nonce?: string, redirectUri?: string, expiresAt?: number } | undefined
    await requestRef.delete()
    if (!pending?.codeVerifier || !pending.redirectUri || !pending.expiresAt || pending.expiresAt < Date.now()) throw new Error('expired_request')
    const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')
    const tokenResponse = await fetch('https://oauth.telegram.org/token', {
      method: 'POST',
      headers: { authorization: `Basic ${basic}`, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: pending.redirectUri, client_id: config.clientId, code_verifier: pending.codeVerifier }).toString()
    })
    const tokenPayload = await tokenResponse.json() as { id_token?: string }
    if (!tokenResponse.ok || !tokenPayload.id_token) throw new Error('token_exchange_failed')
    const [headerPart, payloadPart, signaturePart] = tokenPayload.id_token.split('.')
    if (!headerPart || !payloadPart || !signaturePart) throw new Error('invalid_id_token')
    const header = JSON.parse(Buffer.from(headerPart, 'base64url').toString('utf8')) as { alg?: string, kid?: string }
    const claims = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8')) as { iss?: string, aud?: string | string[], exp?: number, nonce?: string, id?: number | string, given_name?: string, family_name?: string, preferred_username?: string, picture?: string }
    const keysResponse = await fetch('https://oauth.telegram.org/.well-known/jwks.json')
    const keysPayload = await keysResponse.json() as { keys?: Array<crypto.JsonWebKey & { kid?: string }> }
    const key = keysPayload.keys?.find((item) => item.kid === header.kid)
    const validSignature = header.alg === 'RS256' && key && crypto.verify('RSA-SHA256', Buffer.from(`${headerPart}.${payloadPart}`), crypto.createPublicKey({ key, format: 'jwk' }), Buffer.from(signaturePart, 'base64url'))
    const audience = Array.isArray(claims.aud) ? claims.aud.includes(config.clientId) : claims.aud === config.clientId
    if (!validSignature || claims.iss !== 'https://oauth.telegram.org' || !audience || !claims.exp || claims.exp * 1000 < Date.now() || claims.nonce !== pending.nonce || !claims.id || !claims.given_name) throw new Error('invalid_id_token')
    const login = await telegramCustomToken({ id: Number(claims.id), first_name: claims.given_name, last_name: claims.family_name, username: claims.preferred_username, photo_url: claims.picture })
    const ticket = randomUrlToken()
    await db.collection('telegramLoginTickets').doc(ticket).set({ ...login, createdAt: new Date().toISOString(), expiresAt: Date.now() + 2 * 60 * 1000, usedAt: null })
    return res.redirect(`${appUrl}/telegram?ticket=${encodeURIComponent(ticket)}`)
  } catch (callbackError) {
    console.error('Telegram OIDC login failed', callbackError)
    return res.redirect(`${appUrl}/login?telegram_error=failed`)
  }
})

router.post('/telegram/complete', async (req, res) => {
  try {
    const { ticket } = telegramLoginTicketSchema.parse(req.body)
    const ticketRef = db.collection('telegramLoginTickets').doc(ticket)
    const login = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ticketRef)
      const data = snapshot.data() as { customToken?: string, username?: string, expiresAt?: number, usedAt?: string | null } | undefined
      if (!snapshot.exists || !data?.customToken || data.usedAt || !data.expiresAt || data.expiresAt < Date.now()) throw new Error('invalid_ticket')
      transaction.update(ticketRef, { usedAt: new Date().toISOString() })
      return { customToken: data.customToken, username: data.username }
    })
    return res.json(login)
  } catch {
    return res.status(401).json({ error: 'invalid_telegram_ticket' })
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
      const user = { username: finalUsername, email: userRecord.email ?? '', avatar: null, bio: '', city: '', crewRole: 'Jolly', motto: '', notificationPreference: 'ALL', notificationChannels: ['DEVICE', 'TELEGRAM'], credits: 1000, profileCompleted: false, createdAt: new Date().toISOString() }
      await ref.set(user)
      return res.status(201).json({ user: documentData(req.userId!, user) })
    }

    return res.json({ user: documentData(req.userId!, existing.data() as Record<string, unknown>) })
  } catch (error: any) {
    return res.status(400).json({ error: error.message ?? 'bootstrap_failed' })
  }
})

export default router
