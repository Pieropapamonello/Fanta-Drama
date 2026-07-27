import { Router } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

const prisma = new PrismaClient()
const router = Router()

const createSchema = z.object({ title: z.string().min(1), description: z.string().optional(), rarity: z.string().optional(), type: z.string().optional(), basePoints: z.number().optional() })

router.post('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const data = createSchema.parse(req.body)
    const card = await prisma.dramaCard.create({ data: { title: data.title, description: data.description, rarity: (data.rarity as any) || 'COMMON', type: (data.type as any) || 'YES_NO', basePoints: data.basePoints || 5, author: req.userId } })
    res.json({ card })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

router.get('/', requireAuth, async (_req, res) => {
  const cards = await prisma.dramaCard.findMany({ orderBy: { createdAt: 'desc' } })
  res.json({ cards })
})

router.get('/:id', requireAuth, async (req, res) => {
  const id = req.params.id
  const card = await prisma.dramaCard.findUnique({ where: { id } })
  if (!card) return res.status(404).json({ error: 'not_found' })
  res.json({ card })
})

export default router
