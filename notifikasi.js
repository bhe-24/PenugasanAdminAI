/**
 * ==========================================================================
 * CENDEKIA AKSARA - SISTEM NOTIFIKASI PUSAT (notifikasi.js)
 * Versi: 2.8.0 (Executive Brand Notification Engine & Anti-Duplikasi Penuh)
 * 
 * Fitur Utama:
 * 1. Pencegahan Notifikasi Dobel / Dobel Tiga (Anti-Duplikasi & Debounce 4 Detik)
 * 2. Tag Deterministik W3C (Menjamin 1 Banner per Kategori tanpa Menumpuk)
 * 3. Pemutusan Loopback Push (Aksi Lokal Tidak Menembak Balik Push ke Diri Sendiri)
 * 4. Filter Push Service Worker (Mencegah OneSignalSDK & SW Menampilkan Event Sama)
 * 5. Logo Resmi (/img/icon-192x192.png) & Alpha-Mask Badge Android (/img/badge-96x96.png)
 * 6. Tombol Lonceng Mengambang Eksklusif dengan Inline Vector SVG Emas
 * 7. Perlindungan Eksekusi Tunggal (Single-Instance Script Guard)
 * ==========================================================================
 */

// 0. SINGLE INSTANCE SCRIPT GUARD (MENCEGAH LOAD GANDA DARI MULTI-TAG SCRIPT)
if (window.__cendekia_notifikasi_loaded__) {
    // Sudah dimuat dan aktif, cegah re-initialization
} else {
    window.__cendekia_notifikasi_loaded__ = true;

    (function (window, document) {
        'use strict';

        // Konfigurasi & Kunci Penyimpanan Lokal
        const STORAGE_KEY_HISTORY = 'cendekia_notifikasi_history';
        const STORAGE_KEY_SETTINGS = 'cendekia_notifikasi_settings';
        const STORAGE_KEY_LAST_GAME = 'cendekia_last_game_notif_date';
        const STORAGE_KEY_LAST_ULTAH = 'cendekia_last_ultah_notif_year';
        const STORAGE_KEY_PERM_STATE = 'cendekia_notif_permission_state';
        const ONESIGNAL_APP_ID = "a64fbdf1-dc29-48a3-a3a9-09e61157bca9";
        const ONESIGNAL_SAFARI_ID = "web.onesignal.auto.5a33fe23-ccc7-4feb-afe0-cf26b0b7b29c";

        let swRegistration = null;
        let isAudioChimeEnabled = true;
        let audioCtx = null;
        let oneSignalReady = false;

        // Anti-Duplikasi Cache (Memori 4 Detik)
        const recentDispatches = new Map();

        function isDuplicateNotification(judul, pesan) {
            const key = `${judul || ''}:::${pesan || ''}`;
            const now = Date.now();
            if (recentDispatches.has(key)) {
                const prev = recentDispatches.get(key);
                if (now - prev < 4000) { // Jika notifikasi yang sama dicoba kirim dalam 4 detik
                    return true; // Ditolak sebagai duplikat
                }
            }
            recentDispatches.set(key, now);
            return false;
        }

        // Deteksi Prefix Portal Member
        function detectPortalPrefix() {
            const path = window.location.pathname;
            if (path.startsWith('/mem-5k')) return '/mem-5k';
            if (path.startsWith('/mem-10k')) return '/mem-10k';
            if (path.startsWith('/mem-pro')) return '/mem-pro';
            if (path.startsWith('/siswa')) return '/siswa';
            return '/mem-free';
        }

        const PORTAL_PREFIX = detectPortalPrefix();

        function getBaseUrl() {
            return window.location.origin || "https://penugasan-admin-ai.vercel.app";
        }

        const OFFICIAL_LOGO_URL = getBaseUrl() + "/img/icon-192x192.png";
        const OFFICIAL_BADGE_URL = getBaseUrl() + "/img/badge-96x96.png";

        // ======================================================================
        // 1. INLINE VECTOR SVGS (ZERO-DEPENDENCY - SELALU MUNCUL TAJAM & ANTI HILANG)
        // ======================================================================
        const ICONS = {
            bell: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#d4af37" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`,
            bellWhite: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`,
            gamepad: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="12" x2="10" y2="12"></line><line x1="8" y1="10" x2="8" y2="14"></line><line x1="15" y1="13" x2="15.01" y2="13"></line><line x1="18" y1="11" x2="18.01" y2="11"></line><rect x="2" y="6" width="20" height="12" rx="6"></rect></svg>`,
            cake: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"></path><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"></path><path d="M2 21h20"></path><line x1="7" y1="8" x2="7" y2="11"></line><line x1="12" y1="8" x2="12" y2="11"></line><line x1="17" y1="8" x2="17" y2="11"></line></svg>`,
            trophy: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path></svg>`,
            medal: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"></circle><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"></path></svg>`,
            star: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`,
            mobile: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#d4af37" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"></rect><path d="M12 18h.01"></path></svg>`,
            xmark: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>`,
            trash: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>`,
            checkCircle: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`
        };

        function ensureFontAwesomeLoaded() {
            if (!document.querySelector('link[href*="font-awesome"]')) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';
                document.head.appendChild(link);
            }
        }

        // ======================================================================
        // 2. AUDIO CHIME GENERATOR
        // ======================================================================
        function playNotificationChime() {
            if (!isAudioChimeEnabled) return;
            try {
                const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                if (!AudioContextClass) return;
                if (!audioCtx) audioCtx = new AudioContextClass();
                if (audioCtx.state === 'suspended') {
                    audioCtx.resume();
                }

                const now = audioCtx.currentTime;
                const notes = [523.25, 659.25, 783.99];
                notes.forEach((freq, idx) => {
                    const osc = audioCtx.createOscillator();
                    const gain = audioCtx.createGain();

                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, now + idx * 0.08);

                    gain.gain.setValueAtTime(0, now + idx * 0.08);
                    gain.gain.linearRampToValueAtTime(0.18, now + idx * 0.08 + 0.02);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.35);

                    osc.connect(gain);
                    gain.connect(audioCtx.destination);

                    osc.start(now + idx * 0.08);
                    osc.stop(now + idx * 0.08 + 0.38);
                });
            } catch (_) {}
        }

        function vibrateDevice(pattern = [300, 100, 300, 100, 300]) {
            try {
                if ('vibrate' in navigator) {
                    navigator.vibrate(pattern);
                }
            } catch (_) {}
        }

        // ======================================================================
        // 3. REGISTRASI SERVICE WORKER
        // ======================================================================
        async function initServiceWorker() {
            if (!('serviceWorker' in navigator)) return null;

            try {
                const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
                swRegistration = reg;

                if ('periodicSync' in reg) {
                    try {
                        const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
                        if (status.state === 'granted') {
                            await reg.periodicSync.register('cendekia-daily-check', {
                                minInterval: 12 * 60 * 60 * 1000
                            });
                        }
                    } catch (_) {}
                }

                return reg;
            } catch (err) {
                console.warn('[CendekiaNotifikasi] Service Worker fallback aktif:', err.message);
                return null;
            }
        }

        function syncUserDataToServiceWorker(user) {
            if (!user) return;
            const payload = {
                type: 'SYNC_USER',
                user: {
                    uid: user.uid || 'guest',
                    name: user.name || 'Siswa Cendekia',
                    tanggalLahir: user.tanggalLahir || '',
                    tier: user.tier || 'Member Free',
                    portalPrefix: PORTAL_PREFIX
                }
            };

            if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage(payload);
            } else if (swRegistration && swRegistration.active) {
                swRegistration.active.postMessage(payload);
            }
        }

        // ======================================================================
        // 4. ONESIGNAL SDK AUTO-LOADER
        // ======================================================================
        function initOneSignal(user) {
            return new Promise((resolve) => {
                if (typeof window === 'undefined') return resolve(null);

                window.OneSignalDeferred = window.OneSignalDeferred || [];

                if (!document.getElementById('cendekia-onesignal-sdk')) {
                    const s = document.createElement('script');
                    s.id = 'cendekia-onesignal-sdk';
                    s.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
                    s.defer = true;
                    document.head.appendChild(s);
                }

                OneSignalDeferred.push(async function (OneSignal) {
                    try {
                        await OneSignal.init({
                            appId: ONESIGNAL_APP_ID,
                            safari_web_id: ONESIGNAL_SAFARI_ID,
                            allowLocalhostAsSecureOrigin: true,
                            serviceWorkerPath: "/sw.js",
                            serviceWorkerParam: { scope: "/" }
                        });

                        oneSignalReady = true;

                        if (user && user.uid) {
                            try {
                                await OneSignal.login(user.uid);
                                OneSignal.User.addTags({
                                    nama: user.name || 'Siswa Cendekia',
                                    tier: user.tier || 'Member Free',
                                    role: user.role || 'siswa',
                                    semester: String(user.semester || '1')
                                });
                            } catch (_) {}
                        }

                        if (OneSignal.Notifications && OneSignal.Notifications.permission) {
                            localStorage.setItem(STORAGE_KEY_PERM_STATE, 'granted');
                        }

                        resolve(OneSignal);
                    } catch (e) {
                        console.warn('[CendekiaNotifikasi] OneSignal init bypass:', e.message);
                        resolve(null);
                    }
                });
            });
        }

        // ======================================================================
        // 5. MANAJEMEN PENYIMPANAN RIWAYAT NOTIFIKASI
        // ======================================================================
        function getNotificationHistory() {
            try {
                return JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORY) || '[]');
            } catch (_) {
                return [];
            }
        }

        function saveNotificationHistory(list) {
            try {
                const trimmed = list.slice(0, 50);
                localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(trimmed));
                updateBellBadge();
                renderDrawerNotifications();
            } catch (e) {
                console.warn('[CendekiaNotifikasi] Gagal simpan riwayat:', e);
            }
        }

        function addNotificationToHistory(item) {
            const list = getNotificationHistory();
            const newItem = {
                id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
                judul: item.judul || 'Notifikasi Baru',
                pesan: item.pesan || '',
                urlTujuan: item.urlTujuan || `${PORTAL_PREFIX}/index.html`,
                jenis: item.jenis || 'umum',
                icon: item.icon || 'bell',
                read: false,
                timestamp: Date.now()
            };

            list.unshift(newItem);
            saveNotificationHistory(list);
            return newItem;
        }

        function markAllAsRead() {
            const list = getNotificationHistory();
            list.forEach(item => item.read = true);
            saveNotificationHistory(list);
        }

        function clearAllNotifications() {
            localStorage.removeItem(STORAGE_KEY_HISTORY);
            updateBellBadge();
            renderDrawerNotifications();
        }

        function getUnreadCount() {
            const list = getNotificationHistory();
            return list.filter(item => !item.read).length;
        }

        function cleanupStaleLevelUpHistory(actualLevel) {
            if (!actualLevel || actualLevel <= 1) return;
            try {
                const history = getNotificationHistory();
                let changed = false;
                const cleaned = history.filter(item => {
                    if (item.jenis === 'reward' && item.judul && item.judul.includes('Naik Tingkat Literasi')) {
                        const match = item.pesan && item.pesan.match(/Level\s+(\d+)/i);
                        if (match && parseInt(match[1], 10) < actualLevel) {
                            changed = true;
                            return false;
                        }
                    }
                    return true;
                });
                if (changed) {
                    saveNotificationHistory(cleaned);
                }
            } catch (_) {}
        }

        // ======================================================================
        // 6. IN-APP HEADS-UP NOTIFICATION BANNER
        // ======================================================================
        function getCategoryPill(jenis) {
            if (jenis === 'game' || jenis === 'game_score') {
                return {
                    icon: ICONS.gamepad,
                    bg: 'linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)',
                    color: '#ede9fe',
                    label: 'Mode Bermain'
                };
            } else if (jenis === 'ultah') {
                return {
                    icon: ICONS.cake,
                    bg: 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)',
                    color: '#fef3c7',
                    label: 'Ulang Tahun'
                };
            } else if (jenis === 'reward' || jenis === 'lencana') {
                return {
                    icon: ICONS.trophy,
                    bg: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
                    color: '#d1fae5',
                    label: 'Pencapaian'
                };
            }
            return {
                icon: ICONS.bellWhite,
                bg: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                color: '#e0f2fe',
                label: 'Info Resmi'
            };
        }

        function showInAppBanner(item) {
            const existing = document.getElementById('cendekia-toast-banner');
            if (existing) existing.remove();

            const toast = document.createElement('div');
            toast.id = 'cendekia-toast-banner';
            toast.className = 'cendekia-notif-toast';

            const cat = getCategoryPill(item.jenis);

            toast.innerHTML = `
                <div class="cnt-toast-inner">
                    <div class="cnt-logo-container">
                        <img src="${OFFICIAL_LOGO_URL}" alt="Cendekia Aksara" class="cnt-app-logo" onerror="this.onerror=null; this.src='/img/icon-192x192.png'">
                        <span class="cnt-cat-badge" style="background:${cat.bg};">${cat.icon}</span>
                    </div>
                    <div class="cnt-text-container">
                        <div class="cnt-meta-row">
                            <span class="cnt-app-name">CENDEKIA AKSARA</span>
                            <span class="cnt-dot">•</span>
                            <span class="cnt-meta-time">Baru saja</span>
                        </div>
                        <div class="cnt-toast-title">${escapeHtml(item.judul)}</div>
                        <div class="cnt-toast-msg">${escapeHtml(item.pesan)}</div>
                    </div>
                    <button type="button" class="cnt-close-toast" aria-label="Tutup">${ICONS.xmark}</button>
                </div>
            `;

            toast.addEventListener('click', (e) => {
                if (e.target.closest('.cnt-close-toast')) {
                    toast.classList.remove('active');
                    setTimeout(() => toast.remove(), 300);
                    return;
                }
                if (item.urlTujuan) {
                    window.location.href = item.urlTujuan;
                }
            });

            document.body.appendChild(toast);
            setTimeout(() => toast.classList.add('active'), 20);

            setTimeout(() => {
                if (document.body.contains(toast)) {
                    toast.classList.remove('active');
                    setTimeout(() => toast.remove(), 300);
                }
            }, 6000);
        }

        // ======================================================================
        // 7. NATIVE BROWSER NOTIFICATION (TAG DETERMINISTIK MENCEGAH STACK DOBEL)
        // ======================================================================
        function showNativeNotification(item) {
            if (!('Notification' in window)) return;
            if (Notification.permission !== 'granted') return;

            const title = item.judul || "Cendekia Aksara";
            const todayStr = new Date().toISOString().split('T')[0];
            const currentYear = new Date().getFullYear().toString();

            // Tag deterministik memastikan browser me-replace daripada menumpuk notifikasi baru
            const notifTag = item.tag || (
                item.jenis === 'game' ? (`cendekia-game-${todayStr}`) :
                item.jenis === 'ultah' ? (`cendekia-ultah-${currentYear}`) :
                item.jenis === 'game_score' ? 'cendekia-score' :
                item.jenis === 'reward' ? 'cendekia-reward' :
                'cendekia-notice'
            );

            const options = {
                body: item.pesan || "",
                icon: OFFICIAL_LOGO_URL,
                badge: OFFICIAL_BADGE_URL,
                vibrate: [300, 100, 300, 100, 300],
                tag: notifTag,
                renotify: false, // JANGAN pemicu getar/suara ganda jika tag sama
                requireInteraction: true,
                silent: false,
                data: {
                    url: item.urlTujuan || `${PORTAL_PREFIX}/index.html`
                },
                actions: [
                    { action: 'open', title: '🚀 Buka Sekarang' },
                    { action: 'close', title: 'Tutup' }
                ]
            };

            if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({
                    type: 'SHOW_NOTIFICATION',
                    title: title,
                    options: options
                });
            } else if (swRegistration && swRegistration.showNotification) {
                swRegistration.showNotification(title, options);
            } else {
                try {
                    const notif = new Notification(title, options);
                    notif.onclick = () => {
                        window.focus();
                        if (item.urlTujuan) window.location.href = item.urlTujuan;
                        notif.close();
                    };
                } catch (_) {}
            }
        }

        // ======================================================================
        // 8. DISPATCHER PUSAT NOTIFIKASI (ANTI-DUPLIKASI & PEMUTUS LOOPBACK PUSH)
        // ======================================================================
        async function kirimNotifikasi({ judul, pesan, urlTujuan, jenis = 'umum', icon = 'bell', targetUid = null, semester = null, send_after = null, sendPush = false }) {
            if (!judul && !pesan) return false;

            // Filter Anti-Duplikasi: Jika notifikasi identik dikirim dalam 4 detik, tolak!
            if (isDuplicateNotification(judul, pesan)) {
                return false;
            }

            const payload = {
                judul: judul || 'Cendekia Aksara',
                pesan: pesan || '',
                urlTujuan: urlTujuan || `${PORTAL_PREFIX}/index.html`,
                jenis: jenis,
                icon: icon
            };

            // 1. Simpan Riwayat
            addNotificationToHistory(payload);

            // 2. Chime Audio & Getaran HP
            playNotificationChime();
            vibrateDevice();

            // 3. Tampilkan Banner Heads-Up In-App
            showInAppBanner(payload);

            // 4. Tampilkan Native Notification di OS / Layar HP
            showNativeNotification(payload);

            // 5. PENTING: Hanya kirim push ke server (/api/notif) jika:
            // - Menjadwalkan di masa depan (send_after)
            // - Mengirim ke siswa lain (targetUid)
            // - ATAU diminta eksplisit (sendPush: true)
            // JANGAN broadcast ke OneSignal saat user sedang aktif di aplikasi!
            // (Ini adalah akar penyebab notifikasi muncul 2-3 kali sebelumnya!)
            if (send_after || targetUid || sendPush) {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 3500);

                    fetch('/api/notif', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            judul: payload.judul,
                            pesan: payload.pesan,
                            urlTujuan: payload.urlTujuan,
                            jenis: payload.jenis,
                            semester: semester,
                            targetUid: targetUid,
                            send_after: send_after
                        }),
                        signal: controller.signal
                    }).then(res => {
                        clearTimeout(timeoutId);
                        return res.json();
                    }).catch(() => {
                        clearTimeout(timeoutId);
                    });
                } catch (_) {}
            }

            return true;
        }

        // ======================================================================
        // 9. PEMINTA IZIN CEPAT & PENYIMPANAN IZIN PERSISTEN
        // ======================================================================
        async function requestPushPermissionDirectly() {
            if (!('Notification' in window)) return 'unsupported';

            try {
                let perm = Notification.permission;
                if (perm === 'default') {
                    perm = await Notification.requestPermission();
                }

                localStorage.setItem(STORAGE_KEY_PERM_STATE, perm);

                if (perm === 'granted') {
                    if (window.OneSignal && OneSignal.Notifications) {
                        try {
                            await OneSignal.Notifications.requestPermission();
                        } catch (_) {}
                    }

                    kirimNotifikasi({
                        judul: '🔔 Notifikasi Layar Kunci Aktif!',
                        pesan: 'Kamu akan menerima info game harian, skor terbaru, dan ucapan ultah langsung di HP walau aplikasi ditutup.',
                        urlTujuan: `${PORTAL_PREFIX}/index.html`,
                        jenis: 'umum'
                    });

                    scheduleTomorrowMorningGamePush();
                }

                const promptBox = document.getElementById('cendekia-permission-prompt');
                if (promptBox) promptBox.remove();

                return perm;
            } catch (err) {
                console.warn('[CendekiaNotifikasi] Permintaan izin error:', err);
                return 'denied';
            }
        }

        function scheduleTomorrowMorningGamePush() {
            try {
                const now = new Date();
                const tomorrowUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
                const sendAfterISO = tomorrowUTC.toISOString();

                fetch('/api/notif', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        judul: '🎮 Mode Bermain Terbuka!',
                        pesan: 'Mode Santai, Tantangan, dan Acak hari ini sudah siap dimainkan. Asah kosakatamu dan raih skor tertinggi!',
                        urlTujuan: `${PORTAL_PREFIX}/bermain.html`,
                        jenis: 'game',
                        send_after: sendAfterISO
                    })
                }).catch(() => {});
            } catch (_) {}
        }

        function checkAndPromptPermission() {
            if (!('Notification' in window)) return;

            const currentPerm = Notification.permission;
            const savedPerm = localStorage.getItem(STORAGE_KEY_PERM_STATE);

            if (currentPerm === 'granted') {
                if (savedPerm !== 'granted') {
                    localStorage.setItem(STORAGE_KEY_PERM_STATE, 'granted');
                }
                return;
            }

            if (currentPerm === 'denied') {
                localStorage.setItem(STORAGE_KEY_PERM_STATE, 'denied');
                return;
            }

            setTimeout(() => {
                if (document.getElementById('cendekia-permission-prompt')) return;

                const prompt = document.createElement('div');
                prompt.id = 'cendekia-permission-prompt';
                prompt.className = 'cendekia-permission-box';
                prompt.innerHTML = `
                    <div style="display:flex; align-items:flex-start; gap:12px;">
                        <div class="cpp-icon">${ICONS.mobile}</div>
                        <div style="flex:1;">
                            <div class="cpp-title">Aktifkan Notifikasi Layar Kunci HP</div>
                            <div class="cpp-desc">Dapatkan pengingat otomatis saat game harian terbuka & ucapan ulang tahun langsung di HP walau aplikasi sedang ditutup.</div>
                            <div class="cpp-btn-row">
                                <button type="button" class="cpp-btn-allow" id="btn-allow-notif">⚡ Izinkan Sekarang</button>
                                <button type="button" class="cpp-btn-later" id="btn-later-notif">Nanti Saja</button>
                            </div>
                        </div>
                    </div>
                `;

                document.body.appendChild(prompt);

                document.getElementById('btn-allow-notif').addEventListener('click', () => {
                    requestPushPermissionDirectly();
                });

                document.getElementById('btn-later-notif').addEventListener('click', () => {
                    localStorage.setItem(STORAGE_KEY_PERM_STATE, 'later');
                    prompt.remove();
                });
            }, 1200);
        }

        // ======================================================================
        // 10. PEMICU NOTIFIKASI OTOMATIS: GAME, ULANG TAHUN, DAN REWARD (ATOMIC LOCK)
        // ======================================================================
        function cekNotifikasiGameHarian() {
            const todayStr = new Date().toISOString().split('T')[0];
            const lastNotifDate = localStorage.getItem(STORAGE_KEY_LAST_GAME);

            if (lastNotifDate !== todayStr) {
                // Kunci tanggal SEBELUM memanggil kirimNotifikasi agar tidak terjadi race-condition
                localStorage.setItem(STORAGE_KEY_LAST_GAME, todayStr);

                kirimNotifikasi({
                    judul: '🎮 Mode Bermain Terbuka!',
                    pesan: 'Mode Santai, Tantangan, dan Acak hari ini sudah siap dimainkan. Asah kosakatamu dan raih skor tertinggi!',
                    urlTujuan: `${PORTAL_PREFIX}/bermain.html`,
                    jenis: 'game',
                    icon: 'gamepad'
                });
            }
        }

        function notifSkorBermain(modeName, score, xp) {
            kirimNotifikasi({
                judul: `🏆 Skor Bermain: Mode ${modeName || 'Literasi'}!`,
                pesan: `Pencapaian hebat! Skor ${score} (+${xp || 15} XP) berhasil dicatatkan. Cek posisimu di Grafik Skorku.`,
                urlTujuan: `${PORTAL_PREFIX}/grafik-skorku.html`,
                jenis: 'game_score',
                icon: 'trophy'
            });
        }

        function cekNotifikasiUlangTahun(user) {
            if (!user || !user.tanggalLahir) return;

            const now = new Date();
            const currentYear = now.getFullYear().toString();
            const currentMonthDay = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

            const parts = user.tanggalLahir.split('-');
            let userMonthDay = "";
            if (parts.length === 3) {
                userMonthDay = parts[0].length === 4 ? `${parts[1]}-${parts[2]}` : `${parts[1]}-${parts[0]}`;
            }

            const lastNotifiedYear = localStorage.getItem(STORAGE_KEY_LAST_ULTAH);

            if (userMonthDay === currentMonthDay && lastNotifiedYear !== currentYear) {
                // Kunci tahun SEBELUM mengirim notifikasi
                localStorage.setItem(STORAGE_KEY_LAST_ULTAH, currentYear);

                kirimNotifikasi({
                    judul: `🎉 Selamat Ulang Tahun, ${user.name || 'Siswa'}!`,
                    pesan: 'Selamat hari lahir dari keluarga besar Cendekia Aksara! Buka kejutan spesial dan hadiah literasimu sekarang.',
                    urlTujuan: '/siswa/ultah.html',
                    jenis: 'ultah',
                    icon: 'cake'
                });
            }
        }

        function notifPemerolehan({ tipe = 'lencana', nama = '', xp = 0, levelTitle = '', level = null }) {
            if (tipe === 'lencana') {
                kirimNotifikasi({
                    judul: '🏅 Lencana Baru Terbuka!',
                    pesan: `Selamat! Kamu berhasil meraih Lencana "${nama}". Terus ukir karya dan prestasimu.`,
                    urlTujuan: `${PORTAL_PREFIX}/profil.html`,
                    jenis: 'reward',
                    icon: 'medal'
                });
            } else if (tipe === 'level_up') {
                // Ambil data user aktual dari sistem database / profil
                let user = null;
                if (window.CendekiaApp && typeof window.CendekiaApp.getUser === 'function') {
                    user = window.CendekiaApp.getUser();
                } else {
                    try {
                        user = JSON.parse(localStorage.getItem('cendekia_free_user') || localStorage.getItem('cendekia_user') || 'null');
                    } catch (_) {}
                }

                const dbUserLvl = parseInt(user?.level || localStorage.getItem('user_level') || localStorage.getItem('cendekia_user_level'));
                const actualLevel = (!isNaN(dbUserLvl) && dbUserLvl > 0) ? dbUserLvl : (parseInt(level) || 1);
                const actualSemester = parseInt(user?.semester || localStorage.getItem('user_semester')) || 1;

                // VALIDASI KETAT: Jika ada proses lama yang memicu notifikasi level lebih rendah dari level aktual database
                // (misal: user di database sudah Level 12, tapi ada trigger usang Level 2), abaikan notifikasi salah tersebut!
                if (level && !isNaN(parseInt(level)) && parseInt(level) < actualLevel) {
                    console.warn(`[CendekiaNotifikasi] Abaikan notif level palsu (Trigger: Level ${level}, Database: Level ${actualLevel})`);
                    return;
                }

                const finalTitle = levelTitle || `Level ${actualLevel} • Semester ${actualSemester}`;

                kirimNotifikasi({
                    judul: '⭐ Naik Tingkat Literasi!',
                    pesan: `Luar biasa! Kamu berhasil naik ke ${finalTitle}. Akses materi baru kini terbuka.`,
                    urlTujuan: `${PORTAL_PREFIX}/index.html`,
                    jenis: 'reward',
                    icon: 'star'
                });
            } else if (tipe === 'tantangan') {
                kirimNotifikasi({
                    judul: '🎯 Tantangan Selesai!',
                    pesan: `Tantangan "${nama}" selesai dikerjakan (+${xp} XP). Tetap konsisten belajar!`,
                    urlTujuan: `${PORTAL_PREFIX}/tantangan.html`,
                    jenis: 'reward',
                    icon: 'trophy'
                });
            }
        }

        // ======================================================================
        // 11. UI STYLING & FLOATING BELL WIDGET DENGAN VECTOR SVG EMAS
        // ======================================================================
        function injectNotificationStyles() {
            if (document.getElementById('cendekia-notif-styles')) return;

            const style = document.createElement('style');
            style.id = 'cendekia-notif-styles';
            style.textContent = `
                /* HEADS-UP TOAST BANNER */
                .cendekia-notif-toast {
                    position: fixed;
                    top: -140px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 94%;
                    max-width: 420px;
                    background: rgba(0, 26, 51, 0.95);
                    backdrop-filter: blur(14px);
                    -webkit-backdrop-filter: blur(14px);
                    border: 1.5px solid rgba(212, 175, 55, 0.45);
                    border-radius: 18px;
                    box-shadow: 0 16px 40px rgba(0, 15, 36, 0.45), 0 0 20px rgba(212, 175, 55, 0.2);
                    z-index: 99999;
                    transition: top 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                    cursor: pointer;
                    box-sizing: border-box;
                    padding: 12px 14px;
                    color: #ffffff;
                }
                .cendekia-notif-toast.active {
                    top: 16px;
                }
                .cnt-toast-inner {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .cnt-logo-container {
                    position: relative;
                    width: 44px;
                    height: 44px;
                    flex-shrink: 0;
                }
                .cnt-app-logo {
                    width: 44px;
                    height: 44px;
                    border-radius: 12px;
                    object-fit: cover;
                    background: #ffffff;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                    border: 1.5px solid rgba(255,255,255,0.4);
                }
                .cnt-cat-badge {
                    position: absolute;
                    bottom: -3px;
                    right: -3px;
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.4);
                    border: 1.5px solid #ffffff;
                }
                .cnt-text-container {
                    flex: 1;
                    min-width: 0;
                }
                .cnt-meta-row {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    margin-bottom: 2px;
                }
                .cnt-app-name {
                    font-size: 0.64rem;
                    font-weight: 800;
                    letter-spacing: 0.08em;
                    color: #d4af37;
                }
                .cnt-dot {
                    font-size: 0.6rem;
                    color: #94a3b8;
                }
                .cnt-meta-time {
                    font-size: 0.62rem;
                    color: #94a3b8;
                    font-weight: 600;
                }
                .cnt-toast-title {
                    font-size: 0.84rem;
                    font-weight: 800;
                    color: #ffffff;
                    line-height: 1.25;
                    margin-bottom: 2px;
                }
                .cnt-toast-msg {
                    font-size: 0.72rem;
                    color: #cbd5e1;
                    line-height: 1.35;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }
                .cnt-close-toast {
                    background: transparent;
                    border: none;
                    color: #94a3b8;
                    cursor: pointer;
                    padding: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: color 0.2s;
                }
                .cnt-close-toast:hover { color: #ffffff; }

                /* PERMISSION PROMPT BOX */
                .cendekia-permission-box {
                    position: fixed;
                    bottom: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 92%;
                    max-width: 410px;
                    background: white;
                    border-radius: 16px;
                    padding: 16px;
                    box-shadow: 0 12px 35px rgba(0, 31, 63, 0.22);
                    border: 1.5px solid #d4af37;
                    z-index: 99998;
                    box-sizing: border-box;
                    animation: slideUpPrompt 0.4s ease;
                }
                @keyframes slideUpPrompt {
                    from { bottom: -100px; opacity: 0; }
                    to { bottom: 20px; opacity: 1; }
                }
                .cpp-icon {
                    width: 42px;
                    height: 42px;
                    border-radius: 12px;
                    background: linear-gradient(135deg, #001f3f 0%, #003366 100%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }
                .cpp-title {
                    font-size: 0.88rem;
                    font-weight: 800;
                    color: #003366;
                    margin-bottom: 3px;
                }
                .cpp-desc {
                    font-size: 0.72rem;
                    color: #64748b;
                    line-height: 1.4;
                    margin-bottom: 10px;
                }
                .cpp-btn-row {
                    display: flex;
                    gap: 8px;
                }
                .cpp-btn-allow {
                    background: #003366;
                    color: white;
                    border: none;
                    padding: 8px 14px;
                    border-radius: 8px;
                    font-size: 0.75rem;
                    font-weight: 800;
                    cursor: pointer;
                    transition: background 0.2s;
                }
                .cpp-btn-allow:hover { background: #001f3f; }
                .cpp-btn-later {
                    background: #f1f5f9;
                    color: #64748b;
                    border: none;
                    padding: 8px 12px;
                    border-radius: 8px;
                    font-size: 0.75rem;
                    font-weight: 700;
                    cursor: pointer;
                }

                /* FLOATING BELL WIDGET */
                .cendekia-floating-bell {
                    position: fixed;
                    bottom: 84px;
                    right: 18px;
                    width: 48px;
                    height: 48px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #001f3f 0%, #003366 100%);
                    border: 2px solid #d4af37;
                    box-shadow: 0 8px 24px rgba(0, 31, 63, 0.4), 0 0 15px rgba(212, 175, 55, 0.35);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    z-index: 99990;
                    transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s;
                }
                .cendekia-floating-bell:hover {
                    transform: scale(1.08) translateY(-2px);
                    box-shadow: 0 12px 28px rgba(0, 31, 63, 0.5), 0 0 20px rgba(212, 175, 55, 0.5);
                }
                .cendekia-floating-bell:active {
                    transform: scale(0.94);
                }
                .cendekia-bell-inner {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 100%;
                    height: 100%;
                }
                .cendekia-bell-inner svg {
                    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
                    transition: transform 0.3s;
                }
                .cendekia-floating-bell:hover .cendekia-bell-inner svg {
                    transform: rotate(15deg);
                }
                .cendekia-bell-badge {
                    position: absolute;
                    top: -3px;
                    right: -3px;
                    background: #e11d48;
                    color: white;
                    font-size: 0.62rem;
                    font-weight: 800;
                    padding: 2px 6px;
                    border-radius: 10px;
                    border: 2px solid white;
                    display: none;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                }

                /* NOTIFICATION DRAWER */
                .cendekia-notif-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 18, 46, 0.55);
                    backdrop-filter: blur(5px);
                    -webkit-backdrop-filter: blur(5px);
                    z-index: 99995;
                    display: none;
                    justify-content: flex-end;
                }
                .cendekia-notif-overlay.open {
                    display: flex;
                }
                .cendekia-notif-drawer {
                    width: 100%;
                    max-width: 400px;
                    height: 100%;
                    background: #f8fafc;
                    display: flex;
                    flex-direction: column;
                    box-shadow: -8px 0 30px rgba(0, 0, 0, 0.25);
                    animation: slideDrawer 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                }
                @keyframes slideDrawer {
                    from { transform: translateX(100%); }
                    to { transform: translateX(0); }
                }
                .cnd-header {
                    background: white;
                    padding: 16px;
                    border-bottom: 1.5px solid #e2e8f0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .cnd-brand-wrap {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .cnd-thumb-logo {
                    width: 32px;
                    height: 32px;
                    border-radius: 8px;
                    object-fit: cover;
                    border: 1px solid #d4af37;
                }
                .cnd-title {
                    font-size: 0.94rem;
                    font-weight: 800;
                    color: #003366;
                    margin: 0;
                }
                .cnd-body {
                    flex: 1;
                    overflow-y: auto;
                    padding: 12px 14px;
                    -webkit-overflow-scrolling: touch;
                }
                .cnd-item-card {
                    background: white;
                    border-radius: 14px;
                    padding: 12px;
                    margin-bottom: 10px;
                    border: 1.5px solid #e2e8f0;
                    display: flex;
                    gap: 12px;
                    cursor: pointer;
                    transition: all 0.15s;
                    position: relative;
                }
                .cnd-item-card:hover {
                    border-color: #cbd5e1;
                    box-shadow: 0 4px 14px rgba(0, 51, 102, 0.06);
                }
                .cnd-item-card.unread {
                    border-color: #93c5fd;
                    background: #f0f7ff;
                }
                .cnd-item-card.unread::after {
                    content: '';
                    position: absolute;
                    top: 12px;
                    right: 12px;
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: #2563eb;
                }
                .cnd-card-icon {
                    width: 38px;
                    height: 38px;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }
                .cnd-item-title {
                    font-size: 0.82rem;
                    font-weight: 800;
                    color: #0f172a;
                    margin-bottom: 2px;
                    padding-right: 12px;
                }
                .cnd-item-desc {
                    font-size: 0.72rem;
                    color: #64748b;
                    line-height: 1.35;
                    margin-bottom: 4px;
                }
                .cnd-item-time {
                    font-size: 0.62rem;
                    color: #94a3b8;
                    font-weight: 700;
                }
                .cnd-empty {
                    text-align: center;
                    padding: 50px 20px;
                    color: #94a3b8;
                }
                .cnd-empty-icon {
                    font-size: 40px;
                    color: #cbd5e1;
                    margin-bottom: 8px;
                }
            `;
            document.head.appendChild(style);
        }

        function injectFloatingBell() {
            if (document.getElementById('cendekia-floating-bell-btn')) return;

            const bell = document.createElement('div');
            bell.id = 'cendekia-floating-bell-btn';
            bell.className = 'cendekia-floating-bell';
            bell.title = 'Pusat Notifikasi Cendekia Aksara';
            bell.innerHTML = `
                <div class="cendekia-bell-inner">
                    ${ICONS.bell}
                </div>
                <span id="cendekia-bell-badge" class="cendekia-bell-badge">0</span>
            `;

            bell.addEventListener('click', toggleDrawer);
            document.body.appendChild(bell);

            const overlay = document.createElement('div');
            overlay.id = 'cendekia-notif-drawer-overlay';
            overlay.className = 'cendekia-notif-overlay';
            overlay.innerHTML = `
                <div class="cendekia-notif-drawer">
                    <div class="cnd-header">
                        <div class="cnd-brand-wrap">
                            <img src="${OFFICIAL_LOGO_URL}" alt="Logo" class="cnd-thumb-logo" onerror="this.onerror=null; this.src='/img/icon-192x192.png'">
                            <div>
                                <h3 class="cnd-title">Pusat Notifikasi</h3>
                                <div style="font-size:0.65rem; color:#64748b; margin-top:2px;" id="cnd-sw-status">Antena Layar Kunci: Aktif</div>
                            </div>
                        </div>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <button type="button" id="cnd-btn-mark-all" style="background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; font-size:0.65rem; font-weight:800; padding:4px 8px; border-radius:6px; cursor:pointer;">
                                Baca Semua
                            </button>
                            <button type="button" id="cnd-btn-close" style="background:transparent; border:none; color:#64748b; font-size:18px; cursor:pointer; padding:4px;">
                                ${ICONS.xmark}
                            </button>
                        </div>
                    </div>

                    <!-- QUICK TEST & STATUS BAR -->
                    <div style="background:#fffbeb; padding:8px 14px; border-bottom:1px solid #fef3c7; display:flex; align-items:center; justify-content:space-between;">
                        <span style="font-size:0.68rem; color:#92400e; font-weight:700; display:flex; align-items:center; gap:6px;">
                            ${ICONS.checkCircle} Antena Layar Kunci HP
                        </span>
                        <button type="button" id="cnd-btn-test-notif" style="background:#d97706; color:white; border:none; padding:4px 10px; border-radius:6px; font-size:0.65rem; font-weight:800; cursor:pointer;">
                            Uji Banner &amp; Getar
                        </button>
                    </div>

                    <div class="cnd-body" id="cnd-drawer-list">
                        <!-- List notifikasi akan dirender di sini via JS -->
                    </div>

                    <div style="padding:10px 14px; background:white; border-top:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
                        <button type="button" id="cnd-btn-clear" style="background:none; border:none; color:#ef4444; font-size:0.7rem; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:6px;">
                            ${ICONS.trash} Hapus Riwayat
                        </button>
                        <span style="font-size:0.65rem; color:#94a3b8;">PT Cendekia Aksara Edukasi</span>
                    </div>
                </div>
            `;

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) toggleDrawer();
            });

            document.body.appendChild(overlay);

            document.getElementById('cnd-btn-close').addEventListener('click', toggleDrawer);
            document.getElementById('cnd-btn-mark-all').addEventListener('click', () => {
                markAllAsRead();
            });
            document.getElementById('cnd-btn-clear').addEventListener('click', () => {
                clearAllNotifications();
            });
            document.getElementById('cnd-btn-test-notif').addEventListener('click', () => {
                if (('Notification' in window) && Notification.permission !== 'granted') {
                    requestPushPermissionDirectly();
                    return;
                }

                kirimNotifikasi({
                    judul: '🔔 Uji Coba Layar Kunci Berhasil!',
                    pesan: 'Logo resmi, getaran HP, dan audio chime bekerja dengan standar aplikasi besar.',
                    urlTujuan: `${PORTAL_PREFIX}/bermain.html`,
                    jenis: 'game'
                });
            });

            updateBellBadge();
            renderDrawerNotifications();
        }

        function toggleDrawer() {
            const overlay = document.getElementById('cendekia-notif-drawer-overlay');
            if (!overlay) return;
            overlay.classList.toggle('open');
            if (overlay.classList.contains('open')) {
                renderDrawerNotifications();
                const statusEl = document.getElementById('cnd-sw-status');
                if (statusEl) {
                    const hasPerm = ('Notification' in window) && Notification.permission === 'granted';
                    statusEl.innerHTML = hasPerm 
                        ? '<span style="color:#16a34a; font-weight:700;">● Layar Kunci &amp; Push: Aktif</span>' 
                        : '<span style="color:#d97706; font-weight:700;">● Push Layar Kunci: Belum Diizinkan</span>';
                }
            }
        }

        function updateBellBadge() {
            const badge = document.getElementById('cendekia-bell-badge');
            if (!badge) return;
            const unread = getUnreadCount();
            if (unread > 0) {
                badge.innerText = unread > 9 ? '9+' : unread;
                badge.style.display = 'block';
            } else {
                badge.style.display = 'none';
            }
        }

        function formatTimeAgo(ts) {
            if (!ts) return '';
            const diff = Math.floor((Date.now() - ts) / 1000);
            if (diff < 60) return 'Baru saja';
            if (diff < 3600) return Math.floor(diff / 60) + ' mnt lalu';
            if (diff < 86400) return Math.floor(diff / 3600) + ' jam lalu';
            return Math.floor(diff / 86400) + ' hari lalu';
        }

        function renderDrawerNotifications() {
            const container = document.getElementById('cnd-drawer-list');
            if (!container) return;

            const list = getNotificationHistory();
            if (list.length === 0) {
                container.innerHTML = `
                    <div class="cnd-empty">
                        <div class="cnd-empty-icon">${ICONS.bellWhite}</div>
                        <div style="font-size:0.85rem; font-weight:800; color:#475569; margin-bottom:4px;">Belum Ada Notifikasi</div>
                        <div style="font-size:0.72rem; color:#94a3b8; max-width:240px; margin:0 auto;">Notifikasi game terbuka, capaian literasi, dan ucapan ultah akan muncul di sini.</div>
                    </div>
                `;
                return;
            }

            let html = '';
            list.forEach(item => {
                const cat = getCategoryPill(item.jenis);

                html += `
                    <div class="cnd-item-card ${item.read ? '' : 'unread'}" onclick="window.CendekiaNotifikasi.openItem('${item.id}', '${item.urlTujuan}')">
                        <div class="cnd-card-icon" style="background:${cat.bg}; color:white;">
                            ${cat.icon}
                        </div>
                        <div style="flex:1; min-width:0;">
                            <div class="cnd-item-title">${escapeHtml(item.judul)}</div>
                            <div class="cnd-item-desc">${escapeHtml(item.pesan)}</div>
                            <div class="cnd-item-time">${formatTimeAgo(item.timestamp)}</div>
                        </div>
                    </div>
                `;
            });

            container.innerHTML = html;
        }

        function openItem(id, url) {
            const list = getNotificationHistory();
            const found = list.find(x => x.id === id);
            if (found) {
                found.read = true;
                saveNotificationHistory(list);
            }
            if (url) {
                window.location.href = url;
            }
        }

        function escapeHtml(str) {
            if (!str) return '';
            return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        }

        // ======================================================================
        // 12. INISIALISASI UTAMA & SINKRONISASI PENGGUNA
        // ======================================================================
        async function init() {
            ensureFontAwesomeLoaded();
            injectNotificationStyles();
            injectFloatingBell();
            await initServiceWorker();

            let user = null;
            if (window.CendekiaApp && typeof window.CendekiaApp.getUser === 'function') {
                user = window.CendekiaApp.getUser();
            } else {
                try {
                    user = JSON.parse(localStorage.getItem('cendekia_free_user') || localStorage.getItem('cendekia_user') || 'null');
                } catch (_) {}
            }

            const dbUserLvl = parseInt(user?.level || localStorage.getItem('user_level') || localStorage.getItem('cendekia_user_level'));
            if (!isNaN(dbUserLvl) && dbUserLvl > 1) {
                cleanupStaleLevelUpHistory(dbUserLvl);
            }

            initOneSignal(user);

            if (user) {
                syncUserDataToServiceWorker(user);
                cekNotifikasiGameHarian();
                cekNotifikasiUlangTahun(user);
            }

            checkAndPromptPermission();
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            init();
        }

        // ======================================================================
        // 13. EKSPOR PUBLIK API (window.CendekiaNotifikasi)
        // ======================================================================
        window.CendekiaNotifikasi = {
            init,
            kirim: kirimNotifikasi,
            requestPermission: requestPushPermissionDirectly,
            notifGameTerbuka: cekNotifikasiGameHarian,
            notifSkorBermain: notifSkorBermain,
            notifUltah: cekNotifikasiUlangTahun,
            notifPemerolehan: notifPemerolehan,
            syncUser: syncUserDataToServiceWorker,
            openItem,
            toggleDrawer,
            markAllAsRead,
            clearAllNotifications,
            playChime: playNotificationChime,
            getHistory: getNotificationHistory
        };

    })(window, document);
}
