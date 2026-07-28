import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { db, documentData, groupRole } from '../services/firebase'
import { closeAndScoreEvent } from '../services/scoring'
import { grantPlatformAdmin, isPlatformAdmin, isValidAdminPassword, revokePlatformAdmin } from '../services/platform-admin'

const router = Router()
const passwordSchema = z.object({ password: z.string().min(1).max(256) })

async function requirePlatformAdmin(req: AuthRequest, res: any, next: any) {
  if (!req.userId || !await isPlatformAdmin(req.userId)) return res.status(403).json({ error: 'platform_admin_required' })
  next()
}

router.get('/status', requireAuth, async (req: AuthRequest, res) => res.json({ isAdmin: await isPlatformAdmin(req.userId!) }))

router.post('/unlock', requireAuth, async (req: AuthRequest, res) => {
  const configured = process.env.ADMIN_PASSWORD
  if (!configured) return res.status(503).json({ error: 'admin_password_not_configured' })
  const { password } = passwordSchema.parse(req.body)
  if (!isValidAdminPassword(password)) return res.status(401).json({ error: 'invalid_admin_password' })
  await grantPlatformAdmin(req.userId!, 'WEB')
  return res.json({ ok: true })
})

router.post('/lock', requireAuth, async (req: AuthRequest, res) => {
  await revokePlatformAdmin(req.userId!)
  return res.json({ ok: true })
})

router.get('/overview', requireAuth, requirePlatformAdmin, async (_req, res) => {
  const [groups, users, events] = await Promise.all([db.collection('groups').get(), db.collection('users').get(), db.collection('events').get()])
  const groupNames = new Map(groups.docs.map((group) => [group.id, String(group.data().name ?? 'Gruppo senza nome')]))
  return res.json({
    stats: { groups: groups.size, users: users.size, events: events.size },
    groups: groups.docs.map((group) => documentData(group.id, { ...group.data(), memberCount: Array.isArray(group.data().memberIds) ? group.data().memberIds.length : 0 })),
    events: events.docs.map((event) => documentData(event.id, { ...event.data(), groupName: groupNames.get(String(event.data().groupId)) ?? 'Gruppo eliminato' })),
    users: users.docs.map((user) => documentData(user.id, user.data() as Record<string, unknown>))
  })
})

router.post('/events/:id/close', requireAuth, async (req: AuthRequest, res) => {
  try {
    const eventSnapshot = await db.collection('events').doc(req.params.id).get()
    if (!eventSnapshot.exists) return res.status(404).json({ error: 'event_not_found' })
    const canManage = await isPlatformAdmin(req.userId!) || await groupRole(eventSnapshot.data()!.groupId, req.userId!) === 'ADMIN'
    if (!canManage) return res.status(403).json({ error: 'admin_required' })
    const result = await closeAndScoreEvent(eventSnapshot.id, 'manual')
    return res.json({ ok: true, alreadyClosed: result.alreadyClosed, scoredUsers: result.totals.size })
  } catch (error: any) { return res.status(400).json({ error: error.message ?? 'close_failed' }) }
})

export { requirePlatformAdmin }
export default router
