import { Request, Response, NextFunction } from 'express'
import { db, firebaseAuth } from '../services/firebase'

export interface AuthRequest extends Request {
  userId?: string
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const auth = req.headers.authorization
  if (!auth) return res.status(401).json({ error: 'missing_token' })
  const [scheme, token] = auth.split(' ')
  if (scheme !== 'Bearer' || !token) return res.status(401).json({ error: 'invalid_token' })
  try {
    const payload = await firebaseAuth.verifyIdToken(token)
    const profile = await db.collection('users').doc(payload.uid).get()
    req.userId = typeof profile.data()?.mergedInto === 'string' ? profile.data()!.mergedInto : payload.uid
    next()
  } catch (err) {
    return res.status(401).json({ error: 'invalid_token' })
  }
}
