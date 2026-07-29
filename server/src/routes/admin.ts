import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { db, documentData, firebaseAuth, groupRole } from '../services/firebase'
import { closeAndScoreEvent } from '../services/scoring'
import { grantPlatformAdmin, isPlatformAdmin, isValidAdminPassword, revokePlatformAdmin } from '../services/platform-admin'
import { deleteDropboxAsset } from '../services/assets'

const router = Router()
const passwordSchema = z.object({ password: z.string().min(1).max(256) })
const mergeSchema = z.object({ primaryId: z.string().min(1), secondaryId: z.string().min(1) }).refine((value) => value.primaryId !== value.secondaryId)

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
  const [groups, users, events, cards] = await Promise.all([db.collection('groups').get(), db.collection('users').get(), db.collection('events').get(), db.collection('cardCatalog').get()])
  const groupNames = new Map(groups.docs.map((group) => [group.id, String(group.data().name ?? 'Gruppo senza nome')]))
  return res.json({
    stats: { groups: groups.size, users: users.size, events: events.size, cards: cards.size },
    groups: groups.docs.map((group) => documentData(group.id, { ...group.data(), memberCount: Array.isArray(group.data().memberIds) ? group.data().memberIds.length : 0 })),
    events: events.docs.map((event) => documentData(event.id, { ...event.data(), groupName: groupNames.get(String(event.data().groupId)) ?? 'Gruppo eliminato' })),
    users: users.docs.map((user) => documentData(user.id, user.data() as Record<string, unknown>)),
    cards: cards.docs.map((card) => documentData(card.id, card.data() as Record<string, unknown>))
  })
})

router.delete('/cards/:id', requireAuth, requirePlatformAdmin, async (req: AuthRequest, res) => {
  const card = await db.collection('cardCatalog').doc(req.params.id).get()
  if (!card.exists) return res.status(404).json({ error: 'card_not_found' })
  const copies = await db.collection('cards').where('catalogCardId', '==', card.id).get()
  const batch = db.batch(); copies.docs.forEach((copy) => batch.delete(copy.ref)); batch.delete(card.ref); await batch.commit()
  const deletion = await deleteDropboxAsset(typeof card.data()?.imageStoragePath === 'string' ? card.data()?.imageStoragePath : undefined)
  return res.json({ ok: true, removedDeckCopies: copies.size, asset: deletion })
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
