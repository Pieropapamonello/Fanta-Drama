import { db, groupRole } from './firebase'
import { isPlatformAdmin } from './platform-admin'
import { notifyEventParticipants, notifyUser } from './notifications'

function approvalId(eventId: string, cardKey: string) {
  return Buffer.from(`${eventId}\u0000${cardKey}`).toString('base64url')
}

function cardCost(claim: Record<string, unknown>, auction: Record<string, unknown> | undefined) {
  const paid = Number(claim.spentCredits ?? auction?.currentBid ?? auction?.directPrice ?? 0)
  return Number.isFinite(paid) && paid > 0 ? Math.round(paid) : 1
}

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
  const confirmed = await db.collection('cardClaims').where('eventId', '==', String(claim.eventId)).get()
  const total = confirmed.docs.filter((item) => item.data().userId === claim.userId && item.data().status === 'CONFIRMED').reduce((sum, item) => sum + Number(item.data().rewardCredits ?? 0), 0)
  await db.collection('scores').doc(`${claim.userId}_${claim.eventId}`).set({ userId: claim.userId, eventId: claim.eventId, groupId: claim.groupId, points: total, updatedAt: new Date().toISOString() }, { merge: true })
}

async function confirmMatchingClaims(sourceRef: FirebaseFirestore.DocumentReference, sourceClaim: Record<string, unknown>) {
  const sameEvent = await db.collection('cardClaims').where('eventId', '==', String(sourceClaim.eventId)).get()
  const matching = sameEvent.docs.filter((item) => item.id !== sourceRef.id && item.data().status === 'PENDING' && String(item.data().cardKey ?? '') === String(sourceClaim.cardKey ?? ''))
  if (!matching.length) return 0
  const now = new Date().toISOString()
  const remaining = [...matching]
  while (remaining.length) {
    const batch = db.batch()
    remaining.splice(0, 350).forEach((item) => batch.update(item.ref, { status: 'CONFIRMED', resolvedAt: now, resolvedAtBy: 'same_card_rule', autoApproved: true, sourceClaimId: sourceRef.id, updatedAt: now }))
    await batch.commit()
  }
  await Promise.all(matching.map((item) => rewardClaim(item.ref, { ...item.data(), status: 'CONFIRMED' })))
  return matching.length
}

export async function submitClaimVote(claimId: string, userId: string, vote: 'CONFIRM' | 'DENY') {
  const ref = db.collection('cardClaims').doc(claimId)
  const initial = await ref.get()
  if (!initial.exists) throw new Error('claim_not_found')
  const initialClaim = initial.data()!
  const event = await db.collection('events').doc(String(initialClaim.eventId)).get()
  if (!event.exists) throw new Error('event_not_found')
  const platformAdmin = await isPlatformAdmin(userId)
  const groupAdmin = await groupRole(String(initialClaim.groupId), userId) === 'ADMIN'
  const participant = ((event.data()?.participantIds as string[] | undefined) ?? []).includes(userId)
  if (!participant && !platformAdmin && !groupAdmin) throw new Error('event_participant_required')
  if (initialClaim.userId === userId) throw new Error('claimant_cannot_vote')

  const auction = await db.collection('auctions').doc(String(initialClaim.auctionId)).get()
  const cardKey = String(initialClaim.cardKey ?? auction.data()?.cardKey ?? `auction:${initialClaim.auctionId}`)
  const outcome: any = await db.runTransaction(async (transaction) => {
    const [fresh, votesSnapshot, oldVote] = await Promise.all([transaction.get(ref), transaction.get(ref.collection('votes')), transaction.get(ref.collection('votes').doc(userId))])
    if (!fresh.exists) throw new Error('claim_not_found')
    const claim = fresh.data()!
    if (claim.status !== 'PENDING') throw new Error('claim_already_resolved')
    if (claim.userId === userId) throw new Error('claimant_cannot_vote')
    if (oldVote.exists && oldVote.data()?.vote === vote) {
      const confirms = votesSnapshot.docs.filter((item) => item.data().vote === 'CONFIRM').length
      const denies = votesSnapshot.docs.filter((item) => item.data().vote === 'DENY').length
      return { changed: false, status: 'PENDING', confirms, denies, claim }
    }
    const now = new Date().toISOString()
    const nextVotes = votesSnapshot.docs.filter((item) => item.id !== userId).map((item) => item.data()).concat([{ vote }])
    const confirms = nextVotes.filter((item) => item.vote === 'CONFIRM').length
    const denies = nextVotes.filter((item) => item.vote === 'DENY').length
    const status = platformAdmin || groupAdmin ? (vote === 'CONFIRM' ? 'CONFIRMED' : 'DENIED') : confirms >= 2 ? 'CONFIRMED' : denies >= 2 ? 'DENIED' : 'PENDING'
    transaction.set(ref.collection('votes').doc(userId), { userId, vote, createdAt: oldVote.data()?.createdAt ?? now, updatedAt: now })
    if (status !== 'PENDING') {
      transaction.update(ref, { status, resolvedAt: now, resolvedAtBy: userId, updatedAt: now })
      if (status === 'CONFIRMED') transaction.set(db.collection('eventCardApprovals').doc(approvalId(String(claim.eventId), cardKey)), { eventId: claim.eventId, cardKey, approvedAt: now, approvedBy: userId, sourceClaimId: ref.id })
    }
    return { changed: true, status, confirms, denies, claim: { ...claim, status }, resolvedNow: status !== 'PENDING' }
  })

  if (!outcome.changed) return { ...outcome, alreadyVoted: true }
  if (outcome.status === 'CONFIRMED') {
    await rewardClaim(ref, outcome.claim)
    const matchingClaims = await confirmMatchingClaims(ref, outcome.claim)
    const awarded = matchingClaims + 1
    await notifyEventParticipants(String(outcome.claim.eventId), { kind: 'SCORE_UPDATED', title: `Carta confermata - ${outcome.claim.cardTitle}`, message: awarded > 1 ? `Carta valida per ${awarded} giocatori: punti assegnati automaticamente e classifica aggiornata.` : `Carta valida: ${outcome.claim.spentCredits} punti assegnati. La classifica e aggiornata.`, path: `/events/${outcome.claim.eventId}`, actionLabel: 'Vedi classifica' })
  } else if (outcome.status === 'DENIED') {
    await notifyEventParticipants(String(outcome.claim.eventId), { kind: 'CLAIM_DENIED', title: `Carta contestata - ${outcome.claim.cardTitle}`, message: "La carta e stata negata. Dalla verifica puoi chiedere l'intervento dell'amministratore.", path: `/events/${outcome.claim.eventId}`, actionLabel: 'Apri verifica carta' })
  }
  return { ...outcome, adminDecision: platformAdmin || groupAdmin }
}

export async function approveKnownEventCard(eventId: string, cardKey: string) {
  const snapshot = await db.collection('eventCardApprovals').doc(approvalId(eventId, cardKey)).get()
  return snapshot.exists && Boolean(snapshot.data()?.approvedAt)
}

export async function notifyClaimantConfirmed(claim: Record<string, unknown>) {
  await notifyUser(String(claim.userId), { kind: 'CLAIM_CONFIRMED', title: 'Carta giocata confermata', message: `La carta vale ${claim.spentCredits} punti: la tua classifica si e aggiornata.`, path: `/events/${claim.eventId}` })
}
