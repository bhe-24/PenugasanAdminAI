// ========================================================
// 1. IMPOR ANTENA ONESIGNAL (Wajib untuk Push Notification)
// ========================================================
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");

// ========================================================
// 2. KODE CACHING PWA (Sistem Memori Pintar Versi 2)
// ========================================================
const CACHE_NAME = 'cendekia-cache-v2';

// Install PWA dan paksa langsung menggunakan versi terbaru
self.addEventListener('install', event => {
    event.waitUntil(self.skipWaiting());
});

// Aktifkan PWA dan bersihkan sampah memori versi lama (V1)
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    return self.clients.claim();
});

// Logika Pintar untuk menangani Error 404 Kuis
self.addEventListener('fetch', event => {
    // JIKA URL MENGANDUNG "?id=" (Seperti URL Kuis) ATAU "/api/":
    // Jangan cari di memori, paksa browser untuk mengambil langsung dari internet
    if (event.request.url.includes('?id=') || event.request.url.includes('/api/')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // UNTUK FILE LAINNYA (HTML, CSS, Gambar):
    // Cari di memori dengan mode { ignoreSearch: true } agar kebal terhadap error parameter link
    event.respondWith(
        caches.match(event.request, { ignoreSearch: true }).then(response => {
            return response || fetch(event.request);
        }).catch(() => {
            return fetch(event.request);
        })
    );
});
