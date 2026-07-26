// 1. Impor Library Firebase untuk Background (Gunakan versi compat)
importScripts('https://www.gstatic.com/firebasejs/11.6.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging-compat.js');

// 2. Inisialisasi Firebase di dalam Service Worker
firebase.initializeApp({
    apiKey: "AIzaSyDpUWUIzPXIZN6rrNtsIqcL6VfOE2RLVl0",
    authDomain: "mading-cf676.firebaseapp.com",
    projectId: "mading-cf676",
    storageBucket: "mading-cf676.firebasestorage.app",
    messagingSenderId: "72175203671",
    appId: "1:72175203671:web:7a0676a55beb64bc96ba12"
});

// 3. Penangkap Notifikasi saat Aplikasi Ditutup (Background)
const messaging = firebase.messaging();
messaging.onBackgroundMessage(function(payload) {
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/img/icon-192x192.png',
        badge: '/img/icon-192x192.png' // Ikon kecil di status bar Android
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

// ========================================================
// 4. KODE CACHING PWA (Kode Anda yang sebelumnya)
// ========================================================
const CACHE_NAME = 'cendekia-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/css/style.css'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});
