import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { db, documentData, firebaseAuth, groupRole } from '../services/firebase'
import { closeAndScoreEvent } from '../services/scoring'
import { grantPlatformAdmin, isPlatformAdmin, isValidAdminPassword, revokePlatformAdmin } from '../services/platform-admin'
import { deleteDropboxAsset } from '../services/assets'
import { playEventCard, rewardClaim } from './claims'
import { starterCards } from '../data/starter-content'
import { DEFAULT_DIRECT_CARD_PRICE } from '../services/auctions'

const router = Router()
const passwordSchema = z.object({ password: z.string().min(1).max(256) })
const mergeSchema = z.object({ primaryId: z.string().min(1), secondaryId: z.string().min(1) }).refine((value) => value.primaryId !== value.secondaryId)
const appealDecisionSchema = z.object({ decision: z.enum(['CONFIRMED', 'DENIED']), note: z.string().trim().max(1000).optional() })
const adminPlaySchema = z.object({ userId: z.string().min(1), auctionId: z.string().min(1), note: z.string().trim().max(500).optional() })

async function requirePlatformAdmin(req: AuthRequest, res: any, next: any) {
  if (!req.userId || !await isPlatformAdmin(req.userId)) return res.status(403).json({ error: 'platform_admin_required' })
  next()
}

router.get('/status', requireAuth, async (req: AuthRequest, res) => res.json({ isAdmin: await isPlatformAdmin(req.userId!) }))

// A separate, password-only Firebase identity is used for the administration
// console. It never requires or promotes a player account.
router.post('/password-login', async (req, res) => {
  const configured = process.env.ADMIN_PASSWORD
  if (!configured) return res.status(503).json({ error: 'admin_password_not_configured' })
  const { password } = passwordSchema.parse(req.body)
  if (!isValidAdminPassword(password)) return res.status(401).json({ error: 'invalid_admin_password' })
  const adminId = 'fantadrama_platform_admin'
  await grantPlatformAdmin(adminId, 'PASSWORD')
  const customToken = await firebaseAuth.createCustomToken(adminId, { platformAdmin: true })
  return res.json({ customToken })
})

router.post('/unlock', requireAuth, async (req: AuthRequest, res) => {
  const configured = process.env.ADMIN_PASSWORD
  if (!configured) return res.status(503).json({ error: 'admin_password_not_configured' })
  const { password } = passwordSchema.parse(req.body)
  if (!isValidAdminPassword(password)) return res.status(401).json({ error: 'invalid_admin_password' })
  await grantPlatformAdmin(req.userId!, 'WEB')
  return res.json({ ok: true })
})

router.post('/lock', requireAuth, async (req: AuthRequest, res) => {
  await revokePlatformAdmin(req.userId!)
  return res.json({ ok: true })
})

router.get('/overview', requireAuth, requirePlatformAdmin, async (_req, res) => {
  const [groups, users, events, cards, appeals, priceOverrides] = await Promise.all([db.collection('groups').get(), db.collection('users').get(), db.collection('events').get(), db.collection('cardCatalog').get(), db.collection('appeals').where('status', '==', 'OPEN').get(), db.collection('cardPriceOverrides').get()])
  const groupNames = new Map(groups.docs.map((group) => [group.id, String(group.data().name ?? 'Gruppo senza nome')]))
  const starterPrice = new Map(priceOverrides.docs.map((item) => [String(item.data().cardKey ?? ''), Number(item.data().directPrice ?? DEFAULT_DIRECT_CARD_PRICE)]))
  return res.json({
    stats: { groups: groups.size, users: users.size, events: events.size, cards: cards.size },
    groups: groups.docs.map((group) => documentData(group.id, { ...group.data(), memberCount: Array.isArray(group.data().memberIds) ? group.data().memberIds.length : 0 })),
    events: events.docs.map((event) => documentData(event.id, { ...event.data(), groupName: groupNames.get(String(event.data().groupId)) ?? 'Gruppo eliminato' })),
    users: users.docs.map((user) => documentData(user.id, user.data() as Record<string, unknown>)),
    cards: cards.docs.map((card) => documentData(card.id, card.data() as Record<string, unknown>)),
    starterCards: starterCards.filter((card) => Boolean(card.imageUrl)).map((card) => ({ ...card, cardKey: `starter:${card.slug}`, directPrice: starterPrice.get(`starter:${card.slug}`) ?? DEFAULT_DIRECT_CARD_PRICE })),
    appeals: appeals.docs.map((appeal) => documentData(appeal.id, appeal.data() as Record<string, unknown>))
  })
})

