import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { db, documentData } from '../services/firebase'

const router = Router()
const schema = z.object({
  title: z.string().trim().min(1).max(100), description: z.string().trim().max(500).optional(),
  rarity: z.enum(['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC']).optional(),
  type: z.enum(['YES_NO', 'PICK_CHARACTER', 'MULTI_CHOICE', 'NUMBER', 'RANGE', 'TIME', 'TEXT', 'FIRST_ACTION', 'ORDER']).optional(),
  basePoints: z.number().int().min(0).max(100).optional()
})

router.post('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const data = schema.parse(req.body)
    const ref = db.collection('cards').doc()
    const card = { ...data, description: data.description ?? '', rarity: data.rarity ?? 'COMMON', type: data.type ?? 'YES_NO', basePoints: data.basePoints ?? 5, authorId: req.userId!, createdAt: new Date().toISOString() }
    await ref.set(card)
    return res.status(201).json({ card: documentData(ref.id, card) })
  } catch (error: any) { return res.status(400).json({ error: error.message ?? 'invalid_card' }) }
})

router.get('/', requireAuth, async (_req, res) => {
  const snapshot = await db.collection('cards').orderBy('createdAt', 'desc').get()
  return res.json({ cards: snapshot.docs.map((doc) => documentData(doc.id, doc.data() as Record<string, unknown>)) })
})

router.get('/:id', requireAuth, async (req, res) => {
  const snapshot = await db.collection('cards').doc(req.params.id).get()
  if (!snapshot.exists) return res.status(404).json({ error: 'not_found' })
  return res.json({ card: documentData(snapshot.id, snapshot.data() as Record<string, unknown>) })
})

export default router
