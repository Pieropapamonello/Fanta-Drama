import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithCustomToken,
  signOut,
} from 'firebase/auth';
import { auth } from '../firebase';

export async function registerUser(email: string, password: string) {
  return createUserWithEmailAndPassword(auth, email, password);
}

export async function loginUser(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function logoutUser() {
  return signOut(auth);
}

export async function handleTelegramLogin(payload: Record<string, string>) {
  const response = await fetch('/api/telegram/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('Telegram login failed');
  }

  const data = await response.json();
  if (!data.token) {
    throw new Error('Telegram login did not return token');
  }

  return signInWithCustomToken(auth, data.token as string);
}
