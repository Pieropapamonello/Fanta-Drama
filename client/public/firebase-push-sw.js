/* Firebase Cloud Messaging worker. Configuration is public and supplied by the app. */
const query = new URL(self.location.href).searchParams
const config = {
  apiKey: query.get('apiKey'), authDomain: query.get('authDomain'), projectId: query.get('projectId'),
  messagingSenderId: query.get('messagingSenderId'), appId: query.get('appId')
}
if (config.apiKey && config.projectId && config.messagingSenderId && config.appId) {
  importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-app-compat.js')
  importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging-compat.js')
  firebase.initializeApp(config)
  firebase.messaging().onBackgroundMessage((payload) => {
    const title = payload.notification?.title || 'FantaDrama'
    const path = payload.data?.path || '/dashboard'
    const options = { body: payload.notification?.body || 'Hai un nuovo aggiornamento.', icon: '/icons/fantadrama-icon.svg', data: { url: payload.data?.url || new URL(path, self.location.origin).href } }
    self.registration.showNotification(title, options)
  })
}
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || new URL('/dashboard', self.location.origin).href
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((client) => client.url.startsWith(self.location.origin))
    if (existing) return existing.navigate(url).then(() => existing.focus())
    return clients.openWindow(url)
  }))
})
