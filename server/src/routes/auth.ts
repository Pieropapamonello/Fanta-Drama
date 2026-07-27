import { Router } from 'express'
import { z } from 'zod'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'
import { getJwtSecret } from '../config/auth'

const prisma = new PrismaClient()
const router = Router()

const passwordSchema = z.string()
  .min(8)
  .regex(/[A-Za-z]/, 'La password deve contenere almeno una lettera')
  .regex(/\d/, 'La password deve contenere almeno un numero')

const registerSchema = z.object({
  username: z.string().trim().min(3).max(30),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: passwordSchema
})
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(8) })

router.post('/register', async (req, res) => {
  try {
    const data = registerSchema.parse(req.body)
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: data.email }, { username: data.username }] },
      select: { email: true }
    })
    if (existing) {
      return res.status(409).json({
        error: existing.email === data.email ? 'email_exists' : 'username_exists'
      })
    }
    const hash = await bcrypt.hash(data.password, 10)
    const user = await prisma.user.create({ data: { username: data.username, email: data.email, passwordHash: hash } })
    const token = jwt.sign({ userId: user.id }, getJwtSecret(), { expiresIn: '15m' })
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
    const token = jwt.sign({ userId: user.id }, getJwtSecret(), { expiresIn: '15m' })
    res.json({ token })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

export default router
