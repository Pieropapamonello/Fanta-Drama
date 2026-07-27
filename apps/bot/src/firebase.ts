import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

let initialized = false;

export function initializeFirebaseAdmin() {
  if (initialized) return;

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccount) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is required');
  }

  const credentials = cert(JSON.parse(Buffer.from(serviceAccount, 'base64').toString('utf-8')));

  initializeApp({
    credential: credentials,
  });
  initialized = true;
}

export const firestore = () => {
  initializeFirebaseAdmin();
  return getFirestore();
};

export const authAdmin = () => {
  initializeFirebaseAdmin();
  return getAuth();
};
