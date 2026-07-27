import crypto from 'crypto';
import { authAdmin, firestore } from './firebase';
import type { TelegramLoginPayload } from './types';

const TELEGRAM_LOGIN_SECRET = process.env.TELEGRAM_LOGIN_SECRET;
if (!TELEGRAM_LOGIN_SECRET) {
  throw new Error('TELEGRAM_LOGIN_SECRET is required');
}

export function verifyTelegramPayload(payload: TelegramLoginPayload) {
  const dataCheckString = Object.entries(payload)
    .filter(([key]) => key !== 'hash')
    .sort(([a], [b]) => (a > b ? 1 : -1))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secret = crypto.createHash('sha256').update(TELEGRAM_LOGIN_SECRET as string).digest();
  const hash = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');

  return hash === payload.hash;
}

export async function linkTelegramUser(payload: TelegramLoginPayload) {
  if (!verifyTelegramPayload(payload)) {
    throw new Error('Invalid Telegram login payload');
  }

  const uid = `telegram:${payload.id}`;
  const userRef = firestore().collection('users').doc(uid);
  const userRecord = await userRef.get();
  const profile = {
    uid,
    username: payload.username ?? `tg_${payload.id}`,
    displayName: `${payload.first_name}${payload.last_name ? ` ${payload.last_name}` : ''}`,
    telegramUserId: payload.id,
    linkedAt: new Date().toISOString(),
  };

  if (userRecord.exists) {
    await userRef.update(profile);
  } else {
    await userRef.set({
      ...profile,
      role: 'player',
      createdAt: new Date().toISOString(),
    });
  }

  const token = await authAdmin().createCustomToken(uid);
  return { profile, token };
}
