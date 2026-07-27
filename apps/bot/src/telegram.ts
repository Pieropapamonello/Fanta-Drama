import { Telegraf } from 'telegraf';
import { firestore, initializeFirebaseAdmin } from './firebase';

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  throw new Error('TELEGRAM_BOT_TOKEN is required');
}

const bot = new Telegraf(token);

bot.start(async (ctx) => {
  const telegramUser = ctx.from;
  if (!telegramUser) {
    return ctx.reply('Impossibile identificarti.');
  }
  await ctx.reply('Benvenuto su FantaDrama. Usa /linkaccount per collegare il tuo profilo.');
});

bot.command('linkaccount', async (ctx) => {
  const chatId = String(ctx.chat?.id ?? '');
  const userId = String(ctx.from?.id ?? '');
  await firestore().collection('telegramLinks').doc(userId).set({
    userId,
    chatId,
    telegramUserId: userId,
    linkedAt: new Date().toISOString(),
  });
  await ctx.reply('Invia il codice che trovi nel tuo profilo web per completare il collegamento.');
});

export async function initializeApp() {
  initializeFirebaseAdmin();
  return bot;
}

export async function sendScoreUpdate(userId: string, message: string) {
  const snapshot = await firestore().collection('telegramLinks').doc(userId).get();
  if (!snapshot.exists) {
    throw new Error('Telegram link not found');
  }
  const data = snapshot.data();
  const chatId = data?.chatId;
  if (!chatId) {
    throw new Error('Chat ID missing for Telegram link');
  }
  await bot.telegram.sendMessage(chatId, message);
}
