import { Router } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

const prisma = new PrismaClient()
const router = Router()

const createSchema = z.object({ name: z.string().min(1), nickname: z.string().optional(), image: z.string().optional(), groupId: z.string() })

router.post('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const data = createSchema.parse(req.body)
    const character = await prisma.character.create({ data: { name: data.name, nickname: data.nickname, image: data.image, groupId: data.groupId } })
    res.json({ character })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

router.get('/group/:groupId', requireAuth, async (req: AuthRequest, res) => {
  const groupId = req.params.groupId
  const chars = await prisma.character.findMany({ where: { groupId } })
  res.json({ characters: chars })
})

export default router
