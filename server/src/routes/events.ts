import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { db, documentData, groupRole } from '../services/firebase'
import { notifyGroupMembers } from '../services/notifications'
import { createDramaBeat } from '../services/drama-director'
import { isPlatformAdmin } from '../services/platform-admin'

const router = Router()
const schema = z.object({ title: z.string().trim().min(1).max(120), description: z.string().trim().max(1000).optional(), startsAt: z.string().datetime(), endsAt: z.string().datetime(), groupId: z.string().min(1), closePredictionsAt: z.string().datetime().optional(), imageUrl: z.string().url().max(2048).optional() })

function eventPhase(event: Record<string, unknown>) {
  if (event.state === 'PRONOSTICI_CHIUSI') return 'CONCLUSO'
  const now = Date.now()
  if (new Date(String(event.endsAt)).getTime() <= now) return 'IN_VALUTAZIONE'
  if (event.closePredictionsAt && new Date(String(event.closePredictionsAt)).getTime() <= now) return 'PRONOSTICI_CHIUSI'
  if (new Date(String(event.startsAt)).getTime() <= now) return 'LIVE'
  return 'IN_ARRIVO'
}

function withPhase(id: string, data: Record<string, unknown>) { return { ...documentData(id, data), phase: eventPhase(data) } }

async function announceNewEvent(eventId: string, event: Record<string, unknown>, excludedUserId: string) {
  const liveUpdate = await createDramaBeat({ event: { title: String(event.title), description: String(event.description ?? '') }, phase: 'OPENED' })
  await db.collection('events').doc(eventId).set({ liveUpdate, liveUpdateAt: new Date().toISOString() }, { merge: true })
  await notifyGroupMembers(String(event.groupId), {
    kind: 'EVENT_CREATED',
    title: `Nuovo evento · ${String(event.title)}`,
    message: liveUpdate,
    path: `/events/${eventId}`
  }, [excludedUserId])
}

router.post('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const data = schema.parse(req.body)
    if (await groupRole(data.groupId, req.userId!) !== 'ADMIN' && !await isPlatformAdmin(req.userId!)) return res.status(403).json({ error: 'admin_required' })
    if (new Date(data.endsAt) <= new Date(data.startsAt)) return res.status(400).json({ error: 'invalid_dates' })
    const ref = db.collection('events').doc()
    const event = { ...data, description: data.description ?? '', state: 'PRONOSTICI_APERTI', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    await ref.set(event)
    void announceNewEvent(ref.id, event, req.userId!)
    return res.status(201).json({ event: documentData(ref.id, event) })
  } catch (error: any) { return res.status(400).json({ error: error.message ?? 'invalid_event' }) }
})

router.get('/', requireAuth, async (req: AuthRequest, res) => {
  const requestedGroupId = typeof req.query.groupId === 'string' ? req.query.groupId : undefined
  const platformAdmin = await isPlatformAdmin(req.userId!)
  const groups = platformAdmin ? await db.collection('groups').get() : await db.collection('groups').where('memberIds', 'array-contains', req.userId!).get()
  const allowed = new Set(groups.docs.map((doc) => doc.id))
  if (requestedGroupId && !allowed.has(requestedGroupId)) return res.json({ events: [] })
  const snapshot = requestedGroupId ? await db.collection('events').where('groupId', '==', requestedGroupId).get() : await db.collection('events').get()
  const events = snapshot.docs.filter((doc) => allowed.has(doc.data().groupId)).map((doc) => withPhase(doc.id, doc.data() as Record<string, unknown>))
  return res.json({ events })
})

router.get('/:id', requireAuth, async (req: AuthRequest, res) => {
  const snapshot = await db.collection('events').doc(req.params.id).get()
  if (!snapshot.exists || (!await groupRole(snapshot.data()!.groupId, req.userId!) && !await isPlatformAdmin(req.userId!))) return res.status(404).json({ error: 'not_found' })
  return res.json({ event: withPhase(snapshot.id, snapshot.data() as Record<string, unknown>) })
})

router.get('/:id/leaderboard', requireAuth, async (req: AuthRequest, res) => {
  const eventSnapshot = await db.collection('events').doc(req.params.id).get()
  if (!eventSnapshot.exists || (!await groupRole(eventSnapshot.data()!.groupId, req.userId!) && !await isPlatformAdmin(req.userId!))) return res.status(404).json({ error: 'not_found' })
  const [scores, group] = await Promise.all([
    db.collection('scores').where('eventId', '==', eventSnapshot.id).get(),
    db.collection('groups').doc(String(eventSnapshot.data()!.groupId)).get()
  ])
  const entries = await Promise.all(((group.data()?.memberIds as string[] | undefined) ?? []).map(async (userId) => {
    const user = await db.collection('users').doc(userId).get()
    const score = scores.docs.find((doc) => doc.data().userId === userId)?.data()
    return { userId, username: user.data()?.username ?? 'Giocatore', avatar: user.data()?.avatar ?? '', points: Number(score?.points ?? 0) }
  }))
  return res.json({ leaderboard: entries.sort((left, right) => right.points - left.points || left.username.localeCompare(right.username, 'it')) })
})

export default router
