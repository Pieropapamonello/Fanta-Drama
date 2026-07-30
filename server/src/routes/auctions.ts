import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { db, groupRole } from '../services/firebase'
import { isPlatformAdmin } from '../services/platform-admin'
import { auctionsForEvent, buyEventCard, createEventAuctions, DEFAULT_DIRECT_CARD_PRICE, placeBid, sendAuctionReminder } from '../services/auctions'

const router = Router()
const bidSchema = z.object({ amount: z.number().int().positive().max(1_000_000) })

router.get('/event/:eventId', requireAuth, async (req: AuthRequest, res) => {
  const event = await db.collection('events').doc(req.params.eventId).get()
  if (!event.exists || (!await groupRole(String(event.data()?.groupId), req.userId!) && !await isPlatformAdmin(req.userId!))) return res.status(404).json({ error: 'event_not_found' })
  if (!((event.data()?.participantIds as string[] | undefined) ?? []).includes(req.userId!)) return res.status(403).json({ error: 'join_event_first' })
  const existing = await db.collection('auctions').where('eventId', '==', event.id).get()
  const canCreate = event.data()?.acquisitionMode === 'DIRECT' ? new Date(String(event.data()?.endsAt)).getTime() > Date.now() : new Date(String(event.data()?.startsAt)).getTime() - 60 * 60 * 1000 > Date.now()
  // Keep every event in sync with the public catalogue. Event-only cards are
  // added separately and are already returned by this same query.
  if (canCreate) await createEventAuctions(event.id, event.data() as Record<string, unknown>)
  if (event.data()?.acquisitionMode === 'DIRECT' && !existing.empty) {
    const batch = db.batch(); let changed = false
    existing.docs.forEach((card) => {
      const data = card.data(); const status = ['OPEN', 'UNSOLD'].includes(String(data.status)) && !data.ownerId ? 'AVAILABLE' : data.status
      const directPrice = data.directPriceConfigured === true ? Math.max(1, Number(data.directPrice ?? DEFAULT_DIRECT_CARD_PRICE)) : DEFAULT_DIRECT_CARD_PRICE
      if (data.acquisitionMode !== 'DIRECT' || status !== data.status || data.closesAt !== event.data()?.endsAt || data.directPrice !== directPrice || data.directPriceConfigured !== true) { batch.set(card.ref, { acquisitionMode: 'DIRECT', status, directPrice, directPriceConfigured: true, closesAt: event.data()?.endsAt, updatedAt: new Date().toISOString() }, { merge: true }); changed = true }
    })
    if (changed) await batch.commit()
  }
  void sendAuctionReminder(event.id)
  return res.json(await auctionsForEvent(event.id, req.userId!))
})

router.post('/:id/bid', requireAuth, async (req: AuthRequest, res) => {
  try {
    const data = bidSchema.parse(req.body)
    const auction = await db.collection('auctions').doc(req.params.id).get()
    if (!auction.exists || (!await groupRole(String(auction.data()?.groupId), req.userId!) && !await isPlatformAdmin(req.userId!))) return res.status(404).json({ error: 'auction_not_found' })
    const event = await db.collection('events').doc(String(auction.data()?.eventId)).get()
    if (!event.exists || !((event.data()?.participantIds as string[] | undefined) ?? []).includes(req.userId!)) return res.status(403).json({ error: 'join_event_first' })
    return res.json({ auction: await placeBid(auction.id, req.userId!, data.amount) })
  } catch (error: any) { return res.status(409).json({ error: error.message ?? 'bid_failed' }) }
})

router.post('/:id/buy', requireAuth, async (req: AuthRequest, res) => {
  try {
    const auction = await db.collection('auctions').doc(req.params.id).get()
    if (!auction.exists || (!await groupRole(String(auction.data()?.groupId), req.userId!) && !await isPlatformAdmin(req.userId!))) return res.status(404).json({ error: 'card_not_found' })
    const event = await db.collection('events').doc(String(auction.data()?.eventId)).get()
    if (!event.exists || !((event.data()?.participantIds as string[] | undefined) ?? []).includes(req.userId!)) return res.status(403).json({ error: 'join_event_first' })
    return res.json({ purchase: await buyEventCard(auction.id, req.userId!) })
  } catch (error: any) { return res.status(409).json({ error: error.message ?? 'direct_purchase_failed' }) }
})

export default router
