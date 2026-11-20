// ========================================================
// CENDEKIA AKSARA - SERVICE WORKER & NOTIFIKASI PWA (V2.8)
// Mendukung Notifikasi Push Native, Banner Layar Kunci HP,
// Logo Resmi App, Badge Alpha Transparan, Anti-Duplikasi (Anti-Double/Triple),
// Background Scheduler, Caching Pintar, serta Penanganan Offline.
// ========================================================

// 1. IMPOR ANTENA ONESIGNAL (DENGAN TRY-CATCH AMAN)
try {
    importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");
} catch (e) {
    console.warn("[SW] OneSignal SDK bypass (offline/unreachable):", e);
}

const CACHE_NAME = 'cendekia-cache-v2.8';
const USER_STATE_CACHE = 'cendekia-user-state-v1';

function getAssetsUrl() {
    return self.location.origin || "https://penugasan-admin-ai.vercel.app";
}

// 2. INSTALL & ACTIVATE SERVICE WORKER
self.addEventListener('install', event => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME && cache !== USER_STATE_CACHE) {
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// 3. FETCH HANDLING (PINTAR & KEBAL TERHADAP URL DINAMIS & OFFLINE)
self.addEventListener('fetch', event => {
    const url = event.request.url;

    if (url.includes('?id=') || url.includes('/api/')) {
        event.respondWith(
            fetch(event.request).catch(() => {
                if (url.includes('/api/notif')) {
                    return new Response(JSON.stringify({
                        success: true,
                        mode: 'sw_offline_fallback',
                        message: 'API offline, notifikasi diproses oleh Service Worker lokal tanpa gangguan.'
                    }), {
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
                return new Response(JSON.stringify({ offline: true, error: "Jaringan offline" }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            })
        );
        return;
    }

    event.respondWith(
        caches.match(event.request, { ignoreSearch: true }).then(response => {
            return response || fetch(event.request).catch(() => {
                return caches.match(event.request);
            });
        })
    );
});

// 4. TERIMA PUSH NOTIFICATION DENGAN FILTER ANTI-DUPLIKASI ONESIGNAL
self.addEventListener('push', event => {
    let payload = null;
    if (event.data) {
        try {
            payload = event.data.json();
        } catch (_) {
            try {
                payload = { body: event.data.text() };
            } catch (_) {}
        }
    }

    // PENTING: Periksa apakah push ini berasal dari OneSignal
    // OneSignalSDK.sw.js SUDAH otomatis menampilkan push OneSignal.
    // Jika kita memanggil showNotification lagi di sini, notifikasi AKAN DOUBLE!
    const isOneSignal = payload && (
        payload.custom || 
        payload.os || 
        (payload.data && payload.data.custom) ||
        payload.notificationId
    );

    if (isOneSignal) {
        // Biarkan OneSignalSDK.sw.js yang menanganinya, cegah notifikasi dobel!
        return;
    }

    // Hanya proses jika ini push mentah non-OneSignal (custom push)
    if (payload) {
        const baseOrigin = getAssetsUrl();
        const title = payload.title || payload.headings?.id || payload.judul || "Cendekia Aksara";
        const body = payload.body || payload.contents?.id || payload.pesan || "Pemberitahuan baru.";
        const targetUrl = payload.url || payload.urlTujuan || "/mem-free/index.html";
        const tag = payload.tag || "cendekia-push";

        const options = {
            body: body,
            icon: payload.icon || (baseOrigin + "/img/icon-192x192.png"),
            badge: payload.badge || (baseOrigin + "/img/badge-96x96.png"),
            vibrate: [300, 100, 300, 100, 300],
            tag: tag,
            renotify: false,
            requireInteraction: true,
            silent: false,
            data: {
                url: targetUrl,
                timestamp: Date.now()
            },
            actions: [
                { action: 'open', title: '🚀 Buka Sekarang' },
                { action: 'close', title: 'Tutup' }
            ]
        };

        event.waitUntil(self.registration.showNotification(title, options));
    }
});

// 5. KLIK NOTIFIKASI: BUKA / FOKUS KE HALAMAN TUJUAN SECARA OTOMATIS
self.addEventListener('notificationclick', event => {
    event.notification.close();

    if (event.action === 'close') {
        return;
    }

    const targetUrl = (event.notification.data && event.notification.data.url) 
        ? event.notification.data.url 
        : '/mem-free/index.html';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
            for (let client of windowClients) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.navigate(targetUrl);
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});

// 6. KOMUNIKASI CLIENT KE SERVICE WORKER (TAMPILKAN NOTIFIKASI DENGAN TAG DETERMINISTIK)
self.addEventListener('message', event => {
    if (!event.data) return;

    const baseOrigin = getAssetsUrl();

    // A. Tampilkan notifikasi langsung via Service Worker dengan opsi layar kunci & logo resmi
    if (event.data.type === 'SHOW_NOTIFICATION') {
        const { title, options } = event.data;
        const opts = {
            body: options?.body || '',
            icon: options?.icon || (baseOrigin + "/img/icon-192x192.png"),
            badge: options?.badge || (baseOrigin + "/img/badge-96x96.png"),
            vibrate: options?.vibrate || [300, 100, 300, 100, 300],
            tag: options?.tag || 'cendekia-notice', // Tag deterministik mencegah duplikasi
            renotify: false, // Hindari alert ganda
            requireInteraction: true,
            silent: false,
            data: options?.data || { url: options?.urlTujuan || '/mem-free/index.html' },
            actions: [
                { action: 'open', title: '🚀 Buka Sekarang' },
                { action: 'close', title: 'Tutup' }
            ]
        };
        self.registration.showNotification(title || "Cendekia Aksara", opts);
    }

    // B. Simpan data user ke cache SW agar SW bisa memantau Ultah & Game saat app ditutup
    if (event.data.type === 'SYNC_USER') {
        saveUserState(event.data.user);
    }

    // C. Trigger background check langsung
    if (event.data.type === 'CHECK_BACKGROUND_NOW') {
        runBackgroundDailyCheck();
    }
});

// 7. SIMPAN DATA SISWA SECARA PERSISTEN DI SERVICE WORKER
async function saveUserState(user) {
    if (!user) return;
    try {
        const cache = await caches.open(USER_STATE_CACHE);
        const dataToSave = {
            uid: user.uid,
            name: user.name || 'Siswa Cendekia',
            tanggalLahir: user.tanggalLahir || '',
            tier: user.tier || 'Member Free',
            portalPrefix: user.portalPrefix || '/mem-free',
            lastUpdated: Date.now()
        };
        const response = new Response(JSON.stringify(dataToSave), {
            headers: { 'Content-Type': 'application/json' }
        });
        await cache.put(new Request('/__user_state__'), response);
    } catch (err) {
        console.warn("[SW] Gagal menyimpan user state:", err);
    }
}

// 8. BACA DATA SISWA TERSIMPAN DI SERVICE WORKER
async function getUserState() {
    try {
        const cache = await caches.open(USER_STATE_CACHE);
        const res = await cache.match('/__user_state__');
        if (res) return await res.json();
    } catch (_) {}
    return null;
}

// 9. PEMERIKSA LATAR BELAKANG OTOMATIS (GAME UNLOCKED & ULANG TAHUN SAAT WEB DITUTUP)
async function runBackgroundDailyCheck() {
    const user = await getUserState();
    if (!user) return;

    const baseOrigin = getAssetsUrl();
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentYear = now.getFullYear().toString();
    const currentMonthDay = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // A. CEK ULANG TAHUN SISWA (WALAUPUN APLIKASI DITUTUP)
    if (user.tanggalLahir) {
        const parts = user.tanggalLahir.split('-');
        let userMonthDay = "";
        if (parts.length === 3) {
            userMonthDay = parts[0].length === 4 ? `${parts[1]}-${parts[2]}` : `${parts[1]}-${parts[0]}`;
        }
        if (userMonthDay === currentMonthDay) {
            const cache = await caches.open(USER_STATE_CACHE);
            const ultahKey = `/__ultah_notified_${currentYear}__`;
            const alreadyNotified = await cache.match(ultahKey);

            if (!alreadyNotified) {
                await self.registration.showNotification("🎉 Selamat Ulang Tahun!", {
                    body: `Hai ${user.name}! Ada kejutan spesial dan hadiah literasi menunggumu di Cendekia Aksara hari ini.`,
                    icon: baseOrigin + "/img/icon-192x192.png",
                    badge: baseOrigin + "/img/badge-96x96.png",
                    vibrate: [300, 100, 300, 100, 300],
                    tag: `cendekia-ultah-${currentYear}`,
                    renotify: false,
                    requireInteraction: true,
                    silent: false,
                    data: { url: "/siswa/ultah.html" },
                    actions: [
                        { action: 'open', title: '🎁 Buka Kado Ultah' },
                        { action: 'close', title: 'Tutup' }
                    ]
                });
                await cache.put(new Request(ultahKey), new Response("done"));
            }
        }
    }

    // B. CEK GAME & MODE BERMAIN HARIAN TERBUKA
    const gameKey = `/__game_notified_${todayStr}__`;
    const cache = await caches.open(USER_STATE_CACHE);
    const gameAlreadyNotified = await cache.match(gameKey);

    if (!gameAlreadyNotified) {
        const portal = user.portalPrefix || '/mem-free';
        await self.registration.showNotification("🎮 Mode Bermain Terbuka!", {
            body: "Mode Santai, Tantangan, dan Acak hari ini sudah siap dimainkan. Asah kosakatamu dan raih skor tertinggi!",
            icon: baseOrigin + "/img/icon-192x192.png",
            badge: baseOrigin + "/img/badge-96x96.png",
            vibrate: [300, 100, 300, 100, 300],
            tag: `cendekia-game-${todayStr}`,
            renotify: false,
            requireInteraction: true,
            silent: false,
            data: { url: `${portal}/bermain.html` },
            actions: [
                { action: 'open', title: '🎮 Main Sekarang' },
                { action: 'close', title: 'Tutup' }
            ]
        });
        await cache.put(new Request(gameKey), new Response("done"));
    }
}

// 10. PERIODIC BACKGROUND SYNC
self.addEventListener('periodicsync', event => {
    if (event.tag === 'cendekia-daily-check' || event.tag === 'cendekia-sync') {
        event.waitUntil(runBackgroundDailyCheck());
    }
});

setInterval(() => {
    runBackgroundDailyCheck();
}, 3600000);
