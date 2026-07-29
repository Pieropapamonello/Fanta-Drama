import { getMessaging } from 'firebase-admin/messaging'
import { db, firebaseApp } from './firebase'

const appUrl = 'https://fanta-drama.onrender.com'

function channelsFromLegacy(preference: string) {
  if (preference === 'IN_APP') return []
  if (preference === 'TELEGRAM') return ['TELEGRAM']
  if (preference === 'EMAIL') return ['EMAIL']
  if (preference === 'BOTH') return ['TELEGRAM', 'EMAIL']
  return ['DEVICE', 'TELEGRAM', 'EMAIL']
}

export type NotificationPayload = {
  title: string
  message: string
  path?: string
  actionLabel?: string
  kind: 'EVENT_CREATED' | 'EVENT_CLOSED' | 'SCORE_UPDATED' | 'AUCTION_OPENED' | 'AUCTION_OUTBID' | 'AUCTION_WON' | 'AUCTION_REMINDER' | 'CLAIM_NEEDS_VOTES' | 'CLAIM_CONFIRMED' | 'CLAIM_DENIED' | 'APPEAL_OPENED' | 'APPEAL_DECIDED'
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

async function sendEmail(email: string, payload: NotificationPayload) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.NOTIFICATION_FROM
  if (!apiKey || !from) return { channel: 'email', status: 'pending_email_provider' }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [email],
      subject: `FantaDrama · ${payload.title}`,
      html: `<div style="font-family:Arial,sans-serif"><h2>${payload.title}</h2><p>${payload.message}</p><p><a href="${appUrl}${payload.path ?? '/dashboard'}">Apri FantaDrama</a></p></div>`
    })
  })
  return { channel: 'email', status: response.ok ? 'sent' : 'failed' }
}

async function sendDevicePush(userId: string, payload: NotificationPayload) {
  const subscriptions = await db.collection('pushSubscriptions').where('userId', '==', userId).get()
  if (subscriptions.empty) return { channel: 'device', status: 'pending_permission' }
  const deliveries = await Promise.all(subscriptions.docs.map(async (subscription) => {
    const token = String(subscription.data().token ?? '')
    if (!token) return 'failed'
    try {
      await getMessaging(firebaseApp).send({ token, notification: { title: payload.title, body: payload.message }, data: { path: payload.path ?? '/dashboard', url: `${appUrl}${payload.path ?? '/dashboard'}` }, webpush: { fcmOptions: { link: `${appUrl}${payload.path ?? '/dashboard'}` } } })
      return 'sent'
    } catch (error: any) {
      if (String(error?.code ?? '').includes('registration-token-not-registered')) await subscription.ref.delete()
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
  await db.collection('notifications').add({ userId, ...payload, preference: 'DEVICE_TEST', deliveries: [delivery], createdAt: new Date().toISOString() })
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
  const channels = Array.isArray(user.notificationChannels) ? user.notificationChannels.filter((channel): channel is string => ['DEVICE', 'TELEGRAM', 'EMAIL'].includes(String(channel))) : channelsFromLegacy(preference)
  const results: Array<{ channel: string, status: string }> = [{ channel: 'in_app', status: 'stored' }]
  if (channels.includes('DEVICE')) results.push(await sendDevicePush(userId, payload))
  if (channels.includes('TELEGRAM') && link.chatId) {
    try {
      await sendTelegramMessage(String(link.chatId), `✨ ${payload.title}\n\n${payload.message}`, payload.path ?? '/dashboard', undefined, payload.actionLabel ?? 'Apri FantaDrama')
      results.push({ channel: 'telegram', status: 'sent' })
    } catch { results.push({ channel: 'telegram', status: 'failed' }) }
  }
  if (channels.includes('EMAIL') && user.email) results.push(await sendEmail(String(user.email), payload))
  await db.collection('notifications').add({ userId, ...payload, preference, channels, deliveries: results, createdAt: new Date().toISOString() })
  return results
}

export async function notifyGroupMembers(groupId: string, payload: NotificationPayload, excludedUserIds: string[] = []) {
  const group = await db.collection('groups').doc(groupId).get()
  const memberIds = (group.data()?.memberIds as string[] | undefined) ?? []
  await Promise.allSettled(memberIds.filter((userId) => !excludedUserIds.includes(userId)).map((userId) => notifyUser(userId, payload)))
}
