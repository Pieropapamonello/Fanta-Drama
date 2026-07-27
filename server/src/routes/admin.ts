import { Router } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { db, groupRole } from '../services/firebase'

const router = Router()

router.post('/events/:id/close', requireAuth, async (req: AuthRequest, res) => {
  const eventRef = db.collection('events').doc(req.params.id)
  const eventSnapshot = await eventRef.get()
  if (!eventSnapshot.exists) return res.status(404).json({ error: 'event_not_found' })
  if (await groupRole(eventSnapshot.data()!.groupId, req.userId!) !== 'ADMIN') return res.status(403).json({ error: 'admin_required' })

  const predictions = await db.collection('predictions').where('eventId', '==', eventSnapshot.id).get()
  const cards = await Promise.all(predictions.docs.map((prediction) => db.collection('cards').doc(prediction.data().cardId).get()))
  const totals = new Map<string, number>()
  const batch = db.batch()
  predictions.docs.forEach((prediction, index) => {
    const points = Number(cards[index].data()?.basePoints ?? 0) + Number(prediction.data().credits ?? 0)
    const userId = prediction.data().userId as string
    totals.set(userId, (totals.get(userId) ?? 0) + points)
    batch.update(prediction.ref, { resolved: true, points })
  })
  batch.update(eventRef, { state: 'PRONOSTICI_CHIUSI', updatedAt: new Date().toISOString() })
  for (const [userId, points] of totals) {
    batch.set(db.collection('scores').doc(`${userId}_${eventSnapshot.id}`), { userId, eventId: eventSnapshot.id, points, breakdown: { formula: 'base_points_plus_credits' }, createdAt: new Date().toISOString() })
  }
  await batch.commit()
  return res.json({ ok: true })
})

export default router
