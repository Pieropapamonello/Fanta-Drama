import { Router } from 'express'
import { db } from '../services/firebase'
import { grantPlatformAdmin, isPlatformAdmin, isValidAdminPassword } from '../services/platform-admin'

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

function menuKeyboard(isAdmin = false) {
  const keyboard: Array<Array<Record<string, unknown>>> = [
    [{ text: 'Apri FantaDrama', web_app: { url: appUrl } }],
    [{ text: 'Il mio profilo', callback_data: 'profile' }, { text: 'I miei gruppi', callback_data: 'groups' }],
    [{ text: 'Eventi attivi', callback_data: 'events' }, { text: 'I miei punti', callback_data: 'scores' }]
  ]
  if (isAdmin) keyboard.push([{ text: 'Console admin', callback_data: 'admin' }])
  keyboard.push([{ text: 'Aggiorna menu', callback_data: 'menu' }])
  return keyboard
}

async function sendMenu(chatId: string | number, firstName?: string, isAdmin = false) {
  await telegramApi('sendMessage', { chat_id: chatId, text: `Ciao ${firstName || 'Giocatore'}! Da qui puoi consultare FantaDrama o aprire la Mini App per giocare.`, reply_markup: { inline_keyboard: menuKeyboard(isAdmin) } })
}

async function rememberLink(user: TelegramUser, chatId: string | number) {
  if (!user.id) return
  const links = await db.collection('telegramLinks').where('telegramUserId', '==', String(user.id)).limit(1).get()
  const ref = links.empty ? db.collection('telegramLinks').doc(`telegram_${user.id}`) : links.docs[0].ref
  await ref.set({ telegramUserId: String(user.id), chatId: String(chatId), username: user.username ?? null, firstName: user.first_name ?? null, updatedAt: new Date().toISOString() }, { merge: true })
}

async function registeredUser(telegramId?: string | number): Promise<{ id: string, username?: string, crewRole?: string, city?: string, motto?: string } | null> {
  if (!telegramId) return null
  const links = await db.collection('telegramLinks').where('telegramUserId', '==', String(telegramId)).limit(1).get()
  const userId = links.empty ? `telegram_${telegramId}` : links.docs[0].id
  const snapshot = await db.collection('users').doc(userId).get()
  if (!snapshot.exists) return null
  const data = snapshot.data() as Record<string, unknown>
  return { id: snapshot.id, username: typeof data.username === 'string' ? data.username : undefined, crewRole: typeof data.crewRole === 'string' ? data.crewRole : undefined, city: typeof data.city === 'string' ? data.city : undefined, motto: typeof data.motto === 'string' ? data.motto : undefined }
}

async function isTelegramAdmin(telegramId?: string | number) {
  const user = await registeredUser(telegramId)
  return Boolean(user && await isPlatformAdmin(user.id))
}

