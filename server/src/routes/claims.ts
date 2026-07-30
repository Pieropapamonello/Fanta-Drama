import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { db, documentData, groupRole } from '../services/firebase'
import { notifyEventParticipants, notifyUser } from '../services/notifications'
import { isPlatformAdmin } from '../services/platform-admin'

const router = Router()
const claimSchema = z.object({ auctionId: z.string().min(1), note: z.string().trim().max(500).optional() })
const voteSchema = z.object({ vote: z.enum(['CONFIRM', 'DENY']), note: z.string().trim().max(300).optional() })
const appealSchema = z.object({ message: z.string().trim().min(4).max(1000) })

async function eventAccess(eventId: string, userId: string) {
  const event = await db.collection('events').doc(eventId).get()
  if (!event.exists) return null
  const platformAdmin = await isPlatformAdmin(userId)
  if (!await groupRole(String(event.data()?.groupId), userId) && !platformAdmin) return null
  if (!((event.data()?.participantIds as string[] | undefined) ?? []).includes(userId) && !platformAdmin) return null
  return event
}

function cardCost(claim: Record<string, unknown>, auction: Record<string, unknown> | undefined) {
  const paid = Number(claim.spentCredits ?? auction?.currentBid ?? auction?.directPrice ?? 0)
  return Number.isFinite(paid) && paid > 0 ? Math.round(paid) : 1
}

/** A played card gives points equal to the credits spent on that exact copy. */
export async function rewardClaim(claimRef: FirebaseFirestore.DocumentReference, claim: Record<string, unknown>) {
  if (claim.rewardedAt) return
  const auction = await db.collection('auctions').doc(String(claim.auctionId)).get()
  const points = cardCost(claim, auction.data())
  await db.runTransaction(async (transaction) => {
    const freshClaim = await transaction.get(claimRef)
    if (!freshClaim.exists || freshClaim.data()?.rewardedAt) return
    const now = new Date().toISOString()
    transaction.update(claimRef, { rewardedAt: now, rewardCredits: points, pointsAwarded: points, updatedAt: now })
    transaction.set(db.collection('creditTransactions').doc(), { userId: claim.userId, amount: 0, points, kind: 'CARD_PLAY_CONFIRMED', claimId: claimRef.id, eventId: claim.eventId, createdAt: now })
  })
  // Keep the event leaderboard live instead of waiting for the automatic close.
  const confirmed = await db.collection('cardClaims').where('eventId', '==', String(claim.eventId)).get()
  const total = confirmed.docs.filter((item) => item.data().userId === claim.userId && item.data().status === 'CONFIRMED').reduce((sum, item) => sum + Number(item.data().rewardCredits ?? 0), 0)
  await db.collection('scores').doc(`${claim.userId}_${claim.eventId}`).set({ userId: claim.userId, eventId: claim.eventId, groupId: claim.groupId, points: total, updatedAt: new Date().toISOString() }, { merge: true })
  void notifyUser(String(claim.userId), { kind: 'CLAIM_CONFIRMED', title: 'Carta giocata confermata', message: `La carta vale ${points} punti: la tua classifica si è aggiornata.`, path: `/events/${claim.eventId}` })
}

router.get('/event/:eventId', requireAuth, async (req: AuthRequest, res) => {
  if (!await eventAccess(req.params.eventId, req.userId!)) return res.status(404).json({ error: 'event_not_found' })
  const claims = await db.collection('cardClaims').where('eventId', '==', req.params.eventId).get()
  const items = await Promise.all(claims.docs.map(async (claim) => {
    const votes = await claim.ref.collection('votes').get()
    const user = await db.collection('users').doc(String(claim.data().userId)).get()
    return { ...documentData(claim.id, claim.data() as Record<string, unknown>), claimantName: user.data()?.username ?? 'Giocatore', votes: votes.docs.map((vote) => documentData(vote.id, vote.data() as Record<string, unknown>)) }
  }))
  return res.json({ claims: items })
})

