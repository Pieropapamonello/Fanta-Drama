import { Router } from 'express'
import { z } from 'zod'
import crypto from 'crypto'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { FieldValue } from 'firebase-admin/firestore'
import { db, documentData, firebaseAuth } from '../services/firebase'
import { notifyUser, sendDeviceNotificationTest } from '../services/notifications'

const router = Router()
const avatars = ['/characters/pulse.png', '/characters/mischief.png', '/characters/shock.png', '/characters/calm.png', '/avatars/common/violet-curly.png', '/avatars/common/silver-blue.png'] as const
const profileSchema = z.object({
  username: z.string().trim().min(3).max(30), avatar: z.union([z.enum(avatars), z.string().url().max(2048)]), bio: z.string().trim().max(160).optional(), city: z.string().trim().max(48).optional(),
  crewRole: z.enum(['Stratega', 'Creatore di caos', 'Osservatore', 'Regista del drama', 'Jolly']).optional(), motto: z.string().trim().max(90).optional(),
  notificationPreference: z.enum(['IN_APP', 'TELEGRAM', 'EMAIL', 'BOTH', 'ALL']).optional(),
  notificationChannels: z.array(z.enum(['DEVICE', 'TELEGRAM'])).optional(),
})
const pushSubscriptionSchema = z.object({ token: z.string().min(40).max(4096), platform: z.string().max(120).optional(), deviceId: z.string().min(8).max(120).optional() })
const pushDiagnosticSchema = z.object({ code: z.string().max(120).optional(), message: z.string().max(500).optional() })
const avatarSchema = z.object({ avatar: z.string().url().max(2048) })
const NOTIFICATION_LIST_LIMIT = 50
const OVERVIEW_NOTIFICATION_LIMIT = 8

function channelsFromLegacy(preference: string) {
  if (preference === 'IN_APP') return []
  if (preference === 'TELEGRAM') return ['TELEGRAM']
  if (preference === 'EMAIL') return []
  if (preference === 'BOTH') return ['TELEGRAM']
  return ['DEVICE', 'TELEGRAM']
}

function unreadNotificationCount(user: Record<string, unknown> | undefined) {
  const count = Number(user?.unreadNotificationCount ?? 0)
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0
}

function notificationWithReadState(id: string, data: Record<string, unknown>, notificationsReadAt: string) {
  const notification = documentData(id, data)
  if (notification.readAt || !notificationsReadAt) return notification
  const createdAt = Date.parse(String(notification.createdAt ?? ''))
  const readAt = Date.parse(notificationsReadAt)
  return Number.isFinite(readAt) && (!Number.isFinite(createdAt) || createdAt <= readAt)
    ? { ...notification, readAt: notificationsReadAt }
    : notification
}

async function profileWithConnections(userId: string) {
  const [snapshot, authUser, link] = await Promise.all([db.collection('users').doc(userId).get(), firebaseAuth.getUser(userId), db.collection('telegramLinks').doc(userId).get()])
  if (!snapshot.exists) return null
  const user = snapshot.data() as Record<string, unknown>
  return { id: snapshot.id, ...user, email: authUser.email ?? '', connections: { email: Boolean(authUser.email), telegram: link.exists && Boolean(link.data()?.chatId) } }
}

router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  const user = await profileWithConnections(req.userId!)
  if (!user) return res.status(404).json({ error: 'not_found' })
  return res.json({ user })
})

