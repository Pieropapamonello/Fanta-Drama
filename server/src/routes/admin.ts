import { Router } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { db, groupRole } from '../services/firebase'
import { closeAndScoreEvent } from '../services/scoring'

const router = Router()

router.post('/events/:id/close', requireAuth, async (req: AuthRequest, res) => {
  try {
    const eventSnapshot = await db.collection('events').doc(req.params.id).get()
    if (!eventSnapshot.exists) return res.status(404).json({ error: 'event_not_found' })
    if (await groupRole(eventSnapshot.data()!.groupId, req.userId!) !== 'ADMIN') return res.status(403).json({ error: 'admin_required' })
    const result = await closeAndScoreEvent(eventSnapshot.id, 'manual')
    return res.json({ ok: true, alreadyClosed: result.alreadyClosed, scoredUsers: result.totals.size })
  } catch (error: any) { return res.status(400).json({ error: error.message ?? 'close_failed' }) }
})

export default router