async function completeTelegramLink(chatId: string | number, from: TelegramUser, code: string) {
  const requestRef = db.collection('telegramLinkRequests').doc(code)
  const request = await requestRef.get()
  const data = request.data()
  if (!request.exists || !data?.userId || data.usedAt || new Date(data.expiresAt).getTime() < Date.now()) return telegramApi('sendMessage', { chat_id: chatId, text: 'Questo link non e piu valido. Torna nel profilo FantaDrama e creane uno nuovo.' })
  const links = await db.collection('telegramLinks').where('telegramUserId', '==', String(from.id)).limit(1).get()
  if (!links.empty && links.docs[0].id !== data.userId) {
    const existingUser = await db.collection('users').doc(links.docs[0].id).get()
    if (existingUser.exists) return telegramApi('sendMessage', { chat_id: chatId, text: 'Questo account Telegram e gia collegato a un altro profilo FantaDrama.' })
    await links.docs[0].ref.delete()
  }
  await db.collection('telegramLinks').doc(data.userId).set({ telegramUserId: String(from.id), chatId: String(chatId), username: from.username ?? null, firstName: from.first_name ?? null, linkedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, { merge: true })
  await requestRef.update({ usedAt: new Date().toISOString() })
  await telegramApi('sendMessage', { chat_id: chatId, text: 'Telegram e collegato al tuo profilo FantaDrama.', reply_markup: { inline_keyboard: [[{ text: 'Apri FantaDrama', web_app: { url: appUrl } }]] } })
}

async function sendMenuHint(chatId: string | number) {
  await telegramApi('sendMessage', { chat_id: chatId, text: 'Prima apri FantaDrama dal pulsante qui sotto: l accesso Telegram crea e collega il tuo profilo in automatico.', reply_markup: { inline_keyboard: [[{ text: 'Apri FantaDrama', web_app: { url: appUrl } }]] } })
}

async function sendAdminPanel(chatId: string | number, from: TelegramUser) {
  const user = await registeredUser(from.id)
  if (!user || !await isPlatformAdmin(user.id)) return telegramApi('sendMessage', { chat_id: chatId, text: 'Accesso admin non autorizzato.' })
  const [groups, users, events] = await Promise.all([db.collection('groups').get(), db.collection('users').get(), db.collection('events').get()])
  const text = `Console admin\n\nUtenti: ${users.size}\nGruppi: ${groups.size}\nEventi: ${events.size}\n\nPuoi vedere tutti i gruppi e aprire la console completa nella Mini App.`
  return telegramApi('sendMessage', { chat_id: chatId, text, reply_markup: { inline_keyboard: [
    [{ text: 'Elenco gruppi', callback_data: 'admin_groups' }, { text: 'Aggiorna dati', callback_data: 'admin' }],
    [{ text: 'Apri console completa', web_app: { url: `${appUrl.replace('/telegram-miniapp', '')}/admin` } }],
    [{ text: 'Menu', callback_data: 'menu' }]
  ] } })
}

async function sendAdminGroups(chatId: string | number, from: TelegramUser) {
  const user = await registeredUser(from.id)
  if (!user || !await isPlatformAdmin(user.id)) return telegramApi('sendMessage', { chat_id: chatId, text: 'Accesso admin non autorizzato.' })
  const groups = await db.collection('groups').get()
  const lines = groups.docs.slice(0, 20).map((group) => `- ${group.data().name} (${Array.isArray(group.data().memberIds) ? group.data().memberIds.length : 0} membri), codice: ${group.data().code}`)
  return telegramApi('sendMessage', { chat_id: chatId, text: lines.length ? `Tutti i gruppi\n\n${lines.join('\n')}` : 'Non ci sono gruppi da mostrare.', reply_markup: { inline_keyboard: [[{ text: 'Console admin', callback_data: 'admin' }]] } })
}

async function handleAction(chatId: string | number, from: TelegramUser, action: string) {
  if (action === 'menu') return sendMenu(chatId, from.first_name, await isTelegramAdmin(from.id))
  const user = await registeredUser(from.id)
  if (!user) return sendMenuHint(chatId)
  if (action === 'admin') return sendAdminPanel(chatId, from)
  if (action === 'admin_groups') return sendAdminGroups(chatId, from)
  if (action === 'profile') {
    const details = [`Profilo: ${user.username || from.first_name || 'Giocatore'}`, user.crewRole ? `Ruolo: ${user.crewRole}` : '', user.city ? `Citta: ${user.city}` : '', user.motto ? user.motto : 'Profilo pronto per il prossimo colpo di scena.'].filter(Boolean).join('\n')
    return telegramApi('sendMessage', { chat_id: chatId, text: details, reply_markup: { inline_keyboard: [[{ text: 'Modifica profilo', web_app: { url: `${appUrl.replace('/telegram-miniapp', '')}/profile/setup` } }], [{ text: 'Menu', callback_data: 'menu' }]] } })
  }
  if (action === 'groups') {
    const groups = await db.collection('groups').where('memberIds', 'array-contains', user.id).get()
    const text = groups.empty ? 'Non fai ancora parte di un gruppo. Apri l app per crearne uno o usare un codice invito.' : `I tuoi gruppi\n\n${groups.docs.slice(0, 8).map((group) => `- ${group.data().name}\n  Codice invito: ${group.data().code}`).join('\n')}`
    return telegramApi('sendMessage', { chat_id: chatId, text, reply_markup: { inline_keyboard: [[{ text: 'Apri gruppi', web_app: { url: `${appUrl.replace('/telegram-miniapp', '')}/groups` } }], [{ text: 'Menu', callback_data: 'menu' }]] } })
  }
  if (action === 'events') {
    const groups = await db.collection('groups').where('memberIds', 'array-contains', user.id).get()
    const groupIds = new Set(groups.docs.map((group) => group.id))
    const allEvents = await db.collection('events').get()
    const events = allEvents.docs.filter((event) => groupIds.has(event.data().groupId) && event.data().state !== 'PRONOSTICI_CHIUSI').sort((a, b) => String(a.data().startsAt).localeCompare(String(b.data().startsAt))).slice(0, 8)
    const text = events.length ? `Eventi attivi\n\n${events.map((event) => `- ${event.data().title}\n  ${event.data().state} - ${new Date(event.data().startsAt).toLocaleString('it-IT')}`).join('\n')}` : 'Nessun evento attivo nella tua crew in questo momento.'
    return telegramApi('sendMessage', { chat_id: chatId, text, reply_markup: { inline_keyboard: [[{ text: 'Apri eventi', web_app: { url: `${appUrl.replace('/telegram-miniapp', '')}/events` } }], [{ text: 'Menu', callback_data: 'menu' }]] } })
  }
  if (action === 'scores') {
    const scores = await db.collection('scores').where('userId', '==', user.id).get()
    const total = scores.docs.reduce((value, score) => value + Number(score.data().points ?? 0), 0)
    return telegramApi('sendMessage', { chat_id: chatId, text: `I tuoi punti\n\nTotale: ${total} punti\nEventi valutati: ${scores.size}`, reply_markup: { inline_keyboard: [[{ text: 'Apri FantaDrama', web_app: { url: appUrl } }], [{ text: 'Menu', callback_data: 'menu' }]] } })
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
    const parts = message.text?.trim().split(/\s+/) ?? []
    const command = parts[0]?.toLowerCase()
    if (command === '/start' && parts[1]?.startsWith('link_')) await completeTelegramLink(message.chat.id, message.from, parts[1].slice('link_'.length))
    else {
      await rememberLink(message.from, message.chat.id)
      if (command === '/admin') {
        const password = parts.slice(1).join(' ')
        const user = await registeredUser(message.from.id)
        if (!password) await telegramApi('sendMessage', { chat_id: message.chat.id, text: 'Usa /admin seguito dalla password, dopo aver collegato il profilo FantaDrama.' })
        else if (!user) await sendMenuHint(message.chat.id)
        else if (!isValidAdminPassword(password)) await telegramApi('sendMessage', { chat_id: message.chat.id, text: 'Password admin non valida.' })
        else { await grantPlatformAdmin(user.id, 'TELEGRAM'); await sendAdminPanel(message.chat.id, message.from) }
      } else if (command === '/start' || command === '/menu' || command === '/help') await sendMenu(message.chat.id, message.from.first_name, await isTelegramAdmin(message.from.id))
      else if (command === '/profilo') await handleAction(message.chat.id, message.from, 'profile')
      else if (command === '/gruppi') await handleAction(message.chat.id, message.from, 'groups')
      else if (command === '/eventi') await handleAction(message.chat.id, message.from, 'events')
      else if (command === '/punti') await handleAction(message.chat.id, message.from, 'scores')
    }
  } catch (error) { console.error('Telegram webhook processing failed', error) }
  return res.sendStatus(200)
})

export default router
