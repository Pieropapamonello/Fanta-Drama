import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { db, documentData, groupRole } from '../services/firebase'
import { notifyGroupMembers, notifyUser } from '../services/notifications'

const router = Router()
const claimSchema = z.object({ auctionId: z.string().min(1), note: z.string().trim().max(500).optional() })
const voteSchema = z.object({ vote: z.enum(['CONFIRM', 'DENY']), note: z.string().trim().max(300).optional() })
const appealSchema = z.object({ message: z.string().trim().min(4).max(1000) })

async function eventAccess(eventId: string, userId: string) {
  const event = await db.collection('events').doc(eventId).get()
  if (!event.exists || !await groupRole(String(event.data()?.groupId), userId)) return null
  return event
}

export async function rewardClaim(claimRef: FirebaseFirestore.DocumentReference, claim: Record<string, unknown>) {
  if (claim.rewardedAt) return
  const auction = await db.collection('auctions').doc(String(claim.auctionId)).get()
  const reward = Math.max(30, Math.round(Number(auction.data()?.currentBid ?? 20) * 1.5))
  const walletRef = db.collection('wallets').doc(String(claim.userId))
  await db.runTransaction(async (transaction) => {
    const [freshClaim, wallet] = await Promise.all([transaction.get(claimRef), transaction.get(walletRef)])
    if (!freshClaim.exists || freshClaim.data()?.rewardedAt) return
    const now = new Date().toISOString(); const balance = Number(wallet.data()?.balance ?? 1000)
    transaction.set(walletRef, { userId: claim.userId, balance: balance + reward, reserved: Number(wallet.data()?.reserved ?? 0), updatedAt: now }, { merge: true })
    transaction.update(claimRef, { rewardedAt: now, rewardCredits: reward, updatedAt: now })
    transaction.set(db.collection('creditTransactions').doc(), { userId: claim.userId, amount: reward, kind: 'CLAIM_CONFIRMED', claimId: claimRef.id, eventId: claim.eventId, createdAt: now })
  })
  void notifyUser(String(claim.userId), { kind: 'CLAIM_CONFIRMED', title: 'Carta confermata', message: `La crew ha confermato il tuo evento: hai ricevuto ${reward} crediti.`, path: `/events/${claim.eventId}` })
}

router.get('/event/:eventId', requireAuth, async (req: AuthRequest, res) => {
  if (!await eventAccess(req.params.eventId, req.userId!)) return res.status(404).json({ error: 'event_not_found' })
  const claims = await db.collection('cardClaims').where('eventId', '==', req.params.eventId).get()
  const items = await Promise.all(claims.docs.map(async (claim) => {
    const votes = await claim.ref.collection('votes').get(); const user = await db.collection('users').doc(String(claim.data().userId)).get()
    return { ...documentData(claim.id, claim.data() as Record<string, unknown>), claimantName: user.data()?.username ?? 'Giocatore', votes: votes.docs.map((vote) => documentData(vote.id, vote.data() as Record<string, unknown>)) }
  }))
  return res.json({ claims: items })
})

router.post('/event/:eventId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const event = await eventAccess(req.params.eventId, req.userId!); if (!event) return res.status(404).json({ error: 'event_not_found' })
    if (new Date(String(event.data()?.startsAt)).getTime() > Date.now() || new Date(String(event.data()?.endsAt)).getTime() < Date.now()) return res.status(409).json({ error: 'claim_not_available' })
    const data = claimSchema.parse(req.body); const auction = await db.collection('auctions').doc(data.auctionId).get()
    const directPurchaseId = Buffer.from(`${data.auctionId}\u0000${req.userId!}`).toString('base64url'); const directPurchase = await db.collection('eventCardPurchases').doc(directPurchaseId).get()
    const ownsAuction = auction.data()?.ownerId === req.userId!; const ownsDirectCopy = auction.data()?.acquisitionMode === 'DIRECT' && directPurchase.exists
    if (!auction.exists || auction.data()?.eventId !== event.id || (!ownsAuction && !ownsDirectCopy)) return res.status(403).json({ error: 'auction_not_owned' })
    const duplicate = await db.collection('cardClaims').where('auctionId', '==', auction.id).get(); if (duplicate.docs.some((claim) => claim.data().userId === req.userId!)) return res.status(409).json({ error: 'claim_already_exists' })
    const ref = db.collection('cardClaims').doc(); const claim = { eventId: event.id, groupId: event.data()?.groupId, auctionId: auction.id, cardTitle: auction.data()?.title, userId: req.userId!, note: data.note ?? '', status: 'PENDING', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    await ref.set(claim)
    void notifyGroupMembers(String(event.data()?.groupId), { kind: 'CLAIM_NEEDS_VOTES', title: `Verifica richiesta · ${claim.cardTitle}`, message: 'Un giocatore dichiara che la carta è avvenuta: conferma o nega dalla pagina evento.', path: `/events/${event.id}` }, [req.userId!])
    return res.status(201).json({ claim: documentData(ref.id, claim) })
  } catch (error: any) { return res.status(400).json({ error: error.message ?? 'claim_failed' }) }
})

