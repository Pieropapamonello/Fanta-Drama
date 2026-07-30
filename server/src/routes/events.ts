import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { db, documentData, groupRole } from '../services/firebase'
import { FieldValue } from 'firebase-admin/firestore'
import { notifyGroupMembers } from '../services/notifications'
import { createDramaBeat } from '../services/drama-director'
import { isPlatformAdmin } from '../services/platform-admin'
import { createEventAuctions, sendAuctionReminder } from '../services/auctions'
import { deleteDropboxAsset } from '../services/assets'

const router = Router()
const schema = z.object({ title: z.string().trim().min(1).max(120), description: z.string().trim().max(1000).optional(), startsAt: z.string().datetime(), endsAt: z.string().datetime(), groupId: z.string().min(1), acquisitionMode: z.enum(['AUCTION', 'DIRECT']).default('AUCTION'), cardKeys: z.array(z.string().regex(/^(starter|custom):[a-zA-Z0-9_-]+$/)).min(1).max(150), closePredictionsAt: z.string().datetime().optional(), imageUrl: z.string().url().max(2048).optional() })

function eventPhase(event: Record<string, unknown>) {
  // Dates are the source of truth. A missed background tick must never leave
  // an event marked LIVE the day after it ended.
  const now = Date.now()
  if (new Date(String(event.endsAt)).getTime() <= now) return 'CONCLUSO'
  if (event.state === 'PRONOSTICI_CHIUSI') return 'CONCLUSO'
  if (event.closePredictionsAt && new Date(String(event.closePredictionsAt)).getTime() <= now) return 'PRONOSTICI_CHIUSI'
  if (new Date(String(event.startsAt)).getTime() <= now) return 'LIVE'
  return 'IN_ARRIVO'
}

function withPhase(id: string, data: Record<string, unknown>) { return { ...documentData(id, data), phase: eventPhase(data) } }

async function participantsForEvent(eventId: string, event: Record<string, unknown>) {
  const [auctions, purchases] = await Promise.all([db.collection('auctions').where('eventId', '==', eventId).get(), db.collection('eventCardPurchases').where('eventId', '==', eventId).get()])
  const memberIds = (event.participantIds as string[] | undefined) ?? []
  const users = await Promise.all(memberIds.map((userId) => db.collection('users').doc(userId).get()))
  return users.map((user, index) => {
    const userId = memberIds[index]; const profile = user.data() ?? {}
    const auctionCards = auctions.docs.filter((auction) => auction.data().ownerId === userId || (auction.data().status === 'OPEN' && auction.data().leaderId === userId)).map((auction) => {
      const data = auction.data()
      return { id: auction.id, title: data.title ?? 'Carta drama', description: data.description ?? '', imageUrl: data.imageUrl ?? '', rarity: data.rarity ?? 'COMMON', state: data.status === 'WON' ? 'Vinta' : 'Offerta in testa' }
    })
    const directCards = purchases.docs.filter((purchase) => purchase.data().userId === userId).map((purchase) => { const data = purchase.data(); return { id: purchase.id, title: data.title ?? 'Carta drama', description: data.description ?? '', imageUrl: data.imageUrl ?? '', rarity: data.rarity ?? 'COMMON', state: 'Acquistata' } })
    const cards = [...auctionCards, ...directCards]
    return { userId, username: profile.username ?? 'Giocatore', avatar: profile.avatar ?? '', crewRole: profile.crewRole ?? 'Jolly', bio: profile.bio ?? '', city: profile.city ?? '', motto: profile.motto ?? '', cards }
  })
}

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
    if (data.acquisitionMode === 'AUCTION' && new Date(data.startsAt).getTime() < Date.now() + 60 * 60 * 1000) return res.status(400).json({ error: 'event_needs_one_hour_auction' })
    if (data.acquisitionMode === 'DIRECT' && new Date(data.startsAt).getTime() <= Date.now()) return res.status(400).json({ error: 'event_must_start_in_future' })
    const ref = db.collection('events').doc()
    const event = { ...data, description: data.description ?? '', state: 'PRONOSTICI_APERTI', participantIds: [req.userId!], createdBy: req.userId!, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    await ref.set(event)
    const auctionCount = await createEventAuctions(ref.id, event)
    void announceNewEvent(ref.id, event, req.userId!)
    return res.status(201).json({ event: { ...documentData(ref.id, event), auctionCount } })
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
  void sendAuctionReminder(snapshot.id)
  const event = snapshot.data() as Record<string, unknown>
  const group = await db.collection('groups').doc(String(event.groupId)).get()
  const groupMember = ((group.data()?.memberIds as string[] | undefined) ?? []).includes(req.userId!) || await isPlatformAdmin(req.userId!)
  const participantIds = (event.participantIds as string[] | undefined) ?? []
  return res.json({ event: { ...withPhase(snapshot.id, event), participants: await participantsForEvent(snapshot.id, event), isCurrentUserParticipant: participantIds.includes(req.userId!), canJoin: groupMember && !participantIds.includes(req.userId!) && eventPhase(event) !== 'CONCLUSO', canManage: await groupRole(String(event.groupId), req.userId!) === 'ADMIN' || await isPlatformAdmin(req.userId!) } })
})

