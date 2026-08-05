import { getMessaging } from 'firebase-admin/messaging'
import { FieldValue } from 'firebase-admin/firestore'
import { db, firebaseApp } from './firebase'

const appUrl = 'https://fanta-drama.onrender.com'

function channelsFromLegacy(preference: string) {
  if (preference === 'IN_APP') return []
  if (preference === 'TELEGRAM') return ['TELEGRAM']
  // E-mail notifications have deliberately been retired from the product.
  // Keep legacy profiles compatible, but only migrate them to the two
  // channels that are actually supported by FantaDrama.
  if (preference === 'EMAIL') return []
  if (preference === 'BOTH') return ['TELEGRAM']
  return ['DEVICE', 'TELEGRAM']
}

export type NotificationPayload = {
  title: string
  message: string
  path?: string
  actionLabel?: string
  telegramButtons?: Array<Array<Record<string, string>>>
  kind: 'EVENT_CREATED' | 'EVENT_CLOSED' | 'EVENT_JOINED' | 'EVENT_CARD_CREATED' | 'SCORE_UPDATED' | 'AUCTION_OPENED' | 'AUCTION_OUTBID' | 'AUCTION_WON' | 'AUCTION_REMINDER' | 'CLAIM_NEEDS_VOTES' | 'CLAIM_REMINDER' | 'CLAIM_ADMIN_REVIEW' | 'CLAIM_CONFIRMED' | 'CLAIM_DENIED' | 'APPEAL_OPENED' | 'APPEAL_DECIDED'
}

async function storeUnreadNotification(userId: string, notification: Record<string, unknown>) {
  const createdAt = new Date().toISOString()
  const notificationRef = db.collection('notifications').doc()
  const userRef = db.collection('users').doc(userId)
  const batch = db.batch()
  batch.set(notificationRef, { userId, ...notification, createdAt })
  batch.set(userRef, {
    unreadNotificationCount: FieldValue.increment(1),
    updatedAt: createdAt
  }, { merge: true })
  await batch.commit()
}

export async function sendTelegramMessage(chatId: string | number, text: string, path = '/telegram-miniapp', extraButtons?: Array<Array<Record<string, string>>>, actionLabel = 'Apri FantaDrama') {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not configured')
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: {
        inline_keyboard: [...(extraButtons ?? []), [{ text: actionLabel, web_app: { url: `${appUrl}${path}` } }]]
      }
    })
  })
  if (!response.ok) throw new Error(`Telegram sendMessage failed: ${response.status}`)
}

async function sendDevicePush(userId: string, payload: NotificationPayload) {
  const subscriptions = await db.collection('pushSubscriptions').where('userId', '==', userId).get()
  if (subscriptions.empty) return { channel: 'device', status: 'pending_permission' }
  const uniqueTokens = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>()
  subscriptions.docs.forEach((subscription) => {
    const token = String(subscription.data().token ?? '')
    if (token) uniqueTokens.set(token, subscription)
  })
  const deliveries = await Promise.all([...uniqueTokens.values()].map(async (subscription) => {
    const token = String(subscription.data().token ?? '')
    if (!token) return 'failed'
    try {
      const path = payload.path ?? '/dashboard'
      const url = `${appUrl}${path}`
      await getMessaging(firebaseApp).send({ token, data: { title: payload.title, body: payload.message, path, url }, webpush: { headers: { Urgency: 'high' }, notification: { title: payload.title, body: payload.message, icon: '/icons/fantadrama-icon.svg', data: { path, url } }, fcmOptions: { link: url } } })
      return 'sent'
    } catch (error: any) {
      if (String(error?.code ?? '').includes('registration-token-not-registered')) await subscription.ref.delete()
      console.warn('Device notification failed', { userId, code: error?.code ?? 'unknown' })
      return 'failed'
    }
  }))
  return { channel: 'device', status: deliveries.includes('sent') ? 'sent' : 'failed' }
}

export async function sendDeviceNotificationTest(userId: string) {
  const payload: NotificationPayload = {
    title: 'Avvisi FantaDrama attivi',
    message: 'Test riuscito: riceverai qui rilanci, eventi e decisioni della crew.',
    path: '/notifications',
    kind: 'SCORE_UPDATED'
  }
  const delivery = await sendDevicePush(userId, payload)
  await storeUnreadNotification(userId, { ...payload, preference: 'DEVICE_TEST', deliveries: [delivery] })
  return delivery
}

export async function notifyUser(userId: string, payload: NotificationPayload) {
  const [userSnapshot, linkSnapshot] = await Promise.all([
    db.collection('users').doc(userId).get(),
    db.collection('telegramLinks').doc(userId).get()
  ])
  const user = userSnapshot.exists ? userSnapshot.data()! : {}
  const link = linkSnapshot.exists ? linkSnapshot.data()! : {}
  const preference = ['IN_APP', 'TELEGRAM', 'EMAIL', 'BOTH', 'ALL'].includes(String(user.notificationPreference)) ? String(user.notificationPreference) : 'ALL'
  // Only send externally through channels that the app currently exposes.
  // This also prevents old saved EMAIL preferences from producing unreliable
  // e-mails after the user has updated the app.
  const channels = Array.isArray(user.notificationChannels) ? user.notificationChannels.filter((channel): channel is string => ['DEVICE', 'TELEGRAM'].includes(String(channel))) : channelsFromLegacy(preference)
  const results: Array<{ channel: string, status: string }> = [{ channel: 'in_app', status: 'stored' }]
  if (channels.includes('DEVICE')) results.push(await sendDevicePush(userId, payload))
  if (channels.includes('TELEGRAM') && link.chatId) {
    try {
      await sendTelegramMessage(String(link.chatId), `✨ ${payload.title}\n\n${payload.message}`, payload.path ?? '/dashboard', payload.telegramButtons, payload.actionLabel ?? 'Apri FantaDrama')
      results.push({ channel: 'telegram', status: 'sent' })
    } catch (error: any) {
      console.warn('Telegram notification failed', { userId, code: error?.message ?? 'unknown' })
      results.push({ channel: 'telegram', status: 'failed' })
    }
  } else if (channels.includes('TELEGRAM')) {
    results.push({ channel: 'telegram', status: 'not_connected' })
  }
  await storeUnreadNotification(userId, { ...payload, preference, channels, deliveries: results })
  return results
}

export async function notifyGroupMembers(groupId: string, payload: NotificationPayload, excludedUserIds: string[] = []) {
  const group = await db.collection('groups').doc(groupId).get()
  const memberIds = (group.data()?.memberIds as string[] | undefined) ?? []
  await Promise.allSettled(memberIds.filter((userId) => !excludedUserIds.includes(userId)).map((userId) => notifyUser(userId, payload)))
}

export async function notifyEventParticipants(eventId: string, payload: NotificationPayload, excludedUserIds: string[] = []) {
  const event = await db.collection('events').doc(eventId).get()
  const ids = (event.data()?.participantIds as string[] | undefined) ?? []
  await Promise.allSettled(ids.filter(id => !excludedUserIds.includes(id)).map(id => notifyUser(id, payload)))
}