router.post('/event/:eventId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const event = await eventAccess(req.params.eventId, req.userId!)
    if (!event) return res.status(404).json({ error: 'event_not_found' })
    if (new Date(String(event.data()?.startsAt)).getTime() > Date.now() || new Date(String(event.data()?.endsAt)).getTime() < Date.now()) return res.status(409).json({ error: 'claim_not_available' })
    const data = claimSchema.parse(req.body)
    const ref = db.collection('cardClaims').doc()
    const auctionRef = db.collection('auctions').doc(data.auctionId)
    const directPurchaseRef = db.collection('eventCardPurchases').doc(Buffer.from(`${data.auctionId}\u0000${req.userId!}`).toString('base64url'))
    const claim = await db.runTransaction(async (transaction) => {
      const [auctionSnapshot, purchaseSnapshot] = await Promise.all([transaction.get(auctionRef), transaction.get(directPurchaseRef)])
      if (!auctionSnapshot.exists || auctionSnapshot.data()?.eventId !== event.id) throw new Error('auction_not_owned')
      const auction = auctionSnapshot.data()!
      const direct = auction.acquisitionMode === 'DIRECT'
      let spentCredits = 0
      const now = new Date().toISOString()
      if (direct) {
        if (!purchaseSnapshot.exists) throw new Error('auction_not_owned')
        if (purchaseSnapshot.data()?.playedAt) throw new Error('card_already_played')
        spentCredits = Number(purchaseSnapshot.data()?.price ?? auction.directPrice ?? 0)
        if (spentCredits <= 0) throw new Error('invalid_card_cost')
        transaction.update(directPurchaseRef, { playedAt: now, playedClaimId: ref.id, updatedAt: now })
      } else {
        if (auction.ownerId !== req.userId!) throw new Error('auction_not_owned')
        if (auction.playedAt) throw new Error('card_already_played')
        spentCredits = Number(auction.currentBid ?? 0)
        if (spentCredits <= 0) throw new Error('invalid_card_cost')
        transaction.update(auctionRef, { playedAt: now, playedBy: req.userId!, playedClaimId: ref.id, updatedAt: now })
      }
      const value = { eventId: event.id, groupId: event.data()?.groupId, auctionId: auctionSnapshot.id, cardTitle: auction.title, userId: req.userId!, note: data.note ?? '', spentCredits: Math.round(spentCredits), status: 'PENDING', createdAt: now, updatedAt: now }
      transaction.set(ref, value)
      return value
    })
    void notifyEventParticipants(event.id, { kind: 'CLAIM_NEEDS_VOTES', title: `Carta giocata · ${claim.cardTitle}`, message: `Una carta da ${claim.spentCredits} punti attende due conferme. Apri l’evento per approvare o contestare.`, path: `/events/${event.id}`, actionLabel: 'Apri verifica carta' }, [req.userId!])
    return res.status(201).json({ claim: documentData(ref.id, claim) })
  } catch (error: any) { return res.status(400).json({ error: error.message ?? 'claim_failed' }) }
})

