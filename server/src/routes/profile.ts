import { Router } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { db, documentData } from '../services/firebase'

const router = Router()

router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  const snapshot = await db.collection('users').doc(req.userId!).get()
  if (!snapshot.exists) return res.status(404).json({ error: 'not_found' })
  return res.json({ user: documentData(snapshot.id, snapshot.data() as Record<string, unknown>) })
})

export default router
