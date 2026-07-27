import { Request, Response, NextFunction } from 'express'
import { firebaseAuth } from '../services/firebase'

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
    req.userId = payload.uid
    next()
  } catch (err) {
    return res.status(401).json({ error: 'invalid_token' })
  }
}
