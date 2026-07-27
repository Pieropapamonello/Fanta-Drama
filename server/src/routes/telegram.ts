import { Router } from 'express'
import { db } from '../services/firebase'

const router = Router()

type TelegramMessage = {
  chat?: { id?: number | string }
  from?: { id?: number | string, first_name?: string, username?: string }
  text?: string
}

async function sendMessage(chatId: number | string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not configured')
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: {
        inline_keyboard: [[{ text: 'Apri FantaDrama', url: 'https://fanta-drama.onrender.com' }]]
      }
    })
  })
  if (!response.ok) throw new Error(`Telegram sendMessage failed: ${response.status}`)
}

router.post('/webhook', async (req, res) => {
  const configuredSecret = process.env.TELEGRAM_WEBHOOK_SECRET
  const receivedSecret = req.header('x-telegram-bot-api-secret-token')
  if (!configuredSecret || !receivedSecret || receivedSecret !== configuredSecret) {
    return res.sendStatus(401)
  }

  const message = (req.body as { message?: TelegramMessage }).message
  if (!message?.chat?.id || !message.from?.id) return res.sendStatus(200)

  try {
    const userId = `telegram_${message.from.id}`
    await db.collection('telegramLinks').doc(userId).set({
      telegramUserId: String(message.from.id),
      chatId: String(message.chat.id),
      username: message.from.username ?? null,
      firstName: message.from.first_name ?? null,
      updatedAt: new Date().toISOString()
    }, { merge: true })

    const command = message.text?.trim().split(/\s+/)[0]?.toLowerCase()
    if (command === '/start') {
      await sendMessage(message.chat.id, 'Benvenuto in FantaDrama! Apri l’app per accedere con Telegram, creare un gruppo e fare pronostici.')
    } else if (command === '/help') {
      await sendMessage(message.chat.id, 'Comandi disponibili: /start per collegarti a FantaDrama, /help per questa guida.')
    }
  } catch (error) {
    console.error('Telegram webhook processing failed', error)
  }
  return res.sendStatus(200)
})

export default router