router.post('/:id/vote', requireAuth, async (req: AuthRequest, res) => {
  try {
    const data = voteSchema.parse(req.body)
    const ref = db.collection('cardClaims').doc(req.params.id)
    const claimSnapshot = await ref.get()
    if (!claimSnapshot.exists) return res.status(404).json({ error: 'claim_not_found' })
    const claim = claimSnapshot.data()!
    const event = await db.collection('events').doc(String(claim.eventId)).get()
    if (!event.exists) return res.status(404).json({ error: 'event_not_found' })
    const platformAdmin = await isPlatformAdmin(req.userId!)
    const groupAdmin = await groupRole(String(claim.groupId), req.userId!) === 'ADMIN'
    const participant = ((event.data()?.participantIds as string[] | undefined) ?? []).includes(req.userId!)
    if (!participant && !platformAdmin && !groupAdmin) return res.status(403).json({ error: 'event_participant_required' })
    if (claim.userId === req.userId!) return res.status(403).json({ error: 'claimant_cannot_vote' })
    if (claim.status !== 'PENDING') return res.status(409).json({ error: 'claim_already_resolved' })
    const voteRef = ref.collection('votes').doc(req.userId!)
    const oldVote = await voteRef.get()
    const now = new Date().toISOString()
    await voteRef.set({ userId: req.userId!, ...data, createdAt: oldVote.data()?.createdAt ?? now, updatedAt: now })
    const votes = await ref.collection('votes').get()
    const confirms = votes.docs.filter((vote) => vote.data().vote === 'CONFIRM').length
    const denies = votes.docs.filter((vote) => vote.data().vote === 'DENY').length
    // A crew/platform admin may decide immediately. Everyone else needs two
    // independent player confirmations (or two denials).
    const status = platformAdmin || groupAdmin ? (data.vote === 'CONFIRM' ? 'CONFIRMED' : 'DENIED') : confirms >= 2 ? 'CONFIRMED' : denies >= 2 ? 'DENIED' : 'PENDING'
    if (status !== 'PENDING') {
      await ref.update({ status, resolvedAt: now, resolvedAtBy: req.userId!, updatedAt: now })
      if (status === 'CONFIRMED') {
        void rewardClaim(ref, { ...claim, spentCredits: claim.spentCredits, status })
        void notifyEventParticipants(String(claim.eventId), { kind: 'SCORE_UPDATED', title: `Carta confermata · ${claim.cardTitle}`, message: `Carta valida: ${claim.spentCredits} punti assegnati. La classifica è aggiornata.`, path: `/events/${claim.eventId}`, actionLabel: 'Vedi classifica' })
      } else {
        void notifyEventParticipants(String(claim.eventId), { kind: 'CLAIM_DENIED', title: `Carta contestata · ${claim.cardTitle}`, message: 'La carta è stata negata. Dalla verifica puoi chiedere l’intervento dell’amministratore.', path: `/events/${claim.eventId}`, actionLabel: 'Apri verifica carta' })
      }
    }
    return res.json({ status, confirms, denies, adminDecision: platformAdmin || groupAdmin })
  } catch (error: any) { return res.status(400).json({ error: error.message ?? 'vote_failed' }) }
})

router.post('/:id/appeal', requireAuth, async (req: AuthRequest, res) => {
  try {
    const data = appealSchema.parse(req.body)
    const claim = await db.collection('cardClaims').doc(req.params.id).get()
    if (!claim.exists) return res.status(404).json({ error: 'claim_not_found' })
    if (!await eventAccess(String(claim.data()?.eventId), req.userId!)) return res.status(403).json({ error: 'event_participant_required' })
    const prior = await db.collection('appeals').where('claimId', '==', claim.id).get()
    if (prior.docs.some((item) => item.data().userId === req.userId! && item.data().status === 'OPEN')) return res.status(409).json({ error: 'appeal_already_exists' })
    const now = new Date().toISOString()
    const ref = db.collection('appeals').doc()
    const appeal = { claimId: claim.id, eventId: claim.data()?.eventId, groupId: claim.data()?.groupId, userId: req.userId!, message: data.message, status: 'OPEN', createdAt: now }
    await ref.set(appeal)
    await claim.ref.update({ appealCount: Number(claim.data()?.appealCount ?? 0) + 1, latestAppealAt: now, updatedAt: now })
    const [group, platformAdmins] = await Promise.all([db.collection('groups').doc(String(appeal.groupId)).get(), db.collection('platformAdmins').get()])
    const admins = new Set([...Object.entries((group.data()?.memberRoles ?? {}) as Record<string, string>).filter(([, role]) => role === 'ADMIN').map(([id]) => id), ...platformAdmins.docs.map((admin) => admin.id)])
    await Promise.allSettled([...admins].map((id) => notifyUser(id, { kind: 'APPEAL_OPENED', title: 'Intervento richiesto su una carta', message: `È richiesto un controllo per ${claim.data()?.cardTitle}.`, path: '/admin/console', actionLabel: 'Apri console admin' })))
    return res.status(201).json({ appeal: documentData(ref.id, appeal) })
  } catch (error: any) { return res.status(400).json({ error: error.message ?? 'appeal_failed' }) }
})

export default router
