import crypto from 'crypto'
import { db } from './firebase'

function configuredPassword() {
  return process.env.ADMIN_PASSWORD?.trim()
}

export function isValidAdminPassword(candidate: string) {
  const password = configuredPassword()
  if (!password || !candidate) return false
  const expected = Buffer.from(password)
  const received = Buffer.from(candidate)
  return expected.length === received.length && crypto.timingSafeEqual(expected, received)
}

export async function isPlatformAdmin(userId: string) {
  return (await db.collection('platformAdmins').doc(userId).get()).exists
}

export async function grantPlatformAdmin(userId: string, source: 'WEB' | 'TELEGRAM' | 'PASSWORD') {
  await db.collection('platformAdmins').doc(userId).set({ userId, source, grantedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, { merge: true })
}

export async function revokePlatformAdmin(userId: string) {
  await db.collection('platformAdmins').doc(userId).delete()
}
