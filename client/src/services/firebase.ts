import { initializeApp } from 'firebase/app'
import { browserLocalPersistence, getAuth, onAuthStateChanged, onIdTokenChanged, setPersistence, type User } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
}

if (!firebaseConfig.apiKey || !firebaseConfig.authDomain || !firebaseConfig.projectId || !firebaseConfig.appId) {
  throw new Error('Firebase web configuration is incomplete')
}

export const firebaseApp = initializeApp(firebaseConfig)
export const firebaseAuth = getAuth(firebaseApp)

// Keep the Firebase session in the browser/PWA storage.  ID tokens themselves
// expire quickly, but Firebase refreshes them as long as this session exists.
export const firebaseAuthReady: Promise<User | null> = setPersistence(firebaseAuth, browserLocalPersistence)
  .catch(() => undefined)
  .then(() => new Promise<User | null>((resolve) => {
    const stop = onAuthStateChanged(firebaseAuth, (user) => { stop(); resolve(user) })
  }))

onIdTokenChanged(firebaseAuth, (user) => {
  if (!user) {
    localStorage.removeItem('fd_token')
    return
  }
  void user.getIdToken().then((token) => localStorage.setItem('fd_token', token)).catch(() => undefined)
})
