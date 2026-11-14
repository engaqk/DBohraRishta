importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyBSDicG4-L--x8LAABXu0BEzJ0x13SwIlQ",
    authDomain: "dbohranisbat.firebaseapp.com",
    projectId: "dbohranisbat",
    storageBucket: "dbohranisbat.firebasestorage.app",
    messagingSenderId: "769795414151",
    appId: "1:769795414151:web:8178c6db910e8f7cb94022"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message:', payload);
    
    const notificationTitle = payload?.notification?.title || payload?.data?.title || '53DBohraRishta';
    const notificationBody = payload?.notification?.body || payload?.data?.body || '';
    const clickUrl = payload?.data?.url || payload?.fcmOptions?.link || '/';
    
    const notificationOptions = {
        body: notificationBody,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        image: payload?.notification?.image || payload?.data?.image || undefined,
        data: {
            url: clickUrl,
            timestamp: Date.now()
        },
        vibrate: [200, 100, 200],
        tag: payload?.data?.tag || 'bohra-rishta-notification',
        renotify: true,
        actions: [
            {
                action: 'open_url',
                title: 'Open 53DBohraRishta'
            }
        ]
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click: Focus active tab or open target URL
self.addEventListener('notificationclick', (event) => {
    console.log('[firebase-messaging-sw.js] Notification clicked:', event.notification);
    event.notification.close();

    const targetUrl = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Check if there is already a window open with our domain
            for (let i = 0; i < clientList.length; i++) {
                const client = clientList[i];
                if ('focus' in client) {
                    if (client.url.includes(self.location.origin)) {
                        client.navigate(targetUrl);
                        return client.focus();
                    }
                }
            }
            // If no window is currently open, open a new window with the target URL
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});
