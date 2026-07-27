import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { db, documentData, groupRole } from '../services/firebase'

const router = Router()
const schema = z.object({ eventId: z.string().min(1), cardId: z.string().min(1), value: z.unknown(), credits: z.number().int().min(0).max(100), joker: z.boolean().optional() })

router.post('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const data = schema.parse(req.body)
    const eventSnapshot = await db.collection('events').doc(data.eventId).get()
    if (!eventSnapshot.exists || !await groupRole(eventSnapshot.data()!.groupId, req.userId!)) return res.status(404).json({ error: 'event_not_found' })
    const event = eventSnapshot.data()!
    if (event.state !== 'PRONOSTICI_APERTI' || (event.closePredictionsAt && new Date(event.closePredictionsAt) <= new Date())) return res.status(409).json({ error: 'predictions_closed' })
    const card = await db.collection('cards').doc(data.cardId).get()
    if (!card.exists) return res.status(404).json({ error: 'card_not_found' })

    const existing = await db.collection('predictions').where('eventId', '==', data.eventId).get()
    const spent = existing.docs.filter((doc) => doc.data().userId === req.userId!).reduce((total, doc) => total + Number(doc.data().credits ?? 0), 0)
    const predictionId = `${req.userId!}_${data.eventId}_${data.cardId}`
    const previous = await db.collection('predictions').doc(predictionId).get()
    const previousCredits = previous.exists ? Number(previous.data()?.credits ?? 0) : 0
    if (spent - previousCredits + data.credits > 100) return res.status(409).json({ error: 'credits_exceeded' })

    const prediction = { userId: req.userId!, ...data, joker: data.joker ?? false, resolved: false, points: null, createdAt: new Date().toISOString() }
    await db.collection('predictions').doc(predictionId).set(prediction)
    return res.status(previous.exists ? 200 : 201).json({ prediction: documentData(predictionId, prediction) })
  } catch (error: any) { return res.status(400).json({ error: error.message ?? 'invalid_prediction' }) }
})

router.get('/event/:eventId', requireAuth, async (req: AuthRequest, res) => {
  const event = await db.collection('events').doc(req.params.eventId).get()
  if (!event.exists || !await groupRole(event.data()!.groupId, req.userId!)) return res.status(404).json({ error: 'not_found' })
  const snapshot = await db.collection('predictions').where('eventId', '==', req.params.eventId).get()
  const predictions = snapshot.docs.filter((doc) => doc.data().userId === req.userId!).map((doc) => documentData(doc.id, doc.data() as Record<string, unknown>))
  return res.json({ predictions })
})

export default router
