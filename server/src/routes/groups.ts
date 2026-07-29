import { Router } from 'express'
import crypto from 'crypto'
import { z } from 'zod'
import { FieldValue } from 'firebase-admin/firestore'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { db, documentData } from '../services/firebase'
import { isPlatformAdmin } from '../services/platform-admin'

const router = Router()
const createSchema = z.object({ name: z.string().trim().min(1).max(80), description: z.string().trim().max(500).optional() })
const joinSchema = z.object({ code: z.string().trim().min(1).max(16) })
const messageSchema = z.object({ message: z.string().trim().min(1).max(700) })

function inviteCode() {
  return crypto.randomBytes(6).toString('base64url').toUpperCase().slice(0, 8)
}

async function publicMembers(memberIds: string[]) {
  const snapshots = await Promise.all(memberIds.map((userId) => db.collection('users').doc(userId).get()))
  return snapshots.map((snapshot, index) => {
    const user = snapshot.data() ?? {}
    return { id: memberIds[index], username: user.username ?? 'Giocatore', avatar: user.avatar ?? '', crewRole: user.crewRole ?? 'Jolly', bio: user.bio ?? '', city: user.city ?? '', motto: user.motto ?? '' }
  })
}

async function memberCardsInGroup(groupId: string, memberId: string) {
  const events = await db.collection('events').where('groupId', '==', groupId).get()
  const auctions = await Promise.all(events.docs.map((event) => db.collection('auctions').where('eventId', '==', event.id).get()))
  return auctions.flatMap((snapshot) => snapshot.docs).filter((auction) => {
    const data = auction.data()
    return data.ownerId === memberId || (data.status === 'OPEN' && data.leaderId === memberId)
  }).map((auction) => {
    const card = auction.data()
    return {
      id: auction.id,
      eventId: card.eventId ?? '',
      eventTitle: events.docs.find((event) => event.id === card.eventId)?.data().title ?? 'Evento della crew',
      title: card.title ?? 'Carta Drama',
      description: card.description ?? '',
      imageUrl: card.imageUrl ?? '',
      rarity: card.rarity ?? 'COMMON',
      credits: Number(card.currentBid ?? 0),
      state: card.status === 'WON' ? 'Acquistata' : 'Offerta in testa'
    }
  })
}

router.post('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const data = createSchema.parse(req.body)
    const ref = db.collection('groups').doc()
    const group = {
      name: data.name,
      description: data.description ?? '',
      code: inviteCode(),
      memberIds: [req.userId!],
      memberRoles: { [req.userId!]: 'ADMIN' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    await ref.set(group)
    return res.status(201).json({ group: documentData(ref.id, group) })
  } catch (error: any) {
    return res.status(400).json({ error: error.message ?? 'invalid_group' })
  }
})

router.post('/join', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { code } = joinSchema.parse(req.body)
    const matches = await db.collection('groups').where('code', '==', code.toUpperCase()).limit(1).get()
    if (matches.empty) return res.status(404).json({ error: 'group_not_found' })
    const group = matches.docs[0]
    if ((group.data().memberIds as string[]).includes(req.userId!)) return res.status(409).json({ error: 'already_member' })
    await group.ref.update({
      memberIds: FieldValue.arrayUnion(req.userId!),
      [`memberRoles.${req.userId!}`]: 'MEMBER',
      updatedAt: new Date().toISOString()
    })
    const updated = await group.ref.get()
    return res.json({ group: documentData(updated.id, updated.data() as Record<string, unknown>) })
  } catch (error: any) {
    return res.status(400).json({ error: error.message ?? 'join_failed' })
  }
})

router.get('/', requireAuth, async (req: AuthRequest, res) => {
  const snapshot = await (await isPlatformAdmin(req.userId!)
    ? db.collection('groups').get()
    : db.collection('groups').where('memberIds', 'array-contains', req.userId!).get())
  const groups = await Promise.all(snapshot.docs.map(async (doc) => {
    const group = doc.data() as Record<string, unknown>
    const memberIds = (group.memberIds as string[] | undefined) ?? []
    return { ...documentData(doc.id, group), memberCount: memberIds.length, members: await publicMembers(memberIds) }
  }))
  return res.json({ groups })
})

