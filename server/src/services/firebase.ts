import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  ?? (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64
    ? Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8')
    : undefined)

if (!rawServiceAccount) {
  throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_BASE64 is required')
}

let serviceAccount: Record<string, string>
try {
  serviceAccount = JSON.parse(rawServiceAccount) as Record<string, string>
} catch {
  throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON must contain valid JSON')
}

const firebaseApp = getApps()[0] ?? initializeApp({ credential: cert(serviceAccount) })

export const db = getFirestore(firebaseApp)
export const firebaseAuth = getAuth(firebaseApp)

export function documentData<T extends Record<string, unknown>>(id: string, data: T) {
  return { id, ...data }
}

export async function groupRole(groupId: string, userId: string): Promise<'ADMIN' | 'MEMBER' | null> {
  const snapshot = await db.collection('groups').doc(groupId).get()
  if (!snapshot.exists) return null
  const roles = snapshot.data()?.memberRoles as Record<string, 'ADMIN' | 'MEMBER'> | undefined
  return roles?.[userId] ?? null
}
