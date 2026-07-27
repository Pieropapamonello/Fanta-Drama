import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { db, documentData, firebaseAuth } from '../services/firebase'

const router = Router()
const schema = z.object({ username: z.string().trim().min(3).max(30).optional() })

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
