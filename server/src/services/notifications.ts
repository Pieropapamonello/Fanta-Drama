import { db } from './firebase'

const appUrl = 'https://fanta-drama.onrender.com'

export type NotificationPayload = {
  title: string
  message: string
  path?: string
  kind: 'EVENT_CREATED' | 'EVENT_CLOSED' | 'SCORE_UPDATED'
}

export async function sendTelegramMessage(chatId: string | number, text: string, path = '/telegram-miniapp', extraButtons?: Array<Array<Record<string, string>>>) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not configured')
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: {
        inline_keyboard: [...(extraButtons ?? []), [{ text: 'Apri FantaDrama', web_app: { url: `${appUrl}${path}` } }]]
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

export async function notifyUser(userId: string, payload: NotificationPayload) {
  const [userSnapshot, linkSnapshot] = await Promise.all([
    db.collection('users').doc(userId).get(),
    db.collection('telegramLinks').doc(userId).get()
  ])
  const user = userSnapshot.exists ? userSnapshot.data()! : {}
  const link = linkSnapshot.exists ? linkSnapshot.data()! : {}
  const preference = ['IN_APP', 'TELEGRAM', 'EMAIL', 'BOTH', 'ALL'].includes(String(user.notificationPreference)) ? String(user.notificationPreference) : 'ALL'
  const results: Array<{ channel: string, status: string }> = [{ channel: 'in_app', status: 'stored' }]
  if ((preference === 'TELEGRAM' || preference === 'BOTH' || preference === 'ALL') && link.chatId) {
    try {
      await sendTelegramMessage(String(link.chatId), `✨ ${payload.title}\n\n${payload.message}`, payload.path ?? '/dashboard')
      results.push({ channel: 'telegram', status: 'sent' })
    } catch { results.push({ channel: 'telegram', status: 'failed' }) }
  }
  if ((preference === 'EMAIL' || preference === 'BOTH' || preference === 'ALL') && user.email) results.push(await sendEmail(String(user.email), payload))
  await db.collection('notifications').add({ userId, ...payload, preference, deliveries: results, createdAt: new Date().toISOString() })
  return results
}

export async function notifyGroupMembers(groupId: string, payload: NotificationPayload, excludedUserIds: string[] = []) {
  const group = await db.collection('groups').doc(groupId).get()
  const memberIds = (group.data()?.memberIds as string[] | undefined) ?? []
  await Promise.allSettled(memberIds.filter((userId) => !excludedUserIds.includes(userId)).map((userId) => notifyUser(userId, payload)))
}
