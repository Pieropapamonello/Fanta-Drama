import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { db, documentData, groupRole } from '../services/firebase'

const router = Router()
const schema = z.object({ title: z.string().trim().min(1).max(120), description: z.string().trim().max(1000).optional(), startsAt: z.string().datetime(), endsAt: z.string().datetime(), groupId: z.string().min(1), closePredictionsAt: z.string().datetime().optional() })

router.post('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const data = schema.parse(req.body)
    if (await groupRole(data.groupId, req.userId!) !== 'ADMIN') return res.status(403).json({ error: 'admin_required' })
    if (new Date(data.endsAt) <= new Date(data.startsAt)) return res.status(400).json({ error: 'invalid_dates' })
    const ref = db.collection('events').doc()
    const event = { ...data, description: data.description ?? '', state: 'PRONOSTICI_APERTI', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    await ref.set(event)
    return res.status(201).json({ event: documentData(ref.id, event) })
  } catch (error: any) { return res.status(400).json({ error: error.message ?? 'invalid_event' }) }
})

router.get('/', requireAuth, async (req: AuthRequest, res) => {
  const requestedGroupId = typeof req.query.groupId === 'string' ? req.query.groupId : undefined
  const groups = await db.collection('groups').where('memberIds', 'array-contains', req.userId!).get()
  const allowed = new Set(groups.docs.map((doc) => doc.id))
  if (requestedGroupId && !allowed.has(requestedGroupId)) return res.json({ events: [] })
  const snapshot = requestedGroupId ? await db.collection('events').where('groupId', '==', requestedGroupId).get() : await db.collection('events').get()
  const events = snapshot.docs.filter((doc) => allowed.has(doc.data().groupId)).map((doc) => documentData(doc.id, doc.data() as Record<string, unknown>))
  return res.json({ events })
})

router.get('/:id', requireAuth, async (req: AuthRequest, res) => {
  const snapshot = await db.collection('events').doc(req.params.id).get()
  if (!snapshot.exists || !await groupRole(snapshot.data()!.groupId, req.userId!)) return res.status(404).json({ error: 'not_found' })
  return res.json({ event: documentData(snapshot.id, snapshot.data() as Record<string, unknown>) })
})

export default router
