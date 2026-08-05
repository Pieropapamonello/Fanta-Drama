import { Router } from 'express'
import crypto from 'crypto'
import { z } from 'zod'
import { FieldValue } from 'firebase-admin/firestore'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { db, documentData } from '../services/firebase'
import { isPlatformAdmin } from '../services/platform-admin'
import { ensureWallet, refreshGroupAuctions } from '../services/auctions'
import { notifyGroupMembers } from '../services/notifications'
import { starterCards } from '../data/starter-content'
import { runInBackground } from '../services/errors'

const router = Router()
const createSchema = z.object({ name: z.string().trim().min(1).max(80), description: z.string().trim().max(500).optional() })
const updateSchema = z.object({ name: z.string().trim().min(1).max(80), description: z.string().trim().max(500).optional(), imageUrl: z.string().url().max(2048).optional() })
const joinSchema = z.object({ code: z.string().trim().min(1).max(16) })
const messageSchema = z.object({ message: z.string().trim().min(1).max(700) })
const marketCardSchema = z.object({ cardKey: z.string().regex(/^(starter|custom):[a-zA-Z0-9_-]+$/) })

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
  const [auctions, purchases] = await Promise.all([db.collection('auctions').where('groupId', '==', groupId).get(), db.collection('eventCardPurchases').where('groupId', '==', groupId).get()])
  const auctionCards = auctions.docs.filter((auction) => {
    const data = auction.data()
    return data.ownerId === memberId || (data.status === 'OPEN' && data.leaderId === memberId)
  }).map((auction) => {
    const card = auction.data()
    return {
      id: auction.id,
      eventId: card.eventId ?? '',
      eventTitle: events.docs.find((event) => event.id === card.eventId)?.data().title ?? (card.marketScope === 'GROUP' ? 'Asta privata della crew' : 'Evento della crew'),
      title: card.title ?? 'Carta Drama',
      description: card.description ?? '',
      imageUrl: card.imageUrl ?? '',
      rarity: card.rarity ?? 'COMMON',
      credits: Number(card.currentBid ?? 0),
      state: card.status === 'WON' ? 'Acquistata' : 'Offerta in testa'
    }
  })
  const directCards = purchases.docs.filter((purchase) => purchase.data().userId === memberId).map((purchase) => { const card = purchase.data(); return { id: purchase.id, eventId: card.eventId ?? '', eventTitle: events.docs.find((event) => event.id === card.eventId)?.data().title ?? 'Evento della crew', title: card.title ?? 'Carta Drama', description: card.description ?? '', imageUrl: card.imageUrl ?? '', rarity: card.rarity ?? 'COMMON', credits: Number(card.price ?? 0), state: 'Acquistata' } })
  return [...auctionCards, ...directCards]
}

async function marketCard(cardKey: string): Promise<Record<string, any> | null> {
  if (cardKey.startsWith('starter:')) {
    const card = starterCards.find((item) => item.slug === cardKey.slice('starter:'.length))
    if (!card || !card.imageUrl) return null
    return { key: cardKey, ...card }
  }
  const card = await db.collection('cardCatalog').doc(cardKey.slice('custom:'.length)).get()
  if (!card.exists || card.data()?.status === 'REJECTED' || !card.data()?.imageUrl) return null
  return { key: cardKey, ...(card.data() as Record<string, any>) }
}