router.get('/overview', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!
  const [groups, cards, notifications] = await Promise.all([
    db.collection('groups').where('memberIds', 'array-contains', userId).get(),
    db.collection('cards').where('authorId', '==', userId).get(),
    db.collection('notifications').where('userId', '==', userId).limit(OVERVIEW_NOTIFICATION_LIMIT).get()
  ])
  const groupIds = new Set(groups.docs.map((group) => group.id))
  const allEvents = await db.collection('events').get()
  const nextEvents = allEvents.docs
    .filter((event) => groupIds.has(String(event.data().groupId)) && event.data().state !== 'PRONOSTICI_CHIUSI' && new Date(event.data().endsAt).getTime() > Date.now())
    .sort((left, right) => String(left.data().startsAt).localeCompare(String(right.data().startsAt)))
    .slice(0, 3)
    .map((event) => documentData(event.id, event.data() as Record<string, unknown>))
  const recentNotifications = notifications.docs
    .map((notification) => documentData(notification.id, notification.data() as Record<string, unknown>))
    .sort((left, right) => String(right.createdAt ?? '').localeCompare(String(left.createdAt ?? '')))
    .slice(0, 4)
  const primaryGroup = groups.docs[0]
  const primaryMemberIds = (primaryGroup?.data().memberIds as string[] | undefined) ?? []
  const primaryMembers = await Promise.all(primaryMemberIds.map(async (memberId) => {
    const member = await db.collection('users').doc(memberId).get(); const data = member.data() ?? {}
    return { id: memberId, username: data.username ?? 'Giocatore', avatar: data.avatar ?? '', crewRole: data.crewRole ?? 'Jolly' }
  }))
  const crewUpdates = allEvents.docs
    .filter((event) => event.data().groupId === primaryGroup?.id && new Date(String(event.data().endsAt)).getTime() > Date.now())
    .sort((left, right) => String(left.data().startsAt).localeCompare(String(right.data().startsAt)))
    .slice(0, 3)
    .map((event) => ({ id: event.id, title: String(event.data().title ?? 'Evento della crew'), message: String(event.data().liveUpdate ?? event.data().description ?? 'La crew si prepara al prossimo colpo di scena.'), startsAt: String(event.data().startsAt ?? '') }))
  return res.json({
    stats: { groups: groups.size, events: nextEvents.length, cards: cards.size },
    nextEvents, recentNotifications,
    primaryCrew: primaryGroup ? { id: primaryGroup.id, name: String(primaryGroup.data().name ?? 'La tua crew'), members: primaryMembers, updates: crewUpdates } : null
  })
})

router.get('/notifications', requireAuth, async (req: AuthRequest, res) => {
  const userRef = db.collection('users').doc(req.userId!)
  const [snapshot, userSnapshot] = await Promise.all([
    db.collection('notifications').where('userId', '==', req.userId!).limit(NOTIFICATION_LIST_LIMIT).get(),
    userRef.get()
  ])
  const user = userSnapshot.data() as Record<string, unknown> | undefined
  const notificationsReadAt = String(user?.notificationsReadAt ?? '')
  const notifications = snapshot.docs
    .map((item) => notificationWithReadState(item.id, item.data() as Record<string, unknown>, notificationsReadAt))
    .sort((left, right) => String(right.createdAt ?? '').localeCompare(String(left.createdAt ?? '')))
  return res.json({ notifications, unreadCount: unreadNotificationCount(user) })
})

router.get('/notifications/unread-count', requireAuth, async (req: AuthRequest, res) => {
  const user = await db.collection('users').doc(req.userId!).get()
  return res.json({ unreadCount: unreadNotificationCount(user.data() as Record<string, unknown> | undefined) })
})

router.post('/notifications/read', requireAuth, async (req: AuthRequest, res) => {
  const notificationsReadAt = new Date().toISOString()
  await db.collection('users').doc(req.userId!).set({ unreadNotificationCount: 0, notificationsReadAt, updatedAt: notificationsReadAt }, { merge: true })
  return res.json({ ok: true, notificationsReadAt })
})

router.post('/push-subscriptions', requireAuth, async (req: AuthRequest, res) => {
  try {
    const data = pushSubscriptionSchema.parse(req.body)
    const [existing, sameUser] = await Promise.all([
      db.collection('pushSubscriptions').where('token', '==', data.token).limit(1).get(),
      db.collection('pushSubscriptions').where('userId', '==', req.userId!).get()
    ])
    const sameDevice = data.deviceId ? sameUser.docs.find((item) => item.data()?.deviceId === data.deviceId) : undefined
    const ref = !existing.empty ? existing.docs[0].ref : sameDevice?.ref ?? db.collection('pushSubscriptions').doc()
    await ref.set({ userId: req.userId!, token: data.token, platform: data.platform ?? 'web', deviceId: data.deviceId ?? null, updatedAt: new Date().toISOString() }, { merge: true })
    // Device permission and a valid FCM token mean this channel is explicitly
    // usable.  Keep profile preferences aligned so a user does not have to
    // press both "Attiva avvisi" and a second channel-selection button.
    await db.collection('users').doc(req.userId!).set({ notificationChannels: FieldValue.arrayUnion('DEVICE'), updatedAt: new Date().toISOString() }, { merge: true })
    const stale = data.deviceId ? sameUser.docs.filter((item) => item.id !== ref.id && item.data()?.deviceId === data.deviceId) : []
    await Promise.all(stale.map((item) => item.ref.delete()))
    return res.json({ ok: true })
  } catch (error: any) { return res.status(400).json({ error: error.message ?? 'invalid_push_subscription' }) }
})

