// Pareshaan Service Worker v1.0
// Made by Manish Rajdoot

const CACHE_NAME = 'pareshaan-v1.0';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).catch(() => {
        return caches.match('./index.html');
      });
    })
  );
});

// Push notification event
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || '⏰ Pareshaan Reminder';
  const options = {
    body: data.body || 'Aapka koi kaam pending hai!',
    icon: './icons/icon-192.png',
    badge: './icons/icon-72.png',
    vibrate: [200, 100, 200, 100, 200],
    tag: 'pareshaan-reminder',
    requireInteraction: true,
    actions: [
      { action: 'open', title: '✅ Open App' },
      { action: 'dismiss', title: '❌ Dismiss' }
    ],
    data: { url: './' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('pareshaan') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('./');
      }
    })
  );
});

// Background sync for reminders
self.addEventListener('sync', (event) => {
  if (event.tag === 'check-reminders') {
    event.waitUntil(checkAndNotify());
  }
});

async function checkAndNotify() {
  // This will be triggered by background sync
  const title = '⏰ Pareshaan';
  const options = {
    body: 'Apne tasks check karo!',
    icon: './icons/icon-192.png',
    badge: './icons/icon-72.png',
    vibrate: [300, 100, 300],
    tag: 'pareshaan-sync'
  };
  return self.registration.showNotification(title, options);
}

// Periodic background sync
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'daily-reminder') {
    event.waitUntil(checkAndNotify());
  }
});

// Message from main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, tag } = event.data;
    self.registration.showNotification(title || '⏰ Pareshaan', {
      body: body || 'Reminder!',
      icon: './icons/icon-192.png',
      badge: './icons/icon-72.png',
      vibrate: [200, 100, 200, 100, 400],
      tag: tag || 'pareshaan-msg',
      requireInteraction: true
    });
  }
});
