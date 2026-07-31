import { Router } from 'express'
import { db } from '../services/firebase'
import { grantPlatformAdmin, isPlatformAdmin, isValidAdminPassword } from '../services/platform-admin'
import { mergeProfiles } from '../services/profile-merge'
import { notifyUser } from '../services/notifications'
import { submitClaimVote } from '../services/claim-voting'

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
    [{ text: 'Eventi e aste', callback_data: 'events' }, { text: 'Crediti e offerte', callback_data: 'credits' }],
    [{ text: 'Classifica crew', callback_data: 'leaderboard' }]
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
  let merged = false
  if (!links.empty && links.docs[0].id !== data.userId) {
    const existingUser = await db.collection('users').doc(links.docs[0].id).get()
    if (existingUser.exists) { await mergeProfiles(String(data.userId), links.docs[0].id); merged = true }
    await links.docs[0].ref.delete()
  }
  await db.collection('telegramLinks').doc(data.userId).set({ telegramUserId: String(from.id), chatId: String(chatId), username: from.username ?? null, firstName: from.first_name ?? null, linkedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, { merge: true })
  await requestRef.update({ usedAt: new Date().toISOString() })
  await telegramApi('sendMessage', { chat_id: chatId, text: merged ? 'Profili uniti e Telegram collegato. Crediti, aste, carte e storico sono ora nel tuo profilo principale.\n\nEcco il menu per gestire FantaDrama.' : 'Telegram è collegato al tuo profilo FantaDrama.\n\nEcco il menu per gestire FantaDrama.', reply_markup: { inline_keyboard: menuKeyboard(await isTelegramAdmin(from.id)) } })
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

async function handleClaimAction(chatId: string | number, from: TelegramUser, action: string) {
  const [, claimId, command] = action.split(':')
  const user = await registeredUser(from.id)
  if (!user || !claimId || !command) return sendMenuHint(chatId)
  if (command === 'APPEAL') {
    const claim = await db.collection('cardClaims').doc(claimId).get()
    if (!claim.exists) return telegramApi('sendMessage', { chat_id: chatId, text: 'Questa verifica non esiste più.' })
    const previous = await db.collection('appeals').where('claimId', '==', claimId).get()
    if (previous.docs.some((item) => item.data().userId === user.id && item.data().status === 'OPEN')) return telegramApi('sendMessage', { chat_id: chatId, text: 'Hai già chiesto l’intervento dell’amministratore per questa carta.' })
    const now = new Date().toISOString()
    await db.collection('appeals').add({ claimId, eventId: claim.data()?.eventId, groupId: claim.data()?.groupId, userId: user.id, message: 'Richiesta inviata direttamente da Telegram.', status: 'OPEN', createdAt: now })
    await claim.ref.set({ appealCount: Number(claim.data()?.appealCount ?? 0) + 1, latestAppealAt: now, updatedAt: now }, { merge: true })
    const [group, admins] = await Promise.all([db.collection('groups').doc(String(claim.data()?.groupId)).get(), db.collection('platformAdmins').get()])
    const adminIds = new Set([...Object.entries((group.data()?.memberRoles ?? {}) as Record<string, string>).filter(([, role]) => role === 'ADMIN').map(([id]) => id), ...admins.docs.map((admin) => admin.id)])
    await Promise.allSettled([...adminIds].map((id) => notifyUser(id, { kind: 'APPEAL_OPENED', title: 'Intervento richiesto su una carta', message: `Telegram richiede un controllo per ${claim.data()?.cardTitle}.`, path: '/admin/console', actionLabel: 'Apri console admin' })))
    return telegramApi('sendMessage', { chat_id: chatId, text: 'Richiesta inviata all’amministratore. Riceverai un aggiornamento quando verrà presa una decisione.' })
  }
  try {
    const result = await submitClaimVote(claimId, user.id, command === 'CONFIRM' ? 'CONFIRM' : 'DENY')
    const text = result.alreadyVoted ? 'Avevi già registrato questa decisione.' : result.status === 'CONFIRMED' ? '✅ Carta confermata: punti assegnati e crew avvisata.' : result.status === 'DENIED' ? '❌ Carta contestata: la crew è stata avvisata.' : `${command === 'CONFIRM' ? '✅ Conferma' : '❌ Contestazione'} registrata: ${result.confirms} conferme e ${result.denies} contestazioni.`
    return telegramApi('sendMessage', { chat_id: chatId, text, reply_markup: { inline_keyboard: [[{ text: 'Apri verifica carta', web_app: { url: `${appUrl.replace('/telegram-miniapp', '')}/events/${result.claim.eventId}` } }]] } })
  } catch (error: any) {
    const code = String(error?.message ?? '')
    const text = code === 'claimant_cannot_vote' ? 'Non puoi approvare la tua stessa carta.' : code === 'claim_already_resolved' ? 'Questa carta è già stata risolta.' : 'Non riesco a registrare questa decisione.'
    return telegramApi('sendMessage', { chat_id: chatId, text })
  }
}

async function handleAction(chatId: string | number, from: TelegramUser, action: string) {
  if (action.startsWith('claim:')) return handleClaimAction(chatId, from, action)
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
  if (action === 'credits' || action === 'scores') {
    const wallet = await db.collection('wallets').doc(user.id).get(); const balance = Number(wallet.data()?.balance ?? 1000); const reserved = Number(wallet.data()?.reserved ?? 0)
    const leading = await db.collection('auctions').where('leaderId', '==', user.id).get()
    const active = leading.docs.filter((auction) => auction.data().status === 'OPEN').length
    return telegramApi('sendMessage', { chat_id: chatId, text: `I tuoi crediti\n\nDisponibili: ${Math.max(0, balance - reserved)}\nIn offerte: ${reserved}\nAste in testa: ${active}`, reply_markup: { inline_keyboard: [[{ text: 'Apri le mie aste', web_app: { url: `${appUrl.replace('/telegram-miniapp', '')}/events` } }], [{ text: 'Menu', callback_data: 'menu' }]] } })
  }
  if (action === 'leaderboard') {
    const groups = await db.collection('groups').where('memberIds', 'array-contains', user.id).get()
    const memberIds = [...new Set(groups.docs.flatMap((group) => (group.data().memberIds as string[] | undefined) ?? []))]
    const allScores = await db.collection('scores').get()
    const totals = new Map<string, number>()
    allScores.docs.filter((score) => memberIds.includes(String(score.data().userId))).forEach((score) => totals.set(String(score.data().userId), (totals.get(String(score.data().userId)) ?? 0) + Number(score.data().points ?? 0)))
    const players = await Promise.all(memberIds.map(async (id) => { const profile = await db.collection('users').doc(id).get(); return { name: profile.data()?.username ?? 'Giocatore', points: totals.get(id) ?? 0 } }))
    const lines = players.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, 'it')).slice(0, 10).map((player, index) => `${index + 1}. ${player.name} — ${player.points} pt`)
    return telegramApi('sendMessage', { chat_id: chatId, text: lines.length ? `Classifica della crew\n\n${lines.join('\n')}` : 'Entra in un gruppo per vedere la classifica.', reply_markup: { inline_keyboard: [[{ text: 'Apri classifica', web_app: { url: `${appUrl.replace('/telegram-miniapp', '')}/events` } }], [{ text: 'Menu', callback_data: 'menu' }]] } })
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
      await handleAction(callback.message.chat.id, callback.from, callback.data || 'menu')
      if (callback.id) await telegramApi('answerCallbackQuery', { callback_query_id: callback.id, text: 'Decisione registrata: controlla il messaggio del bot.', show_alert: false })
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
      else if (command === '/punti' || command === '/crediti') await handleAction(message.chat.id, message.from, 'credits')
      else if (command === '/classifica') await handleAction(message.chat.id, message.from, 'leaderboard')
    }
  } catch (error) { console.error('Telegram webhook processing failed', error) }
  return res.sendStatus(200)
})

export default router
