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
    const options = { body: payload.notification?.body || 'Hai un nuovo aggiornamento.', icon: '/icons/fantadrama-icon.svg', data: { path: payload.data?.path || '/dashboard' } }
    self.registration.showNotification(title, options)
  })
}
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(clients.openWindow(event.notification.data?.path || '/dashboard'))
})
