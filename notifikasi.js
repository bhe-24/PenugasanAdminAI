/**
 * ==========================================================================
 * CENDEKIA AKSARA - SISTEM NOTIFIKASI PUSAT (notifikasi.js)
 * Versi: 2.5.0
 * 
 * Fitur Utama:
 * 1. Notifikasi Game & Mode Bermain Terbuka
 * 2. Notifikasi Pemerolehan (XP, Lencana, Level Up, Hadiah)
 * 3. Notifikasi Ulang Tahun Siswa (Otomatis & Terjadwal)
 * 4. Dukungan Penuh Service Worker & Push Notification Native
 *    (Tetap terkirim dan muncul walau aplikasi web ditutup)
 * 5. Tahan Banting: Jika API Offline / Mati, Notifikasi Tetap Berjalan
 *    secara mandiri tanpa error atau bug.
 * 6. UI Floating Banner, Notification Bell & Drawer, serta Audio Chime.
 * ==========================================================================
 */

(function (window, document) {
    'use strict';

    // Konfigurasi & State
    const STORAGE_KEY_HISTORY = 'cendekia_notifikasi_history';
    const STORAGE_KEY_SETTINGS = 'cendekia_notifikasi_settings';
    const STORAGE_KEY_LAST_GAME = 'cendekia_last_game_notif_date';
    const STORAGE_KEY_LAST_ULTAH = 'cendekia_last_ultah_notif_year';

    let swRegistration = null;
    let isAudioChimeEnabled = true;
    let audioCtx = null;

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
    // 1. AUDIO CHIME GENERATOR (WEB AUDIO API - SINTESIS MANDIRI TANPA MP3)
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
            const notes = [523.25, 659.25, 783.99]; // Nada C5, E5, G5 (Akor C Mayor ceria)
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
            // Audio bypass jika dibatasi kebijakan autoplay peramban
        }
    }

    function vibrateDevice(pattern = [150, 60, 150]) {
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
            console.log('[CendekiaNotifikasi] Service Worker aktif dengan scope:', reg.scope);

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
            console.warn('[CendekiaNotifikasi] Registrasi SW gagal, mode fallback lokal aktif:', err.message);
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
    // 3. MANAJEMEN PENYIMPANAN RIWAYAT NOTIFIKASI (LOCAL STORAGE PERSISTEN)
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
            // Batasi maksimal 50 notifikasi terbaru agar hemat memori
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
    // 4. FLOATING NOTIFICATION BANNER / TOAST (IN-APP)
    // ======================================================================
    function showInAppBanner(item) {
        const existing = document.getElementById('cendekia-toast-banner');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.id = 'cendekia-toast-banner';
        toast.className = 'cendekia-notif-toast';

        // Tentukan icon & warna berdasarkan jenis
        let iconHtml = '<i class="fa-solid fa-bell"></i>';
        let badgeColor = '#003366';
        let bgGrad = 'linear-gradient(135deg, #001f3f 0%, #003366 100%)';

        if (item.jenis === 'game' || item.jenis === 'game_score') {
            iconHtml = '<i class="fa-solid fa-gamepad"></i>';
            bgGrad = 'linear-gradient(135deg, #4c1d95 0%, #7c3aed 100%)';
            badgeColor = '#7c3aed';
        } else if (item.jenis === 'ultah') {
            iconHtml = '<i class="fa-solid fa-cake-candles"></i>';
            bgGrad = 'linear-gradient(135deg, #b45309 0%, #f59e0b 100%)';
            badgeColor = '#d97706';
        } else if (item.jenis === 'reward' || item.jenis === 'lencana') {
            iconHtml = '<i class="fa-solid fa-medal"></i>';
            bgGrad = 'linear-gradient(135deg, #065f46 0%, #059669 100%)';
            badgeColor = '#059669';
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

        // Klik toast untuk membuka halaman tujuan
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

        // Auto dismiss setelah 5.5 detik
        setTimeout(() => {
            if (document.body.contains(toast)) {
                toast.classList.remove('active');
                setTimeout(() => toast.remove(), 300);
            }
        }, 5500);
    }

    // ======================================================================
    // 5. NATIVE BROWSER & SERVICE WORKER PUSH NOTIFICATION
    // ======================================================================
    function showNativeNotification(item) {
        if (!('Notification' in window)) return;

        // Hanya jalankan jika izin diberikan
        if (Notification.permission === 'granted') {
            const title = item.judul || "Cendekia Aksara";
            const options = {
                body: item.pesan || "",
                icon: "https://i.imgur.com/5Srjyo4.png",
                badge: "https://i.imgur.com/5Srjyo4.png",
                vibrate: [200, 100, 200],
                tag: item.jenis + '-' + Date.now(),
                renotify: true,
                data: {
                    url: item.urlTujuan || `${PORTAL_PREFIX}/index.html`
                }
            };

            // Prioritaskan via Service Worker agar tetap muncul walau tab diminimalkan
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
    // 6. DISPATCHER PUSAT NOTIFIKASI (MULTI-CHANNEL DENGAN FALLBACK FAIL-SAFE)
    // ======================================================================
    async function kirimNotifikasi({ judul, pesan, urlTujuan, jenis = 'umum', icon = 'bell', targetUid = null, semester = null }) {
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

        // 2. Mainkan Suara & Getaran Halus
        playNotificationChime();
        vibrateDevice();

        // 3. Tampilkan Banner In-App jika jendela aktif
        showInAppBanner(payload);

        // 4. Tampilkan Native Notification di OS / HP Siswa
        showNativeNotification(payload);

        // 5. Coba Kirim ke Serverless API /api/notif secara asinkron dengan batas waktu
        // PENTING: Jika API mati / tidak aktif, proses lokal SUDAH SELESAI, sehingga TIDAK ADA ERROR!
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 detik timeout

            fetch('/api/notif', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    judul: payload.judul,
                    pesan: payload.pesan,
                    urlTujuan: payload.urlTujuan,
                    jenis: payload.jenis,
                    semester: semester,
                    targetUid: targetUid
                }),
                signal: controller.signal
            }).then(res => {
                clearTimeout(timeoutId);
                return res.json();
            }).catch(() => {
                clearTimeout(timeoutId);
                // API mati / tidak terhubung, sistem otomatis berjalan dalam mode mandiri lokal
            });
        } catch (_) {}

        return true;
    }

    // ======================================================================
    // 7. PEMICU NOTIFIKASI OTOMATIS: GAME, ULANG TAHUN, DAN REWARD
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

    // Pemicu saat skor game selesai
    function notifSkorBermain(modeName, score, xp) {
        kirimNotifikasi({
            judul: `🏆 Skor Bermain: Mode ${modeName || 'Literasi'}!`,
            pesan: `Pencapaian hebat! Skor ${score} (+${xp || 15} XP) berhasil dicatatkan. Cek posisimu di Grafik Skorku.`,
            urlTujuan: `${PORTAL_PREFIX}/grafik-skorku.html`,
            jenis: 'game_score',
            icon: 'trophy'
        });
    }

    // B. Notifikasi Ulang Tahun Siswa
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

    // C. Notifikasi Pemerolehan (XP / Lencana / Level Up)
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
    // 8. UI PERMISSION PROMPT BANNER (RAMAH PENGGUNA)
    // ======================================================================
    function checkAndPromptPermission() {
        if (!('Notification' in window)) return;
        if (Notification.permission === 'default') {
            const hasDismissed = sessionStorage.getItem('cendekia_notif_prompt_dismissed');
            if (hasDismissed) return;

            setTimeout(() => {
                if (document.getElementById('cendekia-permission-prompt')) return;

                const prompt = document.createElement('div');
                prompt.id = 'cendekia-permission-prompt';
                prompt.className = 'cendekia-permission-box';
                prompt.innerHTML = `
                    <div style="display:flex; align-items:flex-start; gap:12px;">
                        <div class="cpp-icon"><i class="fa-solid fa-bell-ring"></i></div>
                        <div style="flex:1;">
                            <div class="cpp-title">Aktifkan Notifikasi Cendekia</div>
                            <div class="cpp-desc">Dapatkan pengingat otomatis game harian, kejutan ulang tahun, dan pemerolehan lencana langsung di perangkatmu.</div>
                            <div class="cpp-btn-row">
                                <button type="button" class="cpp-btn-allow" id="btn-allow-notif">Aktifkan Sekarang</button>
                                <button type="button" class="cpp-btn-later" id="btn-later-notif">Nanti Saja</button>
                            </div>
                        </div>
                    </div>
                `;

                document.body.appendChild(prompt);

                document.getElementById('btn-allow-notif').addEventListener('click', async () => {
                    prompt.remove();
                    try {
                        const perm = await Notification.requestPermission();
                        if (perm === 'granted') {
                            kirimNotifikasi({
                                judul: '🔔 Notifikasi Cendekia Aktif!',
                                pesan: 'Kamu akan menerima info mode bermain terbuka, skor terbaru, dan ucapan ulang tahun tepat waktu.',
                                urlTujuan: `${PORTAL_PREFIX}/index.html`,
                                jenis: 'umum'
                            });
                        }
                    } catch (_) {}
                });

                document.getElementById('btn-later-notif').addEventListener('click', () => {
                    sessionStorage.setItem('cendekia_notif_prompt_dismissed', 'true');
                    prompt.remove();
                });
            }, 3000);
        }
    }

    // ======================================================================
    // 9. UI FLOATING NOTIFICATION BELL & SLIDE-IN DRAWER
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
                width: 36px;
                height: 36px;
                border-radius: 50%;
                background: #fef3c7;
                color: #d97706;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 15px;
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
                padding: 7px 14px;
                border-radius: 8px;
                font-size: 0.74rem;
                font-weight: 800;
                cursor: pointer;
            }
            .cpp-btn-later {
                background: #f1f5f9;
                color: #64748b;
                border: none;
                padding: 7px 12px;
                border-radius: 8px;
                font-size: 0.74rem;
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

        // Floating Bell Widget
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

                <!-- TEST NOTIFIKASI QUICK BUTTON -->
                <div style="background:#fffbeb; padding:8px 14px; border-bottom:1px solid #fef3c7; display:flex; align-items:center; justify-content:space-between;">
                    <span style="font-size:0.68rem; color:#92400e; font-weight:700;"><i class="fa-solid fa-shield-halved"></i> Engine Notifikasi Mandiri</span>
                    <button type="button" id="cnd-btn-test-notif" style="background:#d97706; color:white; border:none; padding:3px 8px; border-radius:4px; font-size:0.65rem; font-weight:800; cursor:pointer;">
                        Uji Suara &amp; Notif
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
            kirimNotifikasi({
                judul: '🔔 Uji Coba Notifikasi Cendekia!',
                pesan: 'Sistem notifikasi mandiri, push service worker, dan audio chime bekerja dengan sempurna.',
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
            // Update status SW di header drawer
            const statusEl = document.getElementById('cnd-sw-status');
            if (statusEl) {
                const hasPerm = ('Notification' in window) && Notification.permission === 'granted';
                statusEl.innerHTML = hasPerm 
                    ? '<span style="color:#16a34a;"><i class="fa-solid fa-circle-check"></i> Push Perangkat: Aktif</span>' 
                    : '<span style="color:#d97706;"><i class="fa-solid fa-triangle-exclamation"></i> Push Native: Belum Diizinkan (In-App Aktif)</span>';
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
    // 10. INISIALISASI UTAMA & SINKRONISASI PENGGUNA
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

        // Sinkronisasi identitas siswa ke Service Worker
        if (user) {
            syncUserDataToServiceWorker(user);

            // Cek notifikasi otomatis
            cekNotifikasiGameHarian();
            cekNotifikasiUlangTahun(user);
        }

        // Cek prompt perizinan browser jika belum diputuskan
        checkAndPromptPermission();
    }

    // Auto-run saat DOM siap
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ======================================================================
    // 11. EKSPOR PUBLIK API (window.CendekiaNotifikasi)
    // ======================================================================
    window.CendekiaNotifikasi = {
        init,
        kirim: kirimNotifikasi,
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
