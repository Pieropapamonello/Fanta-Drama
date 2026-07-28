import { Router } from 'express'
import { db } from '../services/firebase'

const router = Router()
const appUrl = 'https://fanta-drama.onrender.com/telegram-miniapp'

type TelegramUser = { id?: number | string, first_name?: string, username?: string }
type TelegramMessage = { chat?: { id?: number | string }, from?: TelegramUser, text?: string }
type TelegramCallback = { id?: string, from?: TelegramUser, data?: string, message?: { chat?: { id?: number | string } } }

async function telegramApi(method: string, body: Record<string, unknown>) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not configured')
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  if (!response.ok) throw new Error(`Telegram ${method} failed: ${response.status}`)
}

const menuKeyboard = [
  [{ text: '🚀 Apri FantaDrama', web_app: { url: appUrl } }],
  [{ text: '👤 Il mio profilo', callback_data: 'profile' }, { text: '👥 I miei gruppi', callback_data: 'groups' }],
  [{ text: '📅 Eventi attivi', callback_data: 'events' }, { text: '🏆 I miei punti', callback_data: 'scores' }],
  [{ text: '↻ Aggiorna menu', callback_data: 'menu' }]
]

async function sendMenu(chatId: string | number, firstName?: string) {
  await telegramApi('sendMessage', { chat_id: chatId, text: `Ciao ${firstName || 'Giocatore'}! Da qui puoi consultare FantaDrama o aprire la Mini App per giocare.`, reply_markup: { inline_keyboard: menuKeyboard } })
}

async function rememberLink(user: TelegramUser, chatId: string | number) {
  if (!user.id) return
  await db.collection('telegramLinks').doc(`telegram_${user.id}`).set({ telegramUserId: String(user.id), chatId: String(chatId), username: user.username ?? null, firstName: user.first_name ?? null, updatedAt: new Date().toISOString() }, { merge: true })
}

async function registeredUser(telegramId?: string | number): Promise<{ id: string, username?: string, crewRole?: string, city?: string, motto?: string } | null> {
  if (!telegramId) return null
  const snapshot = await db.collection('users').doc(`telegram_${telegramId}`).get()
  if (!snapshot.exists) return null
  const data = snapshot.data() as Record<string, unknown>
  return {
    id: snapshot.id,
    username: typeof data.username === 'string' ? data.username : undefined,
    crewRole: typeof data.crewRole === 'string' ? data.crewRole : undefined,
    city: typeof data.city === 'string' ? data.city : undefined,
    motto: typeof data.motto === 'string' ? data.motto : undefined,
  }
}

async function sendMenuHint(chatId: string | number) {
  await telegramApi('sendMessage', { chat_id: chatId, text: 'Prima apri FantaDrama dal pulsante qui sotto: l’accesso Telegram crea e collega il tuo profilo in automatico.', reply_markup: { inline_keyboard: [[{ text: 'Apri FantaDrama', web_app: { url: appUrl } }]] } })
}

