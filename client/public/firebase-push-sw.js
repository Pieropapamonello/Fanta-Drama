/* Firebase Cloud Messaging worker. Configuration is public and supplied by the app. */
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = event.notification.data?.url || event.notification.data?.path || '/dashboard'
  const url = new URL(target, self.location.origin).href
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((client) => client.url.startsWith(self.location.origin))
    if (existing) return existing.navigate(url).then(() => existing.focus())
    return clients.openWindow(url)
  }))
})

const query = new URL(self.location.href).searchParams
const config = {
  apiKey: query.get('apiKey'), authDomain: query.get('authDomain'), projectId: query.get('projectId'),
  messagingSenderId: query.get('messagingSenderId'), appId: query.get('appId')
}
if (config.apiKey && config.projectId && config.messagingSenderId && config.appId) {
  importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-app-compat.js')
  importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging-compat.js')
  firebase.initializeApp(config)
  // Creating the Messaging instance installs Firebase's background push
  // listener. Initializing the app alone is not enough when the PWA is closed.
  firebase.messaging()
  // The server supplies a Web Push notification payload. Let FCM display it
  // once instead of showing a second copy from a background callback.
}