router.get('/events/:id/unplayed-cards', requireAuth, requirePlatformAdmin, async (req: AuthRequest, res) => {
  const event = await db.collection('events').doc(req.params.id).get()
  if (!event.exists) return res.status(404).json({ error: 'event_not_found' })
  const eventData = event.data()!
  const participantIds = (eventData.participantIds as string[] | undefined) ?? []
  const [auctions, purchases, profiles] = await Promise.all([
    db.collection('auctions').where('eventId', '==', event.id).get(),
    db.collection('eventCardPurchases').where('eventId', '==', event.id).get(),
    Promise.all(participantIds.map((userId) => db.collection('users').doc(userId).get()))
  ])
  const users = new Map(profiles.map((profile) => [profile.id, profile.data() ?? {}]))
  const auctionById = new Map(auctions.docs.map((auction) => [auction.id, auction.data()]))
  const cards: Array<Record<string, unknown>> = []
  purchases.docs.forEach((purchase) => {
    const data = purchase.data(); const auction = auctionById.get(String(data.auctionId))
    if (!auction || data.playedAt || !participantIds.includes(String(data.userId))) return
    const user = users.get(String(data.userId)) ?? {}
    cards.push({ auctionId: String(data.auctionId), userId: String(data.userId), username: user.username ?? 'Giocatore', avatar: user.avatar ?? null, title: auction.title ?? data.title ?? 'Carta evento', imageUrl: auction.imageUrl ?? null, description: auction.description ?? '', rarity: auction.rarity ?? 'COMMON', points: Number(data.price ?? auction.directPrice ?? 0), acquisitionMode: 'DIRECT' })
  })
  auctions.docs.forEach((auctionDoc) => {
    const auction = auctionDoc.data(); const ownerId = String(auction.ownerId ?? '')
    if (auction.acquisitionMode === 'DIRECT' || auction.playedAt || auction.status !== 'WON' || !ownerId || !participantIds.includes(ownerId)) return
    const user = users.get(ownerId) ?? {}
    cards.push({ auctionId: auctionDoc.id, userId: ownerId, username: user.username ?? 'Giocatore', avatar: user.avatar ?? null, title: auction.title ?? 'Carta evento', imageUrl: auction.imageUrl ?? null, description: auction.description ?? '', rarity: auction.rarity ?? 'COMMON', points: Number(auction.currentBid ?? 0), acquisitionMode: 'AUCTION' })
  })
  return res.json({ event: documentData(event.id, eventData as Record<string, unknown>), cards })
})

router.post('/events/:id/play-card', requireAuth, requirePlatformAdmin, async (req: AuthRequest, res) => {
  try {
    const event = await db.collection('events').doc(req.params.id).get()
    if (!event.exists) return res.status(404).json({ error: 'event_not_found' })
    const data = adminPlaySchema.parse(req.body)
    const participantIds = (event.data()?.participantIds as string[] | undefined) ?? []
    if (!participantIds.includes(data.userId)) return res.status(400).json({ error: 'user_not_event_participant' })
    const result = await playEventCard(event, data.userId, { auctionId: data.auctionId, note: data.note || 'Carta giocata dall’amministratore su richiesta del giocatore.' }, req.userId!)
    return res.status(201).json(result)
  } catch (error: any) { return res.status(400).json({ error: error.message ?? 'admin_play_card_failed' }) }
})

router.post('/cards/:id/review', requireAuth, requirePlatformAdmin, async (req: AuthRequest, res) => {
  const decision = z.object({ status: z.enum(['APPROVED', 'REJECTED']) }).parse(req.body)
  const card = await db.collection('cardCatalog').doc(req.params.id).get(); if (!card.exists) return res.status(404).json({ error: 'card_not_found' })
  await card.ref.update({ status: decision.status, reviewedBy: req.userId, reviewedAt: new Date().toISOString() })
  return res.json({ ok: true, status: decision.status })
})

router.delete('/cards/:id', requireAuth, requirePlatformAdmin, async (req: AuthRequest, res) => {
  const card = await db.collection('cardCatalog').doc(req.params.id).get()
  if (!card.exists) return res.status(404).json({ error: 'card_not_found' })
  const copies = await db.collection('cards').where('catalogCardId', '==', card.id).get()
  const batch = db.batch(); copies.docs.forEach((copy) => batch.delete(copy.ref)); batch.delete(card.ref); await batch.commit()
  const deletion = await deleteDropboxAsset(typeof card.data()?.imageStoragePath === 'string' ? card.data()?.imageStoragePath : undefined)
  return res.json({ ok: true, removedDeckCopies: copies.size, asset: deletion })
})

