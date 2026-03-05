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

messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/icon-192.png'
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
