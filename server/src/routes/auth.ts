import { Router } from 'express'
import { z } from 'zod'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const router = Router()

const registerSchema = z.object({ username: z.string().min(3), email: z.string().email(), password: z.string().min(8) })
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(8) })

router.post('/register', async (req, res) => {
  try {
    const data = registerSchema.parse(req.body)
    const existing = await prisma.user.findUnique({ where: { email: data.email } })
    if (existing) return res.status(409).json({ error: 'email_exists' })
    const hash = await bcrypt.hash(data.password, 10)
    const user = await prisma.user.create({ data: { username: data.username, email: data.email, passwordHash: hash } })
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' })
    res.json({ token })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

router.post('/login', async (req, res) => {
  try {
    const data = loginSchema.parse(req.body)
    const user = await prisma.user.findUnique({ where: { email: data.email } })
    if (!user) return res.status(401).json({ error: 'invalid_credentials' })
    const ok = await bcrypt.compare(data.password, user.passwordHash)
    if (!ok) return res.status(401).json({ error: 'invalid_credentials' })
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' })
    res.json({ token })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

export default router
