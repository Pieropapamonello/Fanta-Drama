import { Router } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

const prisma = new PrismaClient()
const router = Router()

const createSchema = z.object({ title: z.string().min(1), description: z.string().optional(), startsAt: z.string(), endsAt: z.string(), groupId: z.string().min(1), closePredictionsAt: z.string().optional() })

router.post('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const data = createSchema.parse(req.body)
    const membership = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: req.userId!, groupId: data.groupId } }
    })
    if (membership?.role !== 'ADMIN') return res.status(403).json({ error: 'admin_required' })
    const event = await prisma.event.create({
      data: {
        title: data.title,
        description: data.description,
        startsAt: new Date(data.startsAt),
        endsAt: new Date(data.endsAt),
        closePredictionsAt: data.closePredictionsAt ? new Date(data.closePredictionsAt) : undefined,
        groupId: data.groupId
      }
    })
    res.json({ event })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

router.get('/', requireAuth, async (req: AuthRequest, res) => {
  const { groupId } = req.query
  const events = await prisma.event.findMany({
    where: {
      ...(groupId ? { groupId: String(groupId) } : {}),
      group: { members: { some: { userId: req.userId! } } }
    }
  })
  res.json({ events })
})

router.get('/:id', requireAuth, async (req: AuthRequest, res) => {
  const id = req.params.id
  const event = await prisma.event.findFirst({
    where: { id, group: { members: { some: { userId: req.userId! } } } }
  })
  if (!event) return res.status(404).json({ error: 'not_found' })
  res.json({ event })
})

export default router
