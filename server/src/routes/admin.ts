import { Router } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const router = Router()

// Close predictions and calculate scores for an event (simplified)
router.post('/events/:id/close', requireAuth, async (req: AuthRequest, res) => {
  const eventId = req.params.id
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { groupId: true } })
  if (!event) return res.status(404).json({ error: 'event_not_found' })

  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: req.userId!, groupId: event.groupId } },
    select: { role: true }
  })
  if (membership?.role !== 'ADMIN') return res.status(403).json({ error: 'admin_required' })

  await prisma.event.update({ where: { id: eventId }, data: { state: 'PRONOSTICI_CHIUSI' } })
  const predictions = await prisma.prediction.findMany({
    where: { eventId },
    include: { card: { select: { basePoints: true } } }
  })
  const totals = new Map<string, number>()

  await prisma.$transaction(
    predictions.map((prediction) => {
      const points = (prediction.card?.basePoints ?? 0) + prediction.credits
      totals.set(prediction.userId, (totals.get(prediction.userId) ?? 0) + points)
      return prisma.prediction.update({
        where: { id: prediction.id },
        data: { resolved: true, points }
      })
    })
  )

  await prisma.$transaction(
    [...totals.entries()].map(([userId, points]) =>
      prisma.score.upsert({
        where: { userId_eventId: { userId, eventId } },
        update: { points, breakdown: { formula: 'base_points_plus_credits' } },
        create: {
          userId,
          eventId,
          points,
          breakdown: { formula: 'base_points_plus_credits' }
        }
      })
    )
  )
  res.json({ ok: true })
})

export default router
