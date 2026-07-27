import { Router } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const router = Router()

router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, username: true, email: true, avatar: true, createdAt: true } })
  if (!user) return res.status(404).json({ error: 'not_found' })
  res.json({ user })
})

export default router