// Generated and uploaded avatars are real assets already stored by /assets.
// Persist the selected URL immediately so closing the profile screen cannot
// make a freshly uploaded avatar appear to have been lost.
router.put('/avatar', requireAuth, async (req: AuthRequest, res) => {
  try {
    const data = avatarSchema.parse(req.body)
    await db.collection('users').doc(req.userId!).set({ avatar: data.avatar, updatedAt: new Date().toISOString() }, { merge: true })
    return res.json({ ok: true, avatar: data.avatar })
  } catch (error: any) {
    return res.status(400).json({ error: error.message ?? 'invalid_avatar' })
  }
})

router.post('/push-diagnostics', requireAuth, async (req: AuthRequest, res) => {
  const data = pushDiagnosticSchema.parse(req.body)
  console.warn('Push registration diagnostic', { userId: req.userId, code: data.code ?? 'unknown', message: data.message ?? 'unknown' })
  return res.json({ ok: true })
})

router.post('/push-test', requireAuth, async (req: AuthRequest, res) => {
  const delivery = await sendDeviceNotificationTest(req.userId!)
  if (delivery.status !== 'sent') return res.status(409).json({ error: delivery.status })
  return res.json({ ok: true })
})

router.post('/notification-test', requireAuth, async (req: AuthRequest, res) => {
  const deliveries = await notifyUser(req.userId!, {
    title: 'Test canali FantaDrama',
    message: 'Se leggi questo avviso, il canale è pronto per rilanci, carte e aggiornamenti della crew.',
    path: '/notifications',
    actionLabel: 'Apri notifiche',
    kind: 'SCORE_UPDATED'
  })
  return res.json({ ok: true, deliveries })
})

router.post('/tutorial/complete', requireAuth, async (req: AuthRequest, res) => {
  const completedAt = new Date().toISOString()
  await db.collection('users').doc(req.userId!).set({ tutorialCompletedAt: completedAt, updatedAt: completedAt }, { merge: true })
  return res.json({ ok: true, completedAt })
})

router.put('/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const data = profileSchema.parse(req.body)
    const duplicate = await db.collection('users').where('username', '==', data.username).limit(1).get()
    if (!duplicate.empty && duplicate.docs[0].id !== req.userId) return res.status(409).json({ error: 'username_taken' })
    const ref = db.collection('users').doc(req.userId!)
    const current = await ref.get()
    if (!current.exists) return res.status(404).json({ error: 'not_found' })
    const authUser = await firebaseAuth.getUser(req.userId!)
    const profile = { ...current.data(), username: data.username, avatar: data.avatar, email: authUser.email ?? '', bio: data.bio ?? '', city: data.city ?? '', crewRole: data.crewRole ?? 'Jolly', motto: data.motto ?? '', notificationPreference: data.notificationPreference ?? String(current.data()?.notificationPreference ?? 'ALL'), notificationChannels: data.notificationChannels ?? channelsFromLegacy(String(current.data()?.notificationPreference ?? 'ALL')), profileCompleted: true, updatedAt: new Date().toISOString() }
    const usernameKey = (value: string) => crypto.createHash('sha256').update(value.trim().toLocaleLowerCase('it-IT')).digest('hex')
    const reservationRef = db.collection('usernames').doc(usernameKey(data.username))
    const previousName = String(current.data()?.username ?? '')
    const previousReservationRef = previousName && usernameKey(previousName) !== reservationRef.id ? db.collection('usernames').doc(usernameKey(previousName)) : null
    await db.runTransaction(async (transaction) => {
      const freshUser = await transaction.get(ref)
      const reservation = await transaction.get(reservationRef)
      const previousReservation = previousReservationRef ? await transaction.get(previousReservationRef) : null
      if (!freshUser.exists) throw new Error('not_found')
      if (reservation.exists && reservation.data()?.userId !== req.userId!) throw new Error('username_taken')
      transaction.set(ref, profile)
      transaction.set(reservationRef, { userId: req.userId!, username: data.username, updatedAt: profile.updatedAt })
      if (previousReservationRef && previousReservation?.data()?.userId === req.userId!) transaction.delete(previousReservationRef)
    })
    return res.json({ user: await profileWithConnections(req.userId!) })
  } catch (error: any) {
    if (error.message === 'username_taken') return res.status(409).json({ error: 'username_taken' })
    if (error.message === 'not_found') return res.status(404).json({ error: 'not_found' })
    return res.status(400).json({ error: error.message ?? 'invalid_profile' })
  }
})

router.post('/telegram-link', requireAuth, async (req: AuthRequest, res) => {
  const code = crypto.randomBytes(20).toString('base64url')
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()
  await db.collection('telegramLinkRequests').doc(code).set({ userId: req.userId!, expiresAt, createdAt: new Date().toISOString(), usedAt: null })
  return res.json({ code, expiresAt })
})

export default router
