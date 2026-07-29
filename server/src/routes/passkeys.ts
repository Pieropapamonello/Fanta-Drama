import { Router } from 'express'
import { generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse } from '@simplewebauthn/server'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { db, firebaseAuth } from '../services/firebase'
import { randomUUID } from 'crypto'

const router = Router(); const rpID = process.env.PASSKEY_RP_ID ?? 'fanta-drama.onrender.com'; const origin = process.env.PASSKEY_ORIGIN ?? 'https://fanta-drama.onrender.com'
const saveChallenge = (id: string, challenge: string) => db.collection('passkeyChallenges').doc(id).set({ challenge, expiresAt: Date.now() + 5 * 60_000 })
const readChallenge = async (id: string) => { const ref = db.collection('passkeyChallenges').doc(id); const item = await ref.get(); await ref.delete(); return item.exists && Number(item.data()?.expiresAt) > Date.now() ? String(item.data()?.challenge) : null }

router.post('/register/options', requireAuth, async (req: AuthRequest, res) => {
  const user = await db.collection('users').doc(req.userId!).get(); const existing = await db.collection('passkeys').where('userId', '==', req.userId!).get()
  const options = await generateRegistrationOptions({ rpName: 'FantaDrama', rpID, userName: String(user.data()?.username ?? 'Giocatore'), userID: new TextEncoder().encode(req.userId!), attestationType: 'none', authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' }, excludeCredentials: existing.docs.map((item) => ({ id: String(item.data().credentialId), transports: item.data().transports ?? [] })) })
  const requestId = randomUUID(); await saveChallenge(`register_${req.userId}_${requestId}`, options.challenge); return res.json({ options, requestId })
})
router.post('/register/verify', requireAuth, async (req: AuthRequest, res) => {
  const challenge = await readChallenge(`register_${req.userId}_${String(req.body?.requestId ?? '')}`); if (!challenge) return res.status(400).json({ error: 'passkey_challenge_expired' })
  try { const result: any = await verifyRegistrationResponse({ response: req.body.response, expectedChallenge: challenge, expectedOrigin: origin, expectedRPID: rpID }); if (!result.verified || !result.registrationInfo) throw new Error('passkey_not_verified'); const info = result.registrationInfo; await db.collection('passkeys').doc(info.credential.id).set({ credentialId: info.credential.id, publicKey: Buffer.from(info.credential.publicKey).toString('base64'), counter: info.credential.counter, transports: req.body.response?.response?.transports ?? [], userId: req.userId!, createdAt: new Date().toISOString() }); return res.json({ verified: true }) } catch { return res.status(400).json({ error: 'passkey_registration_failed' }) }
})
router.post('/login/options', async (_req, res) => { const options = await generateAuthenticationOptions({ rpID, userVerification: 'preferred' }); const requestId = randomUUID(); await saveChallenge(`login_${requestId}`, options.challenge); return res.json({ options, requestId }) })
router.post('/login/verify', async (req, res) => {
  const challenge = await readChallenge(`login_${String(req.body?.requestId ?? '')}`); if (!challenge) return res.status(400).json({ error: 'passkey_challenge_expired' }); const id = String(req.body?.response?.id ?? ''); const key = await db.collection('passkeys').doc(id).get(); if (!key.exists) return res.status(404).json({ error: 'passkey_not_found' })
  try { const data = key.data()!; const result: any = await verifyAuthenticationResponse({ response: req.body.response, expectedChallenge: challenge, expectedOrigin: origin, expectedRPID: rpID, credential: { id: data.credentialId, publicKey: Uint8Array.from(Buffer.from(data.publicKey, 'base64')), counter: Number(data.counter), transports: data.transports ?? [] } }); if (!result.verified) throw new Error(); await key.ref.update({ counter: result.authenticationInfo.newCounter, lastUsedAt: new Date().toISOString() }); return res.json({ customToken: await firebaseAuth.createCustomToken(String(data.userId), { provider: 'passkey' }) }) } catch { return res.status(400).json({ error: 'passkey_login_failed' }) }
})
export default router
