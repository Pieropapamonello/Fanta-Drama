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
    // ensure event exists
    const evt = await prisma.event.findUnique({ where: { id: data.eventId } })
    if (!evt) return res.status(404).json({ error: 'event_not_found' })
    // check user credits and existing prediction logic omitted (MVP assumes credit available)
    const pred = await prisma.prediction.create({ data: { userId: req.userId!, eventId: data.eventId, credits: data.credits } })
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
