import { Router } from 'express'
import crypto from 'crypto'
import { z } from 'zod'
import { FieldValue } from 'firebase-admin/firestore'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { db, documentData } from '../services/firebase'
import { isPlatformAdmin } from '../services/platform-admin'

const router = Router()
const createSchema = z.object({ name: z.string().trim().min(1).max(80), description: z.string().trim().max(500).optional() })
const joinSchema = z.object({ code: z.string().trim().min(1).max(16) })

function inviteCode() {
  return crypto.randomBytes(6).toString('base64url').toUpperCase().slice(0, 8)
}

router.post('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const data = createSchema.parse(req.body)
    const ref = db.collection('groups').doc()
    const group = {
      name: data.name,
      description: data.description ?? '',
      code: inviteCode(),
      memberIds: [req.userId!],
      memberRoles: { [req.userId!]: 'ADMIN' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    await ref.set(group)
    return res.status(201).json({ group: documentData(ref.id, group) })
  } catch (error: any) {
    return res.status(400).json({ error: error.message ?? 'invalid_group' })
  }
})

router.post('/join', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { code } = joinSchema.parse(req.body)
    const matches = await db.collection('groups').where('code', '==', code.toUpperCase()).limit(1).get()
    if (matches.empty) return res.status(404).json({ error: 'group_not_found' })
    const group = matches.docs[0]
    if ((group.data().memberIds as string[]).includes(req.userId!)) return res.status(409).json({ error: 'already_member' })
    await group.ref.update({
      memberIds: FieldValue.arrayUnion(req.userId!),
      [`memberRoles.${req.userId!}`]: 'MEMBER',
      updatedAt: new Date().toISOString()
    })
    const updated = await group.ref.get()
    return res.json({ group: documentData(updated.id, updated.data() as Record<string, unknown>) })
  } catch (error: any) {
    return res.status(400).json({ error: error.message ?? 'join_failed' })
  }
})

router.get('/', requireAuth, async (req: AuthRequest, res) => {
  const snapshot = await (await isPlatformAdmin(req.userId!)
    ? db.collection('groups').get()
    : db.collection('groups').where('memberIds', 'array-contains', req.userId!).get())
  return res.json({ groups: snapshot.docs.map((doc) => documentData(doc.id, doc.data() as Record<string, unknown>)) })
})

router.get('/:id', requireAuth, async (req: AuthRequest, res) => {
  const snapshot = await db.collection('groups').doc(req.params.id).get()
  if (!snapshot.exists || (!(snapshot.data()?.memberIds as string[]).includes(req.userId!) && !await isPlatformAdmin(req.userId!))) return res.status(404).json({ error: 'not_found' })
  return res.json({ group: documentData(snapshot.id, snapshot.data() as Record<string, unknown>) })
})

router.delete('/:id', requireAuth, async (req: AuthRequest, res) => {
  const groupRef = db.collection('groups').doc(req.params.id)
  const group = await groupRef.get()
  if (!group.exists) return res.status(404).json({ error: 'not_found' })
  if (group.data()?.memberRoles?.[req.userId!] !== 'ADMIN' && !await isPlatformAdmin(req.userId!)) return res.status(403).json({ error: 'admin_required' })

  const [characters, events] = await Promise.all([
    db.collection('characters').where('groupId', '==', group.id).get(),
    db.collection('events').where('groupId', '==', group.id).get()
  ])
  const eventIds = events.docs.map((event) => event.id)
  const relatedPredictions = await Promise.all(eventIds.map((eventId) => db.collection('predictions').where('eventId', '==', eventId).get()))
  const relatedScores = await Promise.all(eventIds.map((eventId) => db.collection('scores').where('eventId', '==', eventId).get()))
  const refs = [groupRef, ...characters.docs.map((doc) => doc.ref), ...events.docs.map((doc) => doc.ref), ...relatedPredictions.flatMap((snapshot) => snapshot.docs.map((doc) => doc.ref)), ...relatedScores.flatMap((snapshot) => snapshot.docs.map((doc) => doc.ref))]

  while (refs.length) {
    const batch = db.batch()
    refs.splice(0, 450).forEach((ref) => batch.delete(ref))
    await batch.commit()
  }
  return res.json({ ok: true })
})

export default router