async function handleAction(chatId: string | number, from: TelegramUser, action: string) {
  if (action === 'menu') return sendMenu(chatId, from.first_name)
  const user = await registeredUser(from.id)
  if (!user) return sendMenuHint(chatId)
  if (action === 'profile') {
    const details = [`👤 *${user.username || from.first_name || 'Giocatore'}*`, user.crewRole ? `Ruolo: ${user.crewRole}` : '', user.city ? `Città: ${user.city}` : '', user.motto ? `“${user.motto}”` : 'Profilo pronto per il prossimo colpo di scena.'].filter(Boolean).join('\n')
    return telegramApi('sendMessage', { chat_id: chatId, text: details, parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: 'Modifica profilo', web_app: { url: `${appUrl.replace('/telegram-miniapp', '')}/profile/setup` } }], [{ text: '← Menu', callback_data: 'menu' }]] } })
  }
  if (action === 'groups') {
    const groups = await db.collection('groups').where('memberIds', 'array-contains', user.id).get()
    const text = groups.empty ? '👥 Non fai ancora parte di un gruppo. Apri l’app per crearne uno o usare un codice invito.' : `👥 *I tuoi gruppi*\n\n${groups.docs.slice(0, 8).map((group) => `• *${group.data().name}*\n  Codice invito: \`${group.data().code}\``).join('\n')}`
    return telegramApi('sendMessage', { chat_id: chatId, text, parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: 'Apri gruppi', web_app: { url: `${appUrl.replace('/telegram-miniapp', '')}/groups` } }], [{ text: '← Menu', callback_data: 'menu' }]] } })
  }
  if (action === 'events') {
    const groups = await db.collection('groups').where('memberIds', 'array-contains', user.id).get()
    const groupIds = new Set(groups.docs.map((group) => group.id))
    const allEvents = await db.collection('events').get()
    const events = allEvents.docs.filter((event) => groupIds.has(event.data().groupId) && event.data().state !== 'PRONOSTICI_CHIUSI').sort((a, b) => String(a.data().startsAt).localeCompare(String(b.data().startsAt))).slice(0, 8)
    const text = events.length ? `📅 *Eventi attivi*\n\n${events.map((event) => `• *${event.data().title}*\n  ${event.data().state} · inizio ${new Date(event.data().startsAt).toLocaleString('it-IT')}`).join('\n')}` : '📅 Nessun evento attivo nella tua crew in questo momento.'
    return telegramApi('sendMessage', { chat_id: chatId, text, parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: 'Apri eventi', web_app: { url: `${appUrl.replace('/telegram-miniapp', '')}/events` } }], [{ text: '← Menu', callback_data: 'menu' }]] } })
  }
  if (action === 'scores') {
    const scores = await db.collection('scores').where('userId', '==', user.id).get()
    const total = scores.docs.reduce((value, score) => value + Number(score.data().points ?? 0), 0)
    const text = `🏆 *I tuoi punti*\n\nTotale: *${total} punti*\nEventi valutati: ${scores.size}\n\nI punti si aggiornano automaticamente quando un evento viene chiuso.`
    return telegramApi('sendMessage', { chat_id: chatId, text, parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: 'Apri FantaDrama', web_app: { url: appUrl } }], [{ text: '← Menu', callback_data: 'menu' }]] } })
  }
}

router.post('/webhook', async (req, res) => {
  const configuredSecret = process.env.TELEGRAM_WEBHOOK_SECRET
  const receivedSecret = req.header('x-telegram-bot-api-secret-token')
  if (!configuredSecret || !receivedSecret || receivedSecret !== configuredSecret) return res.sendStatus(401)
  const update = req.body as { message?: TelegramMessage, callback_query?: TelegramCallback }
  const callback = update.callback_query
  try {
    if (callback?.message?.chat?.id && callback.from?.id) {
      await rememberLink(callback.from, callback.message.chat.id)
      if (callback.id) await telegramApi('answerCallbackQuery', { callback_query_id: callback.id })
      await handleAction(callback.message.chat.id, callback.from, callback.data || 'menu')
      return res.sendStatus(200)
    }
    const message = update.message
    if (!message?.chat?.id || !message.from?.id) return res.sendStatus(200)
    await rememberLink(message.from, message.chat.id)
    const command = message.text?.trim().split(/\s+/)[0]?.toLowerCase()
    if (command === '/start' || command === '/menu' || command === '/help') await sendMenu(message.chat.id, message.from.first_name)
    else if (command === '/profilo') await handleAction(message.chat.id, message.from, 'profile')
    else if (command === '/gruppi') await handleAction(message.chat.id, message.from, 'groups')
    else if (command === '/eventi') await handleAction(message.chat.id, message.from, 'events')
    else if (command === '/punti') await handleAction(message.chat.id, message.from, 'scores')
  } catch (error) { console.error('Telegram webhook processing failed', error) }
  return res.sendStatus(200)
})

export default router
