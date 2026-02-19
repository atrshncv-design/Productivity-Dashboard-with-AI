// Service Worker for Productivity Dashboard Notifications
const SW_VERSION = '1.0.0';

self.addEventListener('install', (event) => {
    console.log(`[SW v${SW_VERSION}] Installing...`);
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log(`[SW v${SW_VERSION}] Activating...`);
    event.waitUntil(self.clients.claim());
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const urlToOpen = event.notification.data?.url || '/dashboard';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Focus existing window if available
            for (const client of clientList) {
                if (client.url.includes('/dashboard') && 'focus' in client) {
                    return client.focus();
                }
            }
            // Otherwise open new window
            if (self.clients.openWindow) {
                return self.clients.openWindow(urlToOpen);
            }
        })
    );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
    console.log('[SW] Notification closed:', event.notification.tag);
});

// Handle messages from the main app
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
        const { title, options } = event.data;
        event.waitUntil(
            self.registration.showNotification(title, {
                icon: '/icon-192.png',
                badge: '/icon-192.png',
                vibrate: [200, 100, 200],
                requireInteraction: false,
                ...options,
            })
        );
    }

    if (event.data && event.data.type === 'SCHEDULE_NOTIFICATIONS') {
        // Acknowledge receipt
        if (event.source) {
            event.source.postMessage({ type: 'SCHEDULE_ACK' });
        }
    }
});