async function canAccessGroup(groupId: string, userId: string) {
  const group = await db.collection('groups').doc(groupId).get()
  const members = (group.data()?.memberIds as string[] | undefined) ?? []
  return { group, allowed: group.exists && (members.includes(userId) || await isPlatformAdmin(userId)) }
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
  const platformAdmin = await isPlatformAdmin(req.userId!)
  const snapshot = await (platformAdmin
    ? db.collection('groups').get()
    : db.collection('groups').where('memberIds', 'array-contains', req.userId!).get())
  const groups = await Promise.all(snapshot.docs.map(async (doc) => {
    const group = doc.data() as Record<string, unknown>
    const memberIds = (group.memberIds as string[] | undefined) ?? []
    const { memberRoles: _memberRoles, memberIds: _memberIds, ...publicGroup } = group
    return {
      ...documentData(doc.id, publicGroup),
      memberCount: memberIds.length,
      members: await publicMembers(memberIds),
      currentUserRole: (group.memberRoles as Record<string, string> | undefined)?.[req.userId!] ?? (platformAdmin ? 'ADMIN' : 'MEMBER')
    }
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

router.get('/:id/market-auctions', requireAuth, async (req: AuthRequest, res) => {
  const { group, allowed } = await canAccessGroup(req.params.id, req.userId!)
  if (!allowed) return res.status(404).json({ error: 'not_found' })
  await refreshGroupAuctions(group.id)
  const [auctions, wallet] = await Promise.all([db.collection('auctions').where('groupId', '==', group.id).get(), ensureWallet(req.userId!)])
  return res.json({ wallet: wallet.data(), auctions: auctions.docs.filter((auction) => auction.data().marketScope === 'GROUP').map((auction) => documentData(auction.id, auction.data() as Record<string, unknown>)) })
})

router.post('/:id/market-auctions', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { group, allowed } = await canAccessGroup(req.params.id, req.userId!)
    if (!allowed) return res.status(404).json({ error: 'not_found' })
    const { cardKey } = marketCardSchema.parse(req.body)
    const card = await marketCard(cardKey)
    if (!card) return res.status(404).json({ error: 'catalog_card_not_found' })
    const current = await db.collection('auctions').where('groupId', '==', group.id).get()
    const existing = current.docs.find((auction) => auction.data().marketScope === 'GROUP' && auction.data().cardKey === cardKey)
    if (existing) return res.json({ auction: documentData(existing.id, existing.data() as Record<string, unknown>), alreadyStarted: true })
    const creator = await db.collection('users').doc(req.userId!).get()
    const ref = db.collection('auctions').doc()
    const now = new Date(); const closesAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
    const auction = { groupId: group.id, eventId: null, marketScope: 'GROUP', cardKey, title: card.title, description: card.description, rarity: card.rarity ?? 'COMMON', type: card.type ?? 'YES_NO', imageUrl: card.imageUrl, creatorName: card.creatorName ?? null, openingBid: 20, minIncrement: 5, currentBid: 0, leaderId: null, leaderName: null, status: 'OPEN', opensAt: now.toISOString(), closesAt, requestedById: req.userId!, requestedByName: creator.data()?.username ?? 'Giocatore', createdAt: now.toISOString(), updatedAt: now.toISOString() }
    await ref.set(auction)
    const deadline = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(closesAt))
    runInBackground(notifyGroupMembers(group.id, { kind: 'AUCTION_OPENED', title: `Nuova asta · ${auction.title}`, message: `${auction.requestedByName} ha richiesto questa carta. L’asta è aperta e scade il ${deadline}: fai un’offerta o rilancia.`, path: `/groups/${group.id}/cards`, actionLabel: 'Apri asta e rilancia' }, [req.userId!]), 'Group auction notification')
    return res.status(201).json({ auction: documentData(ref.id, auction), alreadyStarted: false })
  } catch (error: any) { return res.status(400).json({ error: error.message ?? 'market_auction_failed' }) }
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
  const { memberRoles: _memberRoles, memberIds: _memberIds, ...publicGroup } = group
  return res.json({
    group: {
      ...documentData(snapshot.id, publicGroup),
      members: await publicMembers((group.memberIds as string[] | undefined) ?? []),
      currentUserRole: (group.memberRoles as Record<string, string> | undefined)?.[req.userId!] ?? (await isPlatformAdmin(req.userId!) ? 'ADMIN' : 'MEMBER')
    }
  })
})

router.put('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const ref = db.collection('groups').doc(req.params.id); const snapshot = await ref.get()
    if (!snapshot.exists) return res.status(404).json({ error: 'not_found' })
    if (snapshot.data()?.memberRoles?.[req.userId!] !== 'ADMIN' && !await isPlatformAdmin(req.userId!)) return res.status(403).json({ error: 'admin_required' })
    const data = updateSchema.parse(req.body)
    await ref.update({ ...data, description: data.description ?? '', updatedAt: new Date().toISOString() })
    const group = await ref.get()
    return res.json({ group: documentData(group.id, group.data() as Record<string, unknown>) })
  } catch (error: any) { return res.status(400).json({ error: error.message ?? 'group_update_failed' }) }
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