router.post('/:id/vote', requireAuth, async (req: AuthRequest, res) => {
  try {
    const data = voteSchema.parse(req.body); const ref = db.collection('cardClaims').doc(req.params.id); const claimSnapshot = await ref.get()
    if (!claimSnapshot.exists) return res.status(404).json({ error: 'claim_not_found' }); const claim = claimSnapshot.data()!
    if (!await groupRole(String(claim.groupId), req.userId!)) return res.status(403).json({ error: 'group_member_required' })
    if (claim.userId === req.userId!) return res.status(403).json({ error: 'claimant_cannot_vote' })
    if (claim.status !== 'PENDING') return res.status(409).json({ error: 'claim_already_resolved' })
    const voteRef = ref.collection('votes').doc(req.userId!); const oldVote = await voteRef.get(); const now = new Date().toISOString(); await voteRef.set({ userId: req.userId!, ...data, createdAt: oldVote.data()?.createdAt ?? now, updatedAt: now })
    const votes = await ref.collection('votes').get(); const confirms = votes.docs.filter((vote) => vote.data().vote === 'CONFIRM').length; const denies = votes.docs.filter((vote) => vote.data().vote === 'DENY').length
    let status = 'PENDING'; if (confirms >= 2) status = 'CONFIRMED'; else if (denies >= 2) status = 'DENIED'
    if (status !== 'PENDING') { await ref.update({ status, resolvedAt: now, updatedAt: now }); if (status === 'CONFIRMED') void rewardClaim(ref, { ...claim, status }); else void notifyUser(String(claim.userId), { kind: 'CLAIM_DENIED', title: 'Carta negata', message: 'Due giocatori hanno negato che l’evento sia avvenuto. Puoi aprire un ricorso.', path: `/events/${claim.eventId}` }) }
    return res.json({ status, confirms, denies })
  } catch (error: any) { return res.status(400).json({ error: error.message ?? 'vote_failed' }) }
})

router.post('/:id/appeal', requireAuth, async (req: AuthRequest, res) => {
  try {
    const data = appealSchema.parse(req.body); const claim = await db.collection('cardClaims').doc(req.params.id).get()
    if (!claim.exists) return res.status(404).json({ error: 'claim_not_found' }); if (claim.data()?.userId !== req.userId!) return res.status(403).json({ error: 'only_claimant_can_appeal' })
    if (!['CONFIRMED', 'DENIED'].includes(String(claim.data()?.status))) return res.status(409).json({ error: 'claim_not_resolved' })
    const existing = await db.collection('appeals').where('claimId', '==', claim.id).limit(1).get(); if (!existing.empty) return res.status(409).json({ error: 'appeal_already_exists' })
    const ref = db.collection('appeals').doc(); const appeal = { claimId: claim.id, eventId: claim.data()?.eventId, groupId: claim.data()?.groupId, userId: req.userId!, message: data.message, status: 'OPEN', createdAt: new Date().toISOString() }; await ref.set(appeal); await claim.ref.update({ status: 'APPEALED', appealId: ref.id, updatedAt: new Date().toISOString() })
    const group = await db.collection('groups').doc(String(appeal.groupId)).get(); const admins = Object.entries((group.data()?.memberRoles ?? {}) as Record<string, string>).filter(([, role]) => role === 'ADMIN').map(([id]) => id); await Promise.allSettled(admins.map((id) => notifyUser(id, { kind: 'APPEAL_OPENED', title: 'Nuovo ricorso', message: `È richiesto un controllo per ${claim.data()?.cardTitle}.`, path: '/admin/console' })))
    return res.status(201).json({ appeal: documentData(ref.id, appeal) })
  } catch (error: any) { return res.status(400).json({ error: error.message ?? 'appeal_failed' }) }
})

export default router
