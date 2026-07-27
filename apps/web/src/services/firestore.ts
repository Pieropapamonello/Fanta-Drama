import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export function userDoc(uid: string) {
  return doc(db, 'users', uid);
}

export async function fetchUserProfile(uid: string) {
  const snapshot = await getDoc(userDoc(uid));
  return snapshot.exists() ? snapshot.data() : null;
}

export async function createUserProfile(uid: string, profile: Record<string, unknown>) {
  await setDoc(userDoc(uid), profile, { merge: true });
}
