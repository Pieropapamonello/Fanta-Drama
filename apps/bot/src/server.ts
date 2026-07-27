import type { Express } from 'express';
import { initializeApp, sendScoreUpdate } from './telegram';
import { initializeFirebaseAdmin } from './firebase';
import { linkTelegramUser } from './telegramAuth';

export function initializeBotService(app: Express) {
  initializeFirebaseAdmin();

  app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

  app.post('/api/telegram/login', async (req, res) => {
    try {
      const payload = req.body as Record<string, string>;
      const result = await linkTelegramUser(payload as any);
      return res.status(200).json({ success: true, result });
    } catch (error) {
      process.stderr.write(`Telegram login error ${String(error)}\n`);
      return res.status(400).json({ error: (error as Error).message || 'Invalid Telegram login payload' });
    }
  });

  app.post('/telegram/webhook', async (req, res) => {
    try {
      const update = req.body;
      const bot = await initializeApp();
      await bot.handleUpdate(update);
      return res.status(200).send('accepted');
    } catch (error) {
      process.stderr.write(`Telegram webhook error ${String(error)}\n`);
      return res.status(500).json({ error: 'Unable to process webhook' });
    }
  });

  app.post('/telegram/notify', async (req, res) => {
    try {
      const { userId, message } = req.body as { userId: string; message: string };
      await sendScoreUpdate(userId, message);
      return res.status(200).json({ success: true });
    } catch (error) {
      process.stderr.write(`Notify error ${String(error)}\n`);
      return res.status(500).json({ error: 'Unable to send message' });
    }
  });
}