router.get('/:id/messages', requireAuth, async (req: AuthRequest, res) => {
  const group = await db.collection('groups').doc(req.params.id).get()
  if (!group.exists || (!(group.data()?.memberIds as string[]).includes(req.userId!) && !await isPlatformAdmin(req.userId!))) return res.status(404).json({ error: 'not_found' })
  const messages = await db.collection('groupMessages').where('groupId', '==', group.id).get()
  return res.json({ messages: messages.docs.map((item) => documentData(item.id, item.data() as Record<string, unknown>)).sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt))).slice(-100) })
})

router.post('/:id/messages', requireAuth, async (req: AuthRequest, res) => {
  try {
    const group = await db.collection('groups').doc(req.params.id).get()
    if (!group.exists || (!(group.data()?.memberIds as string[]).includes(req.userId!) && !await isPlatformAdmin(req.userId!))) return res.status(404).json({ error: 'not_found' })
    const data = messageSchema.parse(req.body); const user = await db.collection('users').doc(req.userId!).get(); const ref = db.collection('groupMessages').doc()
    const message = { groupId: group.id, userId: req.userId!, username: user.data()?.username ?? 'Giocatore', avatar: user.data()?.avatar ?? '', message: data.message, createdAt: new Date().toISOString() }
    await ref.set(message)
    return res.status(201).json({ message: documentData(ref.id, message) })
  } catch (error: any) { return res.status(400).json({ error: error.message ?? 'message_failed' }) }
})

router.get('/:id/members/:memberId', requireAuth, async (req: AuthRequest, res) => {
  const group = await db.collection('groups').doc(req.params.id).get()
  const memberIds = (group.data()?.memberIds as string[] | undefined) ?? []
  if (!group.exists || (!memberIds.includes(req.userId!) && !await isPlatformAdmin(req.userId!)) || !memberIds.includes(req.params.memberId)) return res.status(404).json({ error: 'not_found' })
  const member = await db.collection('users').doc(req.params.memberId).get()
  const user = member.data() ?? {}
  return res.json({ member: { id: req.params.memberId, username: user.username ?? 'Giocatore', avatar: user.avatar ?? '', crewRole: user.crewRole ?? 'Jolly', bio: user.bio ?? '', city: user.city ?? '', motto: user.motto ?? '', cards: await memberCardsInGroup(group.id, req.params.memberId) } })
})

router.get('/:id', requireAuth, async (req: AuthRequest, res) => {
  const snapshot = await db.collection('groups').doc(req.params.id).get()
  if (!snapshot.exists || (!(snapshot.data()?.memberIds as string[]).includes(req.userId!) && !await isPlatformAdmin(req.userId!))) return res.status(404).json({ error: 'not_found' })
  const group = snapshot.data() as Record<string, unknown>
  return res.json({ group: { ...documentData(snapshot.id, group), members: await publicMembers((group.memberIds as string[] | undefined) ?? []) } })
})

router.delete('/:id', requireAuth, async (req: AuthRequest, res) => {
  const groupRef = db.collection('groups').doc(req.params.id)
  const group = await groupRef.get()
  if (!group.exists) return res.status(404).json({ error: 'not_found' })
  if (group.data()?.memberRoles?.[req.userId!] !== 'ADMIN' && !await isPlatformAdmin(req.userId!)) return res.status(403).json({ error: 'admin_required' })

  const [characters, events] = await Promise.all([
    db.collection('characters').where('groupId', '==', group.id).get(),
    db.collection('events').where('groupId', '==', group.id).get()
  ])
  const eventIds = events.docs.map((event) => event.id)
  const relatedPredictions = await Promise.all(eventIds.map((eventId) => db.collection('predictions').where('eventId', '==', eventId).get()))
  const relatedScores = await Promise.all(eventIds.map((eventId) => db.collection('scores').where('eventId', '==', eventId).get()))
  const refs = [groupRef, ...characters.docs.map((doc) => doc.ref), ...events.docs.map((doc) => doc.ref), ...relatedPredictions.flatMap((snapshot) => snapshot.docs.map((doc) => doc.ref)), ...relatedScores.flatMap((snapshot) => snapshot.docs.map((doc) => doc.ref))]

  while (refs.length) {
    const batch = db.batch()
    refs.splice(0, 450).forEach((ref) => batch.delete(ref))
    await batch.commit()
  }
  return res.json({ ok: true })
})

export default router