router.post('/:id/join', requireAuth, async (req: AuthRequest, res) => {
  const ref = db.collection('events').doc(req.params.id); const event = await ref.get()
  if (!event.exists || (!await groupRole(String(event.data()?.groupId), req.userId!) && !await isPlatformAdmin(req.userId!))) return res.status(404).json({ error: 'event_not_found' })
  if (eventPhase(event.data() as Record<string, unknown>) === 'CONCLUSO') return res.status(409).json({ error: 'event_finished' })
  await ref.update({ participantIds: FieldValue.arrayUnion(req.userId!), updatedAt: new Date().toISOString() })
  void notifyGroupMembers(String(event.data()?.groupId), { kind: 'EVENT_JOINED', title: `Nuovo partecipante · ${event.data()?.title}`, message: 'Un membro della crew è entrato nella sfida.', path: `/events/${event.id}` }, [req.userId!])
  return res.json({ ok: true })
})

router.delete('/:id', requireAuth, async (req: AuthRequest, res) => {
  const ref = db.collection('events').doc(req.params.id); const event = await ref.get()
  if (!event.exists) return res.status(404).json({ error: 'not_found' })
  if (await groupRole(String(event.data()?.groupId), req.userId!) !== 'ADMIN' && !await isPlatformAdmin(req.userId!)) return res.status(403).json({ error: 'admin_required' })
  const [auctions, purchases, predictions, scores, claims, eventCards] = await Promise.all([
    db.collection('auctions').where('eventId', '==', event.id).get(), db.collection('eventCardPurchases').where('eventId', '==', event.id).get(), db.collection('predictions').where('eventId', '==', event.id).get(), db.collection('scores').where('eventId', '==', event.id).get(), db.collection('cardClaims').where('eventId', '==', event.id).get(), db.collection('cardCatalog').where('eventId', '==', event.id).get()
  ])
  const refs = [ref, ...auctions.docs.map(x => x.ref), ...purchases.docs.map(x => x.ref), ...predictions.docs.map(x => x.ref), ...scores.docs.map(x => x.ref), ...claims.docs.map(x => x.ref), ...eventCards.docs.map(x => x.ref)]
  while (refs.length) { const batch = db.batch(); refs.splice(0, 400).forEach(item => batch.delete(item)); await batch.commit() }
  await Promise.allSettled(eventCards.docs.map(card => deleteDropboxAsset(typeof card.data().imageStoragePath === 'string' ? card.data().imageStoragePath : undefined)))
  return res.json({ ok: true })
})

router.get('/:id/leaderboard', requireAuth, async (req: AuthRequest, res) => {
  const eventSnapshot = await db.collection('events').doc(req.params.id).get()
  if (!eventSnapshot.exists || (!await groupRole(eventSnapshot.data()!.groupId, req.userId!) && !await isPlatformAdmin(req.userId!))) return res.status(404).json({ error: 'not_found' })
  const [scores, group] = await Promise.all([
    db.collection('scores').where('eventId', '==', eventSnapshot.id).get(),
    db.collection('groups').doc(String(eventSnapshot.data()!.groupId)).get()
  ])
  const entries = await Promise.all(((eventSnapshot.data()?.participantIds as string[] | undefined) ?? []).map(async (userId) => {
    const user = await db.collection('users').doc(userId).get()
    const score = scores.docs.find((doc) => doc.data().userId === userId)?.data()
    return { userId, username: user.data()?.username ?? 'Giocatore', avatar: user.data()?.avatar ?? '', points: Number(score?.points ?? 0) }
  }))
  return res.json({ leaderboard: entries.sort((left, right) => right.points - left.points || left.username.localeCompare(right.username, 'it')) })
})

export default router
