import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging'
import { firebaseApp } from './firebase'
import api from './api'

function workerUrl() {
  const params = new URLSearchParams({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || ''
  })
  return `/firebase-push-sw.js?${params.toString()}`
}

export async function enableDeviceNotifications() {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !await isSupported()) return { ok: false, message: 'Questo browser non supporta le notifiche dell’app.' }
  if (Notification.permission === 'denied') return { ok: false, message: 'Le notifiche sono bloccate nelle impostazioni del dispositivo.' }
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return { ok: false, message: 'Permesso non concesso. Potrai attivarlo dalle impostazioni quando vuoi.' }
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY
  if (!vapidKey) return { ok: false, message: 'Permesso concesso. Manca ancora la chiave push di Firebase: l’amministratore la sta configurando.' }
  try {
    const registration = await navigator.serviceWorker.register(workerUrl(), { scope: '/firebase-push/' })
    const token = await getToken(getMessaging(firebaseApp), { vapidKey, serviceWorkerRegistration: registration })
    if (!token) return { ok: false, message: 'Non riesco a registrare questo dispositivo alle notifiche.' }
    await api.post('/profile/push-subscriptions', { token, platform: navigator.userAgent.slice(0, 40) })
    return { ok: true, message: 'Notifiche del dispositivo attive su questo telefono.' }
  } catch (error: any) {
    const code = String(error?.code ?? '')
    const detail = String(error?.message ?? error?.name ?? '').replace(/https?:\/\/\S+/g, '[url]').slice(0, 220)
    console.error('FantaDrama device notification registration failed', error)
    void api.post('/profile/push-diagnostics', { code: code || undefined, message: detail || undefined }).catch(() => undefined)
    if (code.includes('failed-service-worker-registration')) return { ok: false, message: 'Il servizio notifiche del browser non si è avviato. Chiudi e riapri l’app, poi riprova.' }
    if (code.includes('token-subscribe-failed')) return { ok: false, message: 'Firebase ha rifiutato la registrazione push. Verifica che “FCM Registration API” sia abilitata nel progetto Firebase.' }
    if (code.includes('permission-blocked')) return { ok: false, message: 'Il browser sta ancora bloccando le notifiche per questo sito.' }
    if (detail.toLowerCase().includes('failed to fetch')) return { ok: false, message: 'Brave sta bloccando Firebase Push. Disattiva Shields per FantaDrama oppure attiva gli avvisi da Chrome.' }
    return { ok: false, message: `Non riesco a registrare il telefono alle notifiche${code ? ` (${code})` : ''}${detail ? `: ${detail}` : ''}` }
  }
}

export async function listenToForegroundPush() {
  if (!('Notification' in window) || Notification.permission !== 'granted' || !await isSupported()) return () => undefined
  return onMessage(getMessaging(firebaseApp), (payload) => {
    const title = payload.notification?.title ?? 'FantaDrama'
    const body = payload.notification?.body ?? 'Hai un nuovo aggiornamento.'
    void navigator.serviceWorker.ready.then((registration) => registration.showNotification(title, { body, icon: '/icons/fantadrama-icon.svg', data: { path: payload.data?.path ?? '/dashboard' } }))
  })
}