router.post('/appeals/:id/decision', requireAuth, requirePlatformAdmin, async (req: AuthRequest, res) => {
  try {
    const data = appealDecisionSchema.parse(req.body); const appeal = await db.collection('appeals').doc(req.params.id).get()
    if (!appeal.exists || appeal.data()?.status !== 'OPEN') return res.status(404).json({ error: 'appeal_not_found' })
    const claim = await db.collection('cardClaims').doc(String(appeal.data()?.claimId)).get(); if (!claim.exists) return res.status(404).json({ error: 'claim_not_found' })
    const now = new Date().toISOString(); await appeal.ref.update({ status: 'DECIDED', decision: data.decision, note: data.note ?? '', decidedBy: req.userId, decidedAt: now }); await claim.ref.update({ status: data.decision, resolvedAt: now, resolvedBy: req.userId, updatedAt: now })
    if (data.decision === 'CONFIRMED') await rewardClaim(claim.ref, { ...claim.data()!, status: 'CONFIRMED' })
    const { notifyUser } = await import('../services/notifications'); await notifyUser(String(claim.data()?.userId), { kind: 'APPEAL_DECIDED', title: 'Ricorso deciso', message: data.decision === 'CONFIRMED' ? 'L’amministratore ha confermato la tua carta.' : 'L’amministratore ha confermato la negazione della carta.', path: `/events/${claim.data()?.eventId}` })
    return res.json({ ok: true, decision: data.decision })
  } catch (error: any) { return res.status(400).json({ error: error.message ?? 'appeal_decision_failed' }) }
})

router.post('/users/merge', requireAuth, requirePlatformAdmin, async (req: AuthRequest, res) => {
  const { primaryId, secondaryId } = mergeSchema.parse(req.body)
  const [primary, secondary] = await Promise.all([db.collection('users').doc(primaryId).get(), db.collection('users').doc(secondaryId).get()])
  if (!primary.exists || !secondary.exists) return res.status(404).json({ error: 'user_not_found' })
  const [groups, cards, catalog, predictions, scores, notifications, telegramLink] = await Promise.all([
    db.collection('groups').where('memberIds', 'array-contains', secondaryId).get(), db.collection('cards').where('authorId', '==', secondaryId).get(), db.collection('cardCatalog').where('creatorId', '==', secondaryId).get(), db.collection('predictions').where('userId', '==', secondaryId).get(), db.collection('scores').where('userId', '==', secondaryId).get(), db.collection('notifications').where('userId', '==', secondaryId).get(), db.collection('telegramLinks').doc(secondaryId).get()
  ])
  for (const group of groups.docs) {
    const data = group.data(); const members = Array.from(new Set(((data.memberIds as string[]) ?? []).map((id) => id === secondaryId ? primaryId : id)))
    const roles = { ...(data.memberRoles ?? {}) }; const sourceRole = roles[secondaryId]; if (sourceRole === 'ADMIN' || !roles[primaryId]) roles[primaryId] = sourceRole ?? 'MEMBER'; delete roles[secondaryId]
    await group.ref.update({ memberIds: members, memberRoles: roles, updatedAt: new Date().toISOString() })
  }
  const simpleUpdates = [...cards.docs, ...catalog.docs, ...predictions.docs, ...notifications.docs]
  while (simpleUpdates.length) {
    const batch = db.batch()
    simpleUpdates.splice(0, 400).forEach((doc) => {
      const collection = doc.ref.parent.id
      batch.update(doc.ref, collection === 'cardCatalog' ? { creatorId: primaryId } : collection === 'cards' ? { authorId: primaryId } : { userId: primaryId })
    })
    await batch.commit()
  }
  for (const score of scores.docs) {
    const data = score.data(); const destination = db.collection('scores').doc(`${primaryId}_${data.eventId}`); const current = await destination.get()
    await destination.set({ ...data, userId: primaryId, points: Number(data.points ?? 0) + Number(current.data()?.points ?? 0), updatedAt: new Date().toISOString() }, { merge: true }); await score.ref.delete()
  }
  if (telegramLink.exists) { await db.collection('telegramLinks').doc(primaryId).set({ ...telegramLink.data(), mergedFrom: secondaryId, updatedAt: new Date().toISOString() }, { merge: true }); await telegramLink.ref.delete() }
  await db.collection('users').doc(secondaryId).set({ mergedInto: primaryId, mergedAt: new Date().toISOString(), profileCompleted: false }, { merge: true })
  return res.json({ ok: true, primaryId, moved: { groups: groups.size, cards: cards.size, predictions: predictions.size, scores: scores.size, notifications: notifications.size, telegram: telegramLink.exists } })
})

router.post('/events/:id/close', requireAuth, async (req: AuthRequest, res) => {
  try {
    const eventSnapshot = await db.collection('events').doc(req.params.id).get()
    if (!eventSnapshot.exists) return res.status(404).json({ error: 'event_not_found' })
    const canManage = await isPlatformAdmin(req.userId!) || await groupRole(eventSnapshot.data()!.groupId, req.userId!) === 'ADMIN'
    if (!canManage) return res.status(403).json({ error: 'admin_required' })
    const result = await closeAndScoreEvent(eventSnapshot.id, 'manual')
    return res.json({ ok: true, alreadyClosed: result.alreadyClosed, scoredUsers: result.totals.size })
  } catch (error: any) { return res.status(400).json({ error: error.message ?? 'close_failed' }) }
})

export { requirePlatformAdmin }
export default router
