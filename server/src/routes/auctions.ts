import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { db, groupRole } from '../services/firebase'
import { auctionsForEvent, buyEventCard, createEventAuctions, placeBid, sendAuctionReminder } from '../services/auctions'

const router = Router()
const bidSchema = z.object({ amount: z.number().int().positive().max(1_000_000) })

router.get('/event/:eventId', requireAuth, async (req: AuthRequest, res) => {
  const event = await db.collection('events').doc(req.params.eventId).get()
  if (!event.exists || !await groupRole(String(event.data()?.groupId), req.userId!)) return res.status(404).json({ error: 'event_not_found' })
  const existing = await db.collection('auctions').where('eventId', '==', event.id).limit(1).get()
  if (existing.empty && new Date(String(event.data()?.startsAt)).getTime() - 60 * 60 * 1000 > Date.now()) await createEventAuctions(event.id, event.data() as Record<string, unknown>)
  void sendAuctionReminder(event.id)
  return res.json(await auctionsForEvent(event.id, req.userId!))
})

router.post('/:id/bid', requireAuth, async (req: AuthRequest, res) => {
  try {
    const data = bidSchema.parse(req.body)
    const auction = await db.collection('auctions').doc(req.params.id).get()
    if (!auction.exists || !await groupRole(String(auction.data()?.groupId), req.userId!)) return res.status(404).json({ error: 'auction_not_found' })
    return res.json({ auction: await placeBid(auction.id, req.userId!, data.amount) })
  } catch (error: any) { return res.status(409).json({ error: error.message ?? 'bid_failed' }) }
})

router.post('/:id/buy', requireAuth, async (req: AuthRequest, res) => {
  try {
    const auction = await db.collection('auctions').doc(req.params.id).get()
    if (!auction.exists || !await groupRole(String(auction.data()?.groupId), req.userId!)) return res.status(404).json({ error: 'card_not_found' })
    return res.json({ purchase: await buyEventCard(auction.id, req.userId!) })
  } catch (error: any) { return res.status(409).json({ error: error.message ?? 'direct_purchase_failed' }) }
})

export default router
