import express from 'express';
import { linkTelegramUser } from './telegramAuth';

export const telegramRouter = express.Router();

telegramRouter.post('/login', async (req, res) => {
  try {
    const payload = req.body;
    const profile = await linkTelegramUser(payload);
    return res.status(200).json({ success: true, profile });
  } catch (error) {
    return res.status(400).json({ success: false, message: String(error) });
  }
});
