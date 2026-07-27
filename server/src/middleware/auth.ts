import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { getJwtSecret } from '../config/auth'

export interface AuthRequest extends Request {
  userId?: string
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const auth = req.headers.authorization
  if (!auth) return res.status(401).json({ error: 'missing_token' })
  const token = auth.split(' ')[1]
  try {
    const payload = jwt.verify(token, getJwtSecret()) as { userId?: string }
    if (!payload.userId) return res.status(401).json({ error: 'invalid_token' })
    req.userId = payload.userId
    next()
  } catch (err) {
    return res.status(401).json({ error: 'invalid_token' })
  }
}
