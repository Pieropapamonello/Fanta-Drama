import { Request, Response, NextFunction } from 'express'
import { db, firebaseAuth } from '../services/firebase'
import { isFirestoreQuotaError } from '../services/errors'

export interface AuthRequest extends Request {
  userId?: string
  userProfile?: Record<string, unknown>
  userProfileExists?: boolean
}

const userResolutionCache = new Map<string, { userId: string, expiresAt: number }>()
const USER_RESOLUTION_TTL_MS = 5 * 60 * 1000

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const auth = req.headers.authorization
  if (!auth) return res.status(401).json({ error: 'missing_token' })
  const [scheme, token] = auth.split(' ')
  if (scheme !== 'Bearer' || !token) return res.status(401).json({ error: 'invalid_token' })
  let payload
  try {
    payload = await firebaseAuth.verifyIdToken(token)
  } catch {
    return res.status(401).json({ error: 'invalid_token' })
  }
  try {
    const cached = userResolutionCache.get(payload.uid)
    if (cached && cached.expiresAt > Date.now()) {
      req.userId = cached.userId
      return next()
    }
    const profile = await db.collection('users').doc(payload.uid).get()
    const resolvedUserId = typeof profile.data()?.mergedInto === 'string' ? String(profile.data()!.mergedInto) : payload.uid
    req.userId = resolvedUserId
    if (resolvedUserId === payload.uid) {
      req.userProfile = profile.data() as Record<string, unknown> | undefined
      req.userProfileExists = profile.exists
    }
    userResolutionCache.set(payload.uid, { userId: resolvedUserId, expiresAt: Date.now() + USER_RESOLUTION_TTL_MS })
    return next()
  } catch (err) {
    if (isFirestoreQuotaError(err)) return res.status(503).json({ error: 'firestore_quota_exhausted' })
    console.error('Authentication profile lookup failed', err)
    return res.status(503).json({ error: 'data_service_temporarily_unavailable' })
  }
}
