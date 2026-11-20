/**
 * ==========================================================================
 * CENDEKIA AKSARA - SISTEM NOTIFIKASI PUSAT (notifikasi.js)
 * Versi: 2.6.0 (Engine Notifikasi Latar Belakang & Layar Kunci HP)
 * 
 * Fitur Utama:
 * 1. Pemicu Notifikasi Layar Kunci HP (Walau Aplikasi Web Ditutup)
 * 2. Meminta Izin Secara Cepat & Izin Diingat Langsung (Persisten)
 * 3. Integrasi Otomatis OneSignal Web Push v16 & Service Worker Native
 * 4. Pemicu Otomatis: Game Harian Terbuka, Hadiah/Lencana, Ulang Tahun Siswa
 * 5. Tahan Banting: Jika API Offline / Server Mati, Notifikasi Berjalan Mandiri
 *    tanpa bug dan tanpa error.
 * 6. Banner In-App Elegan, Slide-in Drawer, Floating Bell, & Sintesis Audio Chime.
 * ==========================================================================
 */

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

    // ======================================================================
    // 1. AUDIO CHIME GENERATOR (SINTESIS NADA WEB AUDIO API - ZERO DEPENDENCY)
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
            const notes = [523.25, 659.25, 783.99]; // Akor C Mayor: C5, E5, G5 ceria
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
        } catch (_) {
            // Autoplay policy bypass
        }
    }

    function vibrateDevice(pattern = [300, 100, 300, 100, 300]) {
        try {
            if ('vibrate' in navigator) {
                navigator.vibrate(pattern);
            }
        } catch (_) {}
    }

    // ======================================================================
    // 2. REGISTRASI SERVICE WORKER & BACKGROUND PUSH SYNC
    // ======================================================================
    async function initServiceWorker() {
        if (!('serviceWorker' in navigator)) return null;

        try {
            const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
            swRegistration = reg;

            // Daftarkan Periodic Background Sync jika didukung peramban
            if ('periodicSync' in reg) {
                try {
                    const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
                    if (status.state === 'granted') {
                        await reg.periodicSync.register('cendekia-daily-check', {
                            minInterval: 12 * 60 * 60 * 1000 // Minimal cek tiap 12 jam
                        });
                    }
                } catch (_) {}
            }

            // Dengarkan pesan balik dari Service Worker
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data && event.data.type === 'NEW_NOTIFICATION') {
                    handleIncomingNotification(event.data.payload);
                }
            });

            return reg;
        } catch (err) {
            console.warn('[CendekiaNotifikasi] Service Worker fallback aktif:', err.message);
            return null;
        }
    }

    // Sinkronisasi data user saat ini ke Service Worker agar SW bisa memantau saat web ditutup
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
    // 3. ONESIGNAL SDK AUTO-LOADER & REGISTRASI PUSH LAYAR KUNCI
    // ======================================================================
    function initOneSignal(user) {
        return new Promise((resolve) => {
            if (typeof window === 'undefined') return resolve(null);

            window.OneSignalDeferred = window.OneSignalDeferred || [];

            // Muat skrip OneSignal jika belum ada di head
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

                    // Sambungkan UID Siswa ke OneSignal untuk push presisi
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

                    // Sinkronkan status izin OneSignal dengan localStorage
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
    // 4. MANAJEMEN PENYIMPANAN RIWAYAT NOTIFIKASI
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

    // ======================================================================
    // 5. FLOATING NOTIFICATION BANNER (IN-APP TOAST)
    // ======================================================================
    function showInAppBanner(item) {
        const existing = document.getElementById('cendekia-toast-banner');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.id = 'cendekia-toast-banner';
        toast.className = 'cendekia-notif-toast';

        let iconHtml = '<i class="fa-solid fa-bell"></i>';
        let bgGrad = 'linear-gradient(135deg, #001f3f 0%, #003366 100%)';

        if (item.jenis === 'game' || item.jenis === 'game_score') {
            iconHtml = '<i class="fa-solid fa-gamepad"></i>';
            bgGrad = 'linear-gradient(135deg, #4c1d95 0%, #7c3aed 100%)';
        } else if (item.jenis === 'ultah') {
            iconHtml = '<i class="fa-solid fa-cake-candles"></i>';
            bgGrad = 'linear-gradient(135deg, #b45309 0%, #f59e0b 100%)';
        } else if (item.jenis === 'reward' || item.jenis === 'lencana') {
            iconHtml = '<i class="fa-solid fa-medal"></i>';
            bgGrad = 'linear-gradient(135deg, #065f46 0%, #059669 100%)';
        }

        toast.style.background = bgGrad;
        toast.innerHTML = `
            <div class="cnt-icon-box" style="background:rgba(255,255,255,0.2);">${iconHtml}</div>
            <div class="cnt-text-box">
                <div class="cnt-title">${escapeHtml(item.judul)}</div>
                <div class="cnt-desc">${escapeHtml(item.pesan)}</div>
            </div>
            <button type="button" class="cnt-close-btn" aria-label="Tutup"><i class="fa-solid fa-xmark"></i></button>
        `;

        toast.addEventListener('click', (e) => {
            if (e.target.closest('.cnt-close-btn')) {
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
        }, 5500);
    }

    // ======================================================================
    // 6. NATIVE BROWSER & SERVICE WORKER LOCKSCREEN NOTIFICATION
    // ======================================================================
    function showNativeNotification(item) {
        if (!('Notification' in window)) return;

        if (Notification.permission === 'granted') {
            const title = item.judul || "Cendekia Aksara";
            const options = {
                body: item.pesan || "",
                icon: "https://i.imgur.com/5Srjyo4.png",
                badge: "https://i.imgur.com/5Srjyo4.png",
                vibrate: [300, 100, 300, 100, 300], // Getar layar kunci
                tag: (item.jenis || 'cendekia') + '-' + Date.now(),
                renotify: true,
                requireInteraction: true, // Banner tetap bertahan di layar kunci HP
                silent: false,
                data: {
                    url: item.urlTujuan || `${PORTAL_PREFIX}/index.html`
                },
                actions: [
                    { action: 'open', title: '🚀 Buka Sekarang' },
                    { action: 'close', title: 'Tutup' }
                ]
            };

            // Kirim lewat Service Worker agar memicu layar kunci HP
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
    }

    // ======================================================================
    // 7. DISPATCHER PUSAT NOTIFIKASI (MULTI-CHANNEL DENGAN PERLINDUNGAN KEBAL ERROR)
    // ======================================================================
    async function kirimNotifikasi({ judul, pesan, urlTujuan, jenis = 'umum', icon = 'bell', targetUid = null, semester = null, send_after = null }) {
        if (!judul && !pesan) return;

        const payload = {
            judul: judul || 'Cendekia Aksara',
            pesan: pesan || '',
            urlTujuan: urlTujuan || `${PORTAL_PREFIX}/index.html`,
            jenis: jenis,
            icon: icon
        };

        // 1. Simpan ke Riwayat Lokal
        addNotificationToHistory(payload);

        // 2. Bunyikan Chime Audio & Getaran HP
        playNotificationChime();
        vibrateDevice();

        // 3. Tampilkan Banner In-App jika web sedang dibuka
        showInAppBanner(payload);

        // 4. Pemicu Notifikasi Layar Kunci HP
        showNativeNotification(payload);

        // 5. Kirim Push ke /api/notif untuk dipancarkan ke HP melalui OneSignal
        // Sifatnya asinkron & fail-safe: jika API tidak aktif / offline, sistem lokal tetap jalan mulus
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
                // API Offline: Ditangani mandiri tanpa bug
            });
        } catch (_) {}

        return true;
    }

    // ======================================================================
    // 8. PEMINTA IZIN CEPAT & PENYIMPANAN IZIN PERSISTEN ("IZIN DIINGAT LANGSUNG")
    // ======================================================================
    async function requestPushPermissionDirectly() {
        if (!('Notification' in window)) return 'unsupported';

        try {
            let perm = Notification.permission;
            if (perm === 'default') {
                perm = await Notification.requestPermission();
            }

            // Simpan status izin langsung ke localStorage agar diingat permanen
            localStorage.setItem(STORAGE_KEY_PERM_STATE, perm);

            if (perm === 'granted') {
                // Beri tahu OneSignal
                if (window.OneSignal && OneSignal.Notifications) {
                    try {
                        await OneSignal.Notifications.requestPermission();
                    } catch (_) {}
                }

                // Kirim notifikasi sambutan langsung ke layar kunci HP
                kirimNotifikasi({
                    judul: '🔔 Notifikasi Layar Kunci Aktif!',
                    pesan: 'Kamu akan menerima info game harian, skor terbaru, dan ucapan ultah langsung di HP walau aplikasi ditutup.',
                    urlTujuan: `${PORTAL_PREFIX}/index.html`,
                    jenis: 'umum'
                });

                // Jadwalkan pengingat game harian besok pagi jam 07:00 WIB
                scheduleTomorrowMorningGamePush();
            }

            // Tutup banner izin jika ada
            const promptBox = document.getElementById('cendekia-permission-prompt');
            if (promptBox) promptBox.remove();

            return perm;
        } catch (err) {
            console.warn('[CendekiaNotifikasi] Permintaan izin error:', err);
            return 'denied';
        }
    }

    // Jadwalkan pengingat game esok hari jam 07:00 WIB via API/OneSignal
    function scheduleTomorrowMorningGamePush() {
        try {
            const now = new Date();
            // Jam 07:00 WIB = 00:00 UTC hari berikutnya
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

    // Cek dan tampilkan banner permintaan izin apik jika belum pernah diputuskan
    function checkAndPromptPermission() {
        if (!('Notification' in window)) return;

        const currentPerm = Notification.permission;
        const savedPerm = localStorage.getItem(STORAGE_KEY_PERM_STATE);

        // Jika sudah diizinkan, pastikan tersimpan permanen
        if (currentPerm === 'granted') {
            if (savedPerm !== 'granted') {
                localStorage.setItem(STORAGE_KEY_PERM_STATE, 'granted');
            }
            return;
        }

        // Jika sudah ditolak secara permanen oleh peramban, jangan spam popup
        if (currentPerm === 'denied') {
            localStorage.setItem(STORAGE_KEY_PERM_STATE, 'denied');
            return;
        }

        // Tampilkan Banner Aktivasi Notifikasi Layar Kunci
        setTimeout(() => {
            if (document.getElementById('cendekia-permission-prompt')) return;

            const prompt = document.createElement('div');
            prompt.id = 'cendekia-permission-prompt';
            prompt.className = 'cendekia-permission-box';
            prompt.innerHTML = `
                <div style="display:flex; align-items:flex-start; gap:12px;">
                    <div class="cpp-icon"><i class="fa-solid fa-mobile-screen-button"></i></div>
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
    // 9. PEMICU NOTIFIKASI OTOMATIS: GAME, ULANG TAHUN, DAN REWARD
    // ======================================================================

    // A. Notifikasi Game & Mode Bermain Terbuka
    function cekNotifikasiGameHarian() {
        const todayStr = new Date().toISOString().split('T')[0];
        const lastNotifDate = localStorage.getItem(STORAGE_KEY_LAST_GAME);

        if (lastNotifDate !== todayStr) {
            kirimNotifikasi({
                judul: '🎮 Mode Bermain Terbuka!',
                pesan: 'Mode Santai, Tantangan, dan Acak hari ini sudah siap dimainkan. Asah kosakatamu dan raih skor tertinggi!',
                urlTujuan: `${PORTAL_PREFIX}/bermain.html`,
                jenis: 'game',
                icon: 'gamepad'
            });
            localStorage.setItem(STORAGE_KEY_LAST_GAME, todayStr);
        }
    }

    // B. Notifikasi Skor Game Selesai
    function notifSkorBermain(modeName, score, xp) {
        kirimNotifikasi({
            judul: `🏆 Skor Bermain: Mode ${modeName || 'Literasi'}!`,
            pesan: `Pencapaian hebat! Skor ${score} (+${xp || 15} XP) berhasil dicatatkan. Cek posisimu di Grafik Skorku.`,
            urlTujuan: `${PORTAL_PREFIX}/grafik-skorku.html`,
            jenis: 'game_score',
            icon: 'trophy'
        });
    }

    // C. Notifikasi Ulang Tahun Siswa
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
            kirimNotifikasi({
                judul: `🎉 Selamat Ulang Tahun, ${user.name || 'Siswa'}!`,
                pesan: 'Selamat hari lahir dari keluarga besar Cendekia Aksara! Buka kejutan spesial dan hadiah literasimu sekarang.',
                urlTujuan: '/siswa/ultah.html',
                jenis: 'ultah',
                icon: 'cake-candles'
            });

            localStorage.setItem(STORAGE_KEY_LAST_ULTAH, currentYear);
        }
    }

    // D. Notifikasi Pemerolehan (XP / Lencana / Level Up)
    function notifPemerolehan({ tipe = 'lencana', nama = '', xp = 0, levelTitle = '' }) {
        if (tipe === 'lencana') {
            kirimNotifikasi({
                judul: '🏅 Lencana Baru Terbuka!',
                pesan: `Selamat! Kamu berhasil meraih Lencana "${nama}". Terus ukir karya dan prestasimu.`,
                urlTujuan: `${PORTAL_PREFIX}/profil.html`,
                jenis: 'reward',
                icon: 'medal'
            });
        } else if (tipe === 'level_up') {
            kirimNotifikasi({
                judul: '⭐ Naik Tingkat Literasi!',
                pesan: `Luar biasa! Kamu berhasil naik ke ${levelTitle || nama}. Akses materi baru kini terbuka.`,
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
                icon: 'bullseye'
            });
        }
    }

    // ======================================================================
    // 10. UI FLOATING BELL, SLIDE-IN DRAWER & STYLING
    // ======================================================================
    function injectNotificationStyles() {
        if (document.getElementById('cendekia-notif-styles')) return;

        const style = document.createElement('style');
        style.id = 'cendekia-notif-styles';
        style.textContent = `
            /* FLOATING TOAST BANNER */
            .cendekia-notif-toast {
                position: fixed;
                top: -120px;
                left: 50%;
                transform: translateX(-50%);
                width: 92%;
                max-width: 410px;
                color: white;
                border-radius: 14px;
                padding: 12px 14px;
                display: flex;
                align-items: center;
                gap: 12px;
                box-shadow: 0 10px 30px rgba(0, 31, 63, 0.35);
                z-index: 99999;
                transition: top 0.35s cubic-bezier(0.16, 1, 0.3, 1);
                cursor: pointer;
                box-sizing: border-box;
                border: 1px solid rgba(255,255,255,0.25);
            }
            .cendekia-notif-toast.active {
                top: 16px;
            }
            .cnt-icon-box {
                width: 38px;
                height: 38px;
                border-radius: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 16px;
                flex-shrink: 0;
            }
            .cnt-text-box {
                flex: 1;
                min-width: 0;
            }
            .cnt-title {
                font-size: 0.82rem;
                font-weight: 800;
                line-height: 1.25;
                margin-bottom: 2px;
            }
            .cnt-desc {
                font-size: 0.7rem;
                opacity: 0.92;
                line-height: 1.35;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                overflow: hidden;
            }
            .cnt-close-btn {
                background: transparent;
                border: none;
                color: white;
                opacity: 0.8;
                font-size: 16px;
                cursor: pointer;
                padding: 4px;
            }
            .cnt-close-btn:hover { opacity: 1; }

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
                width: 40px;
                height: 40px;
                border-radius: 12px;
                background: linear-gradient(135deg, #001f3f 0%, #003366 100%);
                color: #d4af37;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 18px;
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
                width: 44px;
                height: 44px;
                border-radius: 50%;
                background: linear-gradient(135deg, #001f3f 0%, #003366 100%);
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 4px 18px rgba(0, 31, 63, 0.3);
                border: 2px solid #d4af37;
                cursor: pointer;
                z-index: 800;
                transition: transform 0.2s;
            }
            .cendekia-floating-bell:active {
                transform: scale(0.92);
            }
            .cendekia-bell-badge {
                position: absolute;
                top: -3px;
                right: -3px;
                background: #dc2626;
                color: white;
                font-size: 0.6rem;
                font-weight: 800;
                padding: 2px 6px;
                border-radius: 10px;
                border: 2px solid white;
                display: none;
            }

            /* NOTIFICATION DRAWER / SLIDE-IN PANEL */
            .cendekia-notif-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 18, 46, 0.5);
                backdrop-filter: blur(4px);
                z-index: 99990;
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
                box-shadow: -6px 0 25px rgba(0, 0, 0, 0.2);
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
            .cnd-title {
                font-size: 0.96rem;
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
                border-radius: 12px;
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
                box-shadow: 0 4px 12px rgba(0, 51, 102, 0.05);
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
            .cnd-item-icon {
                width: 36px;
                height: 36px;
                border-radius: 8px;
                background: #e0f2fe;
                color: #0284c7;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 15px;
                flex-shrink: 0;
            }
            .cnd-item-title {
                font-size: 0.8rem;
                font-weight: 800;
                color: #0f172a;
                margin-bottom: 2px;
                padding-right: 12px;
            }
            .cnd-item-desc {
                font-size: 0.7rem;
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
                font-size: 42px;
                color: #cbd5e1;
                margin-bottom: 8px;
            }
        `;
        document.head.appendChild(style);
    }

    function injectFloatingBell() {
        if (document.getElementById('cendekia-floating-bell-btn')) return;

        // Tombol Lonceng Mengambang
        const bell = document.createElement('div');
        bell.id = 'cendekia-floating-bell-btn';
        bell.className = 'cendekia-floating-bell';
        bell.title = 'Buka Pusat Notifikasi';
        bell.innerHTML = `
            <i class="fa-solid fa-bell" style="font-size:18px;"></i>
            <span id="cendekia-bell-badge" class="cendekia-bell-badge">0</span>
        `;

        bell.addEventListener('click', toggleDrawer);
        document.body.appendChild(bell);

        // Slide-in Drawer Container
        const overlay = document.createElement('div');
        overlay.id = 'cendekia-notif-drawer-overlay';
        overlay.className = 'cendekia-notif-overlay';
        overlay.innerHTML = `
            <div class="cendekia-notif-drawer">
                <div class="cnd-header">
                    <div>
                        <h3 class="cnd-title"><i class="fa-solid fa-bell" style="color:#d4af37; margin-right:6px;"></i> Pusat Notifikasi</h3>
                        <div style="font-size:0.65rem; color:#64748b; margin-top:2px;" id="cnd-sw-status">Antena Push: Aktif</div>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <button type="button" id="cnd-btn-mark-all" style="background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; font-size:0.65rem; font-weight:800; padding:4px 8px; border-radius:6px; cursor:pointer;">
                            Baca Semua
                        </button>
                        <button type="button" id="cnd-btn-close" style="background:transparent; border:none; color:#64748b; font-size:18px; cursor:pointer; padding:4px;">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                </div>

                <!-- QUICK TEST & STATUS BAR -->
                <div style="background:#fffbeb; padding:8px 14px; border-bottom:1px solid #fef3c7; display:flex; align-items:center; justify-content:space-between;">
                    <span style="font-size:0.68rem; color:#92400e; font-weight:700;"><i class="fa-solid fa-mobile-screen"></i> Antena Layar Kunci HP</span>
                    <button type="button" id="cnd-btn-test-notif" style="background:#d97706; color:white; border:none; padding:4px 10px; border-radius:6px; font-size:0.65rem; font-weight:800; cursor:pointer;">
                        Uji Banner &amp; Getar
                    </button>
                </div>

                <div class="cnd-body" id="cnd-drawer-list">
                    <!-- List notifikasi akan dirender di sini via JS -->
                </div>

                <div style="padding:10px 14px; background:white; border-top:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
                    <button type="button" id="cnd-btn-clear" style="background:none; border:none; color:#ef4444; font-size:0.7rem; font-weight:700; cursor:pointer;">
                        <i class="fa-solid fa-trash-can"></i> Hapus Riwayat
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
            // Jika izin belum granted, pemicu izin langsung
            if (('Notification' in window) && Notification.permission !== 'granted') {
                requestPushPermissionDirectly();
                return;
            }

            kirimNotifikasi({
                judul: '🔔 Uji Coba Layar Kunci Berhasil!',
                pesan: 'Engine notifikasi mandiri, push background, getaran HP, dan audio chime bekerja prima.',
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
                    ? '<span style="color:#16a34a;"><i class="fa-solid fa-circle-check"></i> Layar Kunci &amp; Push: Aktif</span>' 
                    : '<span style="color:#d97706;"><i class="fa-solid fa-triangle-exclamation"></i> Push Layar Kunci: Belum Diizinkan</span>';
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
                    <div class="cnd-empty-icon"><i class="fa-solid fa-bell-slash"></i></div>
                    <div style="font-size:0.85rem; font-weight:800; color:#475569; margin-bottom:4px;">Belum Ada Notifikasi</div>
                    <div style="font-size:0.72rem; color:#94a3b8; max-width:240px; margin:0 auto;">Notifikasi game terbuka, capaian literasi, dan ucapan ultah akan muncul di sini.</div>
                </div>
            `;
            return;
        }

        let html = '';
        list.forEach(item => {
            let iconBox = '<i class="fa-solid fa-bell"></i>';
            let iconBg = '#e0f2fe';
            let iconColor = '#0284c7';

            if (item.jenis === 'game' || item.jenis === 'game_score') {
                iconBox = '<i class="fa-solid fa-gamepad"></i>';
                iconBg = '#ede9fe';
                iconColor = '#7c3aed';
            } else if (item.jenis === 'ultah') {
                iconBox = '<i class="fa-solid fa-cake-candles"></i>';
                iconBg = '#fef3c7';
                iconColor = '#d97706';
            } else if (item.jenis === 'reward' || item.jenis === 'lencana') {
                iconBox = '<i class="fa-solid fa-medal"></i>';
                iconBg = '#dcfce7';
                iconColor = '#16a34a';
            }

            html += `
                <div class="cnd-item-card ${item.read ? '' : 'unread'}" onclick="window.CendekiaNotifikasi.openItem('${item.id}', '${item.urlTujuan}')">
                    <div class="cnd-item-icon" style="background:${iconBg}; color:${iconColor};">${iconBox}</div>
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
    // 11. INISIALISASI UTAMA & SINKRONISASI PENGGUNA
    // ======================================================================
    async function init() {
        injectNotificationStyles();
        injectFloatingBell();
        await initServiceWorker();

        // Ambil data user dari CendekiaApp atau localStorage
        let user = null;
        if (window.CendekiaApp && typeof window.CendekiaApp.getUser === 'function') {
            user = window.CendekiaApp.getUser();
        } else {
            try {
                user = JSON.parse(localStorage.getItem('cendekia_free_user') || 'null');
            } catch (_) {}
        }

        // Inisialisasi OneSignal SDK & kaitkan akun siswa
        initOneSignal(user);

        // Sinkronisasi data siswa ke Service Worker
        if (user) {
            syncUserDataToServiceWorker(user);
            cekNotifikasiGameHarian();
            cekNotifikasiUlangTahun(user);
        }

        // Periksa izin push dan aktifkan permintaan jika belum diputuskan
        checkAndPromptPermission();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ======================================================================
    // 12. EKSPOR PUBLIK API (window.CendekiaNotifikasi)
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
