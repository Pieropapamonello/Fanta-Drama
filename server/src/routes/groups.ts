import { Router } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

const prisma = new PrismaClient()
const router = Router()

const createSchema = z.object({ name: z.string().min(1), description: z.string().optional() })
const joinSchema = z.object({ code: z.string().min(1) })

router.post('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const data = createSchema.parse(req.body)
    const code = (Math.random().toString(36).substring(2, 8) + Date.now().toString(36)).toUpperCase().slice(0, 8)
    const group = await prisma.group.create({ data: { name: data.name, description: data.description || '', code } })
    await prisma.groupMember.create({ data: { userId: req.userId!, groupId: group.id, role: 'ADMIN' } })
    res.json({ group })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

router.post('/join', requireAuth, async (req: AuthRequest, res) => {
  try {
    const data = joinSchema.parse(req.body)
    const group = await prisma.group.findUnique({ where: { code: data.code } })
    if (!group) return res.status(404).json({ error: 'group_not_found' })
    const exists = await prisma.groupMember.findFirst({ where: { userId: req.userId!, groupId: group.id } })
    if (exists) return res.status(400).json({ error: 'already_member' })
    const member = await prisma.groupMember.create({ data: { userId: req.userId!, groupId: group.id, role: 'MEMBER' } })
    res.json({ group, member })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

router.get('/', requireAuth, async (req: AuthRequest, res) => {
  const memberships = await prisma.groupMember.findMany({ where: { userId: req.userId! }, include: { group: true } })
  res.json({ groups: memberships.map(m => m.group) })
})

router.get('/:id', requireAuth, async (req: AuthRequest, res) => {
  const id = req.params.id
  const group = await prisma.group.findUnique({ where: { id } })
  if (!group) return res.status(404).json({ error: 'not_found' })
  res.json({ group })
})

export default router
