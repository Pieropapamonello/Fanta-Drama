import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { db, documentData, groupRole } from '../services/firebase'

const router = Router()
const schema = z.object({ name: z.string().trim().min(1).max(80), nickname: z.string().trim().max(80).optional(), image: z.string().url().optional(), groupId: z.string().min(1) })

router.post('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const data = schema.parse(req.body)
    if (await groupRole(data.groupId, req.userId!) !== 'ADMIN') return res.status(403).json({ error: 'admin_required' })
    const ref = db.collection('characters').doc()
    const character = { ...data, nickname: data.nickname ?? '', image: data.image ?? '', createdAt: new Date().toISOString() }
    await ref.set(character)
    return res.status(201).json({ character: documentData(ref.id, character) })
  } catch (error: any) { return res.status(400).json({ error: error.message ?? 'invalid_character' }) }
})

router.get('/group/:groupId', requireAuth, async (req: AuthRequest, res) => {
  if (!await groupRole(req.params.groupId, req.userId!)) return res.status(404).json({ error: 'not_found' })
  const snapshot = await db.collection('characters').where('groupId', '==', req.params.groupId).get()
  return res.json({ characters: snapshot.docs.map((doc) => documentData(doc.id, doc.data() as Record<string, unknown>)) })
})

export default router
