import { Router } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

const prisma = new PrismaClient()
const router = Router()

const createSchema = z.object({ eventId: z.string(), cardId: z.string(), value: z.any(), credits: z.number().int().min(0), joker: z.boolean().optional() })

router.post('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const data = createSchema.parse(req.body)
    const evt = await prisma.event.findFirst({
      where: {
        id: data.eventId,
        state: 'PRONOSTICI_APERTI',
        group: { members: { some: { userId: req.userId! } } }
      }
    })
    if (!evt) return res.status(404).json({ error: 'event_not_found' })
    if (evt.closePredictionsAt && evt.closePredictionsAt <= new Date()) {
      return res.status(409).json({ error: 'predictions_closed' })
    }
    const aggregate = await prisma.prediction.aggregate({
      where: { eventId: data.eventId, userId: req.userId! },
      _sum: { credits: true }
    })
    if ((aggregate._sum.credits ?? 0) + data.credits > 100) {
      return res.status(409).json({ error: 'credits_exceeded' })
    }
    const pred = await prisma.prediction.create({
      data: {
        userId: req.userId!,
        eventId: data.eventId,
        cardId: data.cardId,
        value: data.value,
        credits: data.credits,
        joker: data.joker ?? false
      }
    })
    res.json({ prediction: pred })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

router.get('/event/:eventId', requireAuth, async (req: AuthRequest, res) => {
  const eventId = req.params.eventId
  const preds = await prisma.prediction.findMany({ where: { eventId, userId: req.userId } })
  res.json({ predictions: preds })
})

export default router
