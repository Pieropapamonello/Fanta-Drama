const CACHE = 'fantadrama-shell-v1'
const APP_SHELL = ['/', '/manifest.webmanifest', '/icons/fantadrama-icon.svg']
self.addEventListener('install', (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())))
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
self.addEventListener('fetch', (event) => { const request = event.request; const url = new URL(request.url); if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return; event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => { if (response.ok && (request.mode === 'navigate' || url.pathname.startsWith('/assets/'))) { const copy = response.clone(); void caches.open(CACHE).then((cache) => cache.put(request, copy)) } return response }).catch(() => caches.match('/')))) })
