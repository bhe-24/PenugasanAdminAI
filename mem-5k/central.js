/**
 * ==========================================================================
 * Cendekia Aksara - Member Free Central Engine (central.js)
 * Konfigurasi Global, Gamifikasi (XP/Level/Streak), Lucide Icon Loader,
 * Arsip Karya & Ide, Tantangan Harian, dan Telaah Kurasi Sistem Cendekia.
 * ==========================================================================
 */

const CendekiaApp = (function () {
    const IS_MEM_5K = typeof window !== 'undefined' && window.location && window.location.pathname.startsWith('/mem-5k');
    const PORTAL_PREFIX = IS_MEM_5K ? '/mem-5k' : '/mem-free';
    const MEMBERSHIP_DURATION_DAYS = 40;

    const STORAGE_KEY_USER = 'cendekia_free_user';
    const STORAGE_KEY_WORKS = 'cendekia_free_works';
    const STORAGE_KEY_IDEAS = 'cendekia_free_ideas';
    const STORAGE_KEY_CHALLENGES = 'cendekia_free_challenges';
    const STORAGE_KEY_HISTORY = 'cendekia_free_history';
    const STORAGE_KEY_DAILY_POOL = 'cendekia_free_daily_pool';
    const STORAGE_KEY_TRANSACTIONS = 'cendekia_user_transactions';

    // LEVEL DEFINITIONS
    const LEVELS = [
        { level: 1, title: 'Penulis Pemula 🌱', minXp: 0, maxXp: 100 },
        { level: 2, title: 'Pena Muda ✍️', minXp: 100, maxXp: 250 },
        { level: 3, title: 'Penjelajah Aksara 📖', minXp: 250, maxXp: 500 },
        { level: 4, title: 'Pujangga Berbakat 🌟', minXp: 500, maxXp: 1000 },
        { level: 5, title: 'Mahaguru Literasi 👑', minXp: 1000, maxXp: 2500 }
    ];

    // DEFAULT USER (Bersih tanpa data dummy)
    const defaultUser = {
        uid: 'guest_' + Math.random().toString(36).substring(2, 9),
        name: 'Siswa Cendekia',
        username: 'cendekia_muda',
        email: '',
        role: 'siswa',
        semester: 1,
        tier: 'Member Free',
        photoURL: '',
        noHp: '',
        tanggalLahir: '',
        alamat: '',
        bioSingkat: '',
        xp: 0,
        level: 1,
        levelTitle: 'Penulis Pemula 🌱',
        streak: 1,
        lastActiveDate: new Date().toISOString().split('T')[0],
        privacyRank: true, // true: tampil nama asli, false: anonim
        badges: [],
        stats: {
            quizCompleted: 0,
            gamesCompleted: 0,
            materialsLearned: 0,
            worksCreated: 0,
            ideasArchived: 0
        }
    };

    // 6 LENCANA RESMI CENDEKIA AKSARA DENGAN SYARAT AKTUAL
    const BADGE_CATALOG = {
        'badge_first_step': {
            id: 'badge_first_step',
            name: 'Langkah Awal',
            icon: 'footprints',
            desc: 'Selesaikan aktivitas belajar pertama di portal Member Free.',
            target: 1,
            unit: 'Aktivitas',
            check: (user) => {
                const total = (user.stats?.materialsLearned || 0) + 
                              (user.stats?.gamesCompleted || 0) + 
                              (user.stats?.quizCompleted || 0) + 
                              (user.stats?.worksCreated || 0) + 
                              (user.stats?.ideasArchived || 0) + 
                              (user.xp > 0 ? 1 : 0);
                return total >= 1;
            },
            progress: (user) => {
                const total = (user.stats?.materialsLearned || 0) + 
                              (user.stats?.gamesCompleted || 0) + 
                              (user.stats?.quizCompleted || 0) + 
                              (user.stats?.worksCreated || 0) + 
                              (user.stats?.ideasArchived || 0) + 
                              (user.xp > 0 ? 1 : 0);
                return Math.min(1, total);
            }
        },
        'badge_reading_lover': {
            id: 'badge_reading_lover',
            name: 'Pembaca Buku',
            icon: 'book-open',
            desc: 'Membaca minimal 3 modul pembelajaran di Ruang Belajar.',
            target: 3,
            unit: 'Modul',
            check: (user) => (user.stats?.materialsLearned || 0) >= 3,
            progress: (user) => Math.min(3, user.stats?.materialsLearned || 0)
        },
        'badge_word_master': {
            id: 'badge_word_master',
            name: 'Pengrajin Kata',
            icon: 'pen-tool',
            desc: 'Menulis dan menyimpan minimal 1 karya naskah sastra pertamamu.',
            target: 1,
            unit: 'Karya',
            check: (user) => (user.stats?.worksCreated || 0) >= 1,
            progress: (user) => Math.min(1, user.stats?.worksCreated || 0)
        },
        'badge_quiz_champ': {
            id: 'badge_quiz_champ',
            name: 'Juara Kuis',
            icon: 'trophy',
            desc: 'Menyelesaikan minimal 3 ronde permainan atau latihan literasi.',
            target: 3,
            unit: 'Permainan',
            check: (user) => ((user.stats?.gamesCompleted || 0) + (user.stats?.quizCompleted || 0)) >= 3,
            progress: (user) => Math.min(3, (user.stats?.gamesCompleted || 0) + (user.stats?.quizCompleted || 0))
        },
        'badge_streak_3': {
            id: 'badge_streak_3',
            name: 'Api Konsisten',
            icon: 'flame',
            desc: 'Mempertahankan streak belajar minimal 3 hari berturut-turut.',
            target: 3,
            unit: 'Hari',
            check: (user) => (user.streak || 0) >= 3,
            progress: (user) => Math.min(3, user.streak || 0)
        },
        'badge_idea_spark': {
            id: 'badge_idea_spark',
            name: 'Pemantik Kreatif',
            icon: 'sparkles',
            desc: 'Menyimpan minimal 3 ide atau eksplorasi cerita di Ruang Kreasi.',
            target: 3,
            unit: 'Ide',
            check: (user) => (user.stats?.ideasArchived || 0) >= 3,
            progress: (user) => Math.min(3, user.stats?.ideasArchived || 0)
        }
    };

    // 1. GET & SYNC USER DATA (Terintegrasi penuh dengan data dashboard & profil luar)
    function getUser() {
        let user = null;
        try {
            const stored = localStorage.getItem(STORAGE_KEY_USER);
            if (stored) {
                user = JSON.parse(stored);
            }
        } catch (e) {}

        if (!user) {
            user = { ...defaultUser };
        }

        // Sinkronkan selalu data profil dari sumber login utama, dashboard/profil luar (cendekia_user, user_photo, dll)
        try {
            const legacy = localStorage.getItem('cendekia_user');
            if (legacy) {
                const l = JSON.parse(legacy);
                if (l.name) user.name = l.name;
                if (l.email) user.email = l.email;
                if (l.uid && (!user.uid || user.uid.startsWith('guest_'))) user.uid = l.uid;

                // Ambil foto profil dari properti apapun yang tersimpan di sistem luar
                const externalPhoto = l.photoURL || l.photo || l.foto || l.profilePic || l.avatar;
                if (externalPhoto) {
                    user.photoURL = externalPhoto;
                    user.photo = externalPhoto;
                }

                if (l.semester) user.semester = parseInt(l.semester) || user.semester || 1;
                if (l.noHp || l.phone || l.whatsapp) user.noHp = l.noHp || l.phone || l.whatsapp;
                if (l.tanggalLahir || l.dob) user.tanggalLahir = l.tanggalLahir || l.dob;
                if (l.alamat || l.address) user.alamat = l.alamat || l.address;
                if (l.bioSingkat || l.bio) user.bioSingkat = l.bioSingkat || l.bio;
                if (l.nis || l.nomorInduk || l.idSiswa) user.nis = l.nis || l.nomorInduk || l.idSiswa;
                if (l.ips !== undefined) user.ips = l.ips;
                if (typeof l.xp === 'number' && l.xp > (user.xp || 0)) user.xp = l.xp;
                if (l.tier) user.tier = l.tier;
                if (l.packageId) user.packageId = l.packageId;
                if (l.packageName) user.packageName = l.packageName;
                if (l.membershipStartedAt !== undefined) user.membershipStartedAt = l.membershipStartedAt;
                if (l.membershipExpiresAt !== undefined) user.membershipExpiresAt = l.membershipExpiresAt;
            }

            // Fallback pembacaan foto mandiri dari localStorage
            const standalonePhoto = localStorage.getItem('user_photo') || localStorage.getItem('profile_photo');
            if (standalonePhoto) {
                user.photoURL = standalonePhoto;
                user.photo = standalonePhoto;
            }

            // Fallback nama & semester mandiri dari localStorage
            const standaloneName = localStorage.getItem('user_name');
            if (standaloneName && (!user.name || user.name === 'Siswa Cendekia')) user.name = standaloneName;
            const standaloneSem = localStorage.getItem('user_semester');
            if (standaloneSem) user.semester = parseInt(standaloneSem) || user.semester || 1;
            const standalonePkg = localStorage.getItem('user_package');
            if (standalonePkg && !user.packageId) user.packageId = standalonePkg;

            // Pastikan label tier konsisten di portal mem-5k jika packageId 5k
            if ((user.packageId === '5k' || IS_MEM_5K) && (!user.tier || user.tier === 'Member Free') && user.packageId !== 'free') {
                user.tier = 'Member 5K';
                user.packageId = '5k';
            }

        } catch (e) {}

        // Pastikan properti photo dan photoURL selalu berpasangan
        if (user.photoURL && !user.photo) user.photo = user.photoURL;
        if (user.photo && !user.photoURL) user.photoURL = user.photo;

        // Hitung streak otomatis berbasis kalender WIB
        checkStreak(user);

        // Selaraskan Level & Title dengan XP aktual secara presisi
        const currentXp = user.xp || 0;
        user.level = 1;
        user.levelTitle = LEVELS[0].title;
        for (let i = LEVELS.length - 1; i >= 0; i--) {
            if (currentXp >= LEVELS[i].minXp) {
                user.level = LEVELS[i].level;
                user.levelTitle = LEVELS[i].title;
                break;
            }
        }

        return user;
    }

    let _cloudSyncTimer = null;
    function scheduleCloudMemorySync() {
        if (_cloudSyncTimer) clearTimeout(_cloudSyncTimer);
        _cloudSyncTimer = setTimeout(() => {
            syncMemoryToFirestore().catch(() => {});
        }, 900);
    }

    async function syncMemoryToFirestore() {
        try {
            const fb = await getFirebaseBridge();
            if (!fb || !fb.auth || !fb.auth.currentUser) return;
            const uid = fb.auth.currentUser.uid;
            const user = getUser();
            const todayKey = getTodayDateKeyWIB();

            // 1. Update ringkasan progres & streak pada dokumen utama users/{uid}
            await fb.setDoc(fb.doc(fb.db, "users", uid), {
                xp: user.xp || 0,
                level: user.level || 1,
                levelTitle: user.levelTitle || LEVELS[0].title,
                streak: user.streak || 1,
                streakStatus: user.streakStatus || 'active',
                lastActiveDate: user.lastActiveDate || todayKey,
                lastVisitDate: user.lastVisitDate || user.lastActiveDate || todayKey,
                visitDates: Array.isArray(user.visitDates) ? user.visitDates.slice(-60) : [todayKey],
                badges: Array.isArray(user.badges) ? user.badges : [],
                stats: user.stats || {},
                lastActive: new Date().toISOString()
            }, { merge: true });

            // 2. Simpan memori lengkap (riwayat aktivitas, karya, ide, tantangan hari ini, hasil game hari ini)
            let completedToday = {};
            try {
                completedToday = JSON.parse(localStorage.getItem('cendekia_completed_challenges_' + todayKey) || '{}');
            } catch (e) {}

            let readToday = null;
            try {
                readToday = JSON.parse(localStorage.getItem('cendekia_read_today_' + todayKey) || 'null');
            } catch (e) {}

            const allGameKeys = ['kuis_pintar', 'tebak_kata', 'susun_kata', 'teka_teki', 'tebak_sastra', 'sambung_cerita', 'perbaiki_kalimat', 'tantangan_cepat'];
            const todayResults = {};
            allGameKeys.forEach(gk => {
                const r = getGameResult(gk);
                if (r) todayResults[gk] = r;
            });

            await fb.setDoc(fb.doc(fb.db, "mem_user_memory", uid), {
                uid,
                email: user.email || fb.auth.currentUser.email || '',
                history: getHistory().slice(0, 40),
                works: getWorks().slice(0, 50),
                ideas: getIdeas().slice(0, 50),
                todayDateKey: todayKey,
                completedChallengesToday: completedToday,
                readToday: readToday,
                gameResultsToday: todayResults,
                updatedAt: new Date().toISOString()
            }, { merge: true });
        } catch (err) {
            console.warn('[Cendekia Central] Cloud memory sync warn:', err);
        }
    }

    function saveUser(user, skipCloudSync = false) {
        try {
            // Pastikan properti photo dan photoURL sinkron
            if (user.photoURL && !user.photo) user.photo = user.photoURL;
            if (user.photo && !user.photoURL) user.photoURL = user.photo;

            localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));

            // Sinkronkan juga ke sesi dashboard & profil luar
            if (user.semester) localStorage.setItem('user_semester', user.semester);
            if (user.name) localStorage.setItem('user_name', user.name);
            if (user.photoURL) localStorage.setItem('user_photo', user.photoURL);
            if (user.packageId) localStorage.setItem('user_package', user.packageId);

            try {
                const legacy = localStorage.getItem('cendekia_user');
                const legObj = legacy ? JSON.parse(legacy) : {};
                if (user.name) legObj.name = user.name;
                if (user.email) legObj.email = user.email;
                if (user.photoURL) {
                    legObj.photoURL = user.photoURL;
                    legObj.photo = user.photoURL;
                }
                if (user.semester) legObj.semester = user.semester;
                if (user.noHp) legObj.noHp = user.noHp;
                if (user.tanggalLahir) legObj.tanggalLahir = user.tanggalLahir;
                if (user.alamat) legObj.alamat = user.alamat;
                if (user.bioSingkat) legObj.bioSingkat = user.bioSingkat;
                if (user.tier) legObj.tier = user.tier;
                if (user.packageId) legObj.packageId = user.packageId;
                if (user.packageName) legObj.packageName = user.packageName;
                if (user.membershipStartedAt !== undefined) legObj.membershipStartedAt = user.membershipStartedAt;
                if (user.membershipExpiresAt !== undefined) legObj.membershipExpiresAt = user.membershipExpiresAt;
                if (typeof user.xp === 'number') legObj.xp = user.xp;
                if (typeof user.streak === 'number') legObj.streak = user.streak;
                localStorage.setItem('cendekia_user', JSON.stringify(legObj));
            } catch(e) {}

            if (!skipCloudSync) {
                scheduleCloudMemorySync();
            }
        } catch (e) {}
    }

    // 2. STREAK API ENGINE BERTINGKAT (BERBASIS KALENDER REALTIME WIB)
    // - Masuk hari berturut-turut (diff=1): Api menyala & hari +1
    // - Tidak berkunjung 1 hari (diff=2): Api sempat mati/redup, saat masuk dinyalakan kembali tanpa hangus
    // - Tidak berkunjung 2 hari penuh (diff>=3): Api padam total & mulai lagi dari 1 hari
    function parseYMDToUTC(ymd) {
        if (!ymd || typeof ymd !== 'string') return NaN;
        const parts = ymd.split('-').map(Number);
        if (parts.length !== 3 || parts.some(isNaN)) return NaN;
        return Date.UTC(parts[0], parts[1] - 1, parts[2]);
    }

    function getStreakFlameInfo(streak = 1, status = 'active') {
        const count = Math.max(1, parseInt(streak) || 1);
        const st = (status || 'active').toLowerCase();

        if (st === 'dead' || st === 'extinguished') {
            return {
                tierLevel: 0,
                tierName: 'Api Padam',
                emoji: '🕯️',
                flameColor: '#94a3b8',
                textColor: '#cbd5e1',
                bgStyle: 'rgba(148, 163, 184, 0.18)',
                borderStyle: 'rgba(148, 163, 184, 0.5)',
                glowStyle: 'none',
                statusLabel: 'Padam (Mulai Lagi)',
                isLit: false
            };
        }

        if (count >= 30) {
            return {
                tierLevel: 5,
                tierName: 'Api Abadi Legendaris',
                emoji: '👑🔥',
                flameColor: '#fde047',
                textColor: '#fef08a',
                bgStyle: 'linear-gradient(135deg, rgba(124, 58, 237, 0.85), rgba(212, 175, 55, 0.85))',
                borderStyle: '#fde047',
                glowStyle: '0 0 14px rgba(212, 175, 55, 0.65)',
                statusLabel: 'Menyala Abadi',
                isLit: true
            };
        }
        if (count >= 14) {
            return {
                tierLevel: 4,
                tierName: 'Api Biru Cendekia',
                emoji: '💙🔥',
                flameColor: '#38bdf8',
                textColor: '#e0f2fe',
                bgStyle: 'linear-gradient(135deg, rgba(2, 132, 199, 0.85), rgba(14, 165, 233, 0.7))',
                borderStyle: '#7dd3fc',
                glowStyle: '0 0 12px rgba(56, 189, 248, 0.55)',
                statusLabel: 'Menyala Biru',
                isLit: true
            };
        }
        if (count >= 7) {
            return {
                tierLevel: 3,
                tierName: 'Api Membara',
                emoji: '🔥',
                flameColor: '#fb923c',
                textColor: '#ffedd5',
                bgStyle: 'linear-gradient(135deg, rgba(220, 38, 38, 0.82), rgba(234, 88, 12, 0.78))',
                borderStyle: '#fdba74',
                glowStyle: '0 0 12px rgba(239, 68, 68, 0.5)',
                statusLabel: 'Membara Hebat',
                isLit: true
            };
        }
        if (count >= 3) {
            return {
                tierLevel: 2,
                tierName: 'Api Menyala',
                emoji: '🔥',
                flameColor: '#f97316',
                textColor: '#fef3c7',
                bgStyle: 'linear-gradient(135deg, rgba(234, 88, 12, 0.7), rgba(245, 158, 11, 0.6))',
                borderStyle: '#fbbf24',
                glowStyle: '0 0 10px rgba(249, 115, 22, 0.45)',
                statusLabel: 'Menyala Terang',
                isLit: true
            };
        }

        return {
            tierLevel: 1,
            tierName: st === 'reset' ? 'Api Baru Dimulai' : (st === 'rekindled' ? 'Api Dinyalakan Kembali' : 'Percikan Awal'),
            emoji: '🔥',
            flameColor: '#fbbf24',
            textColor: '#fef08a',
            bgStyle: 'rgba(245, 158, 11, 0.24)',
            borderStyle: 'rgba(251, 191, 36, 0.75)',
            glowStyle: '0 0 8px rgba(245, 158, 11, 0.35)',
            statusLabel: st === 'rekindled' ? 'Menyala Kembali' : 'Menyala',
            isLit: true
        };
    }

    let _streakToastShownKey = null;
    function checkStreak(user) {
        const today = getTodayDateKeyWIB ? getTodayDateKeyWIB() : new Date().toISOString().split('T')[0];
        if (!Array.isArray(user.visitDates)) user.visitDates = [];

        const lastRecorded = user.lastVisitDate || user.lastActiveDate;
        if (!lastRecorded) {
            user.lastVisitDate = today;
            user.lastActiveDate = today;
            user.streak = Math.max(1, parseInt(user.streak) || 1);
            user.streakStatus = 'active';
            if (!user.visitDates.includes(today)) user.visitDates.push(today);
            saveUser(user);
            return;
        }

        if (lastRecorded !== today) {
            const lastMs = parseYMDToUTC(lastRecorded);
            const nowMs = parseYMDToUTC(today);
            const diffDays = (!isNaN(lastMs) && !isNaN(nowMs))
                ? Math.round((nowMs - lastMs) / (1000 * 60 * 60 * 24))
                : 0;

            if (diffDays === 1) {
                // Berkunjung lagi keesokan harinya -> api menyala & bertambah +1 hari
                user.streak = (parseInt(user.streak) || 1) + 1;
                user.streakStatus = 'active';
                if (_streakToastShownKey !== today && typeof document !== 'undefined') {
                    _streakToastShownKey = today;
                    setTimeout(() => showEncouragementToast(`Api menyala! Kunjungan beruntun ${user.streak} Hari 🔥`), 700);
                }
            } else if (diffDays === 2) {
                // Tidak berkunjung 1 hari penuh -> api sempat mati sementara, dinyalakan kembali saat masuk hari ini
                user.streak = Math.max(1, parseInt(user.streak) || 1);
                user.streakStatus = 'rekindled';
                if (_streakToastShownKey !== today && typeof document !== 'undefined') {
                    _streakToastShownKey = today;
                    setTimeout(() => showEncouragementToast(`Api sempat mati 1 hari, berhasil dinyalakan lagi (${user.streak} Hari)! 🔥`), 700);
                }
            } else if (diffDays >= 3) {
                // 2 hari penuh atau lebih tidak berkunjung -> api padam total & mulai lagi dari 1
                user.previousStreak = user.streak || 1;
                user.streak = 1;
                user.streakStatus = 'reset';
                if (_streakToastShownKey !== today && typeof document !== 'undefined') {
                    _streakToastShownKey = today;
                    setTimeout(() => showEncouragementToast(`Api padam karena 2 hari tidak berkunjung. Mulai nyalakan lagi dari Hari ke-1! 🔥`), 700);
                }
            }

            user.lastVisitDate = today;
            user.lastActiveDate = today;
            if (!user.visitDates.includes(today)) {
                user.visitDates.push(today);
                if (user.visitDates.length > 60) user.visitDates = user.visitDates.slice(-60);
            }
            saveUser(user);
        } else {
            if (!user.streak || user.streak < 1) user.streak = 1;
            if (!user.streakStatus) user.streakStatus = 'active';
            if (!user.visitDates.includes(today)) {
                user.visitDates.push(today);
                saveUser(user, true);
            }
        }
    }

    function showStreakInfoModal() {
        const existing = document.getElementById('cendekiaStreakInfoModal');
        if (existing) existing.remove();
        const user = getUser();
        const info = getStreakFlameInfo(user.streak, user.streakStatus);

        const overlay = document.createElement('div');
        overlay.id = 'cendekiaStreakInfoModal';
        overlay.className = 'app-modal-overlay';
        overlay.style.display = 'flex';
        overlay.style.zIndex = '9999';
        overlay.innerHTML = `
            <div class="app-modal-card" style="text-align:left; max-width:360px;">
                <div style="text-align:center; margin-bottom:12px;">
                    <div style="width:62px; height:62px; border-radius:50%; background:${info.bgStyle}; border:2px solid ${info.borderStyle}; box-shadow:${info.glowStyle}; color:${info.flameColor}; display:flex; align-items:center; justify-content:center; margin:0 auto 10px; font-size:1.6rem;">
                        <i data-lucide="flame" style="width:32px; height:32px; color:${info.flameColor};"></i>
                    </div>
                    <span style="font-size:0.65rem; font-weight:800; color:#b45309; background:#fef3c7; padding:3px 10px; border-radius:99px; text-transform:uppercase;">
                        Tingkat ${info.tierLevel} &bull; ${info.tierName}
                    </span>
                    <h3 style="font-size:1.25rem; font-weight:800; color:var(--primary); margin:8px 0 2px;">${user.streak || 1} Hari Berturut-turut</h3>
                    <div style="font-size:0.72rem; color:#059669; font-weight:700;">Status Hari Ini: ${info.statusLabel} ✓</div>
                </div>

                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:10px 12px; font-size:0.72rem; color:#334155; line-height:1.55; margin-bottom:12px;">
                    <strong style="color:var(--primary); display:block; margin-bottom:4px;">Aturan Nyala Api Keaktifan:</strong>
                    • <b>Masuk tiap hari:</b> Api menyala &amp; hari bertambah <b>+1</b>.<br>
                    • <b>Absen 1 hari:</b> Api sempat mati sementara (segera masuk untuk menyalakannya lagi).<br>
                    • <b>2 hari tidak berkunjung:</b> Api <b>padam total</b> &amp; hitungan mulai lagi dari <b>1 Hari</b>.
                </div>

                <div style="font-size:0.68rem; color:#475569; margin-bottom:14px;">
                    <strong style="color:var(--primary); display:block; margin-bottom:5px;">Tingkatan Api:</strong>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:5px;">
                        <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:6px; padding:4px 7px;"><b>1–2 Hr:</b> Percikan Awal</div>
                        <div style="background:#fff7ed; border:1px solid #fdba74; border-radius:6px; padding:4px 7px;"><b>3–6 Hr:</b> Api Menyala</div>
                        <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:6px; padding:4px 7px;"><b>7–13 Hr:</b> Api Membara</div>
                        <div style="background:#f0f9ff; border:1px solid #bae6fd; border-radius:6px; padding:4px 7px;"><b>14–29 Hr:</b> Api Biru</div>
                    </div>
                    <div style="background:#f5f3ff; border:1px solid #ddd6fe; border-radius:6px; padding:4px 7px; margin-top:5px; text-align:center;">
                        <b>30+ Hari:</b> 👑 Api Abadi Legendaris
                    </div>
                </div>

                <button type="button" class="btn-modal-primary" style="background:var(--primary); width:100%;" onclick="document.getElementById('cendekiaStreakInfoModal').remove()">
                    Siap Jaga Api Setiap Hari!
                </button>
            </div>
        `;
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
        document.body.appendChild(overlay);
        if (window.lucide) lucide.createIcons();
    }

    // 3. GAMIFIKASI: XP, LEVEL UP & TOAST
    function addXP(points, reason = 'Aktivitas Belajar') {
        const user = getUser();
        user.xp = (user.xp || 0) + points;

        if (!user.stats) {
            user.stats = { quizCompleted: 0, gamesCompleted: 0, materialsLearned: 0, worksCreated: 0, ideasArchived: 0 };
        }

        // Auto-increment statistik aktivitas berbasis alasan
        const rLower = (reason || '').toLowerCase();
        if (rLower.includes('bacaan') || rLower.includes('membaca') || rLower.includes('modul')) {
            user.stats.materialsLearned = (user.stats.materialsLearned || 0) + 1;
        } else if (rLower.includes('kuis') || rLower.includes('tebak') || rLower.includes('susun') || rLower.includes('teka-teki') || rLower.includes('perbaikan') || rLower.includes('sambung') || rLower.includes('tantangan') || rLower.includes('game') || rLower.includes('permainan')) {
            user.stats.gamesCompleted = (user.stats.gamesCompleted || 0) + 1;
        } else if (rLower.includes('karya') || rLower.includes('menulis') || rLower.includes('naskah')) {
            user.stats.worksCreated = Math.max(user.stats.worksCreated || 0, getWorks().length || 1);
        } else if (rLower.includes('ide')) {
            user.stats.ideasArchived = Math.max(user.stats.ideasArchived || 0, getIdeas().length || 1);
        }

        // Cek Level
        let newLevel = user.level || 1;
        let newTitle = user.levelTitle || LEVELS[0].title;

        for (let i = LEVELS.length - 1; i >= 0; i--) {
            if (user.xp >= LEVELS[i].minXp) {
                newLevel = LEVELS[i].level;
                newTitle = LEVELS[i].title;
                break;
            }
        }

        const leveledUp = newLevel > user.level;
        user.level = newLevel;
        user.levelTitle = newTitle;
        saveUser(user);

        // Evaluasi otomatis 6 lencana resmi
        checkAndAwardBadges(user);

        // Catat Riwayat Aktivitas
        logActivity(reason, 'award', 'xp', points);

        // Sinkronisasi pembaruan XP ke Firestore jika pengguna login
        try {
            getFirebaseBridge().then(fb => {
                if (fb && fb.auth && fb.auth.currentUser) {
                    const uid = fb.auth.currentUser.uid;
                    fb.updateDoc(fb.doc(fb.db, "users", uid), {
                        xp: user.xp,
                        level: user.level,
                        levelTitle: user.levelTitle,
                        badges: user.badges || [],
                        stats: user.stats || {},
                        lastActive: new Date().toISOString()
                    }).catch(e => console.warn('[Cendekia Central] Sync XP Firestore tertunda:', e));
                }
            });
        } catch(e) {}

        // Tampilkan Notifikasi Toast
        showFloatingXP(points, (reason && reason.toLowerCase().includes('bonus')) ? 'Bonus Cepat! ⚡' : '');

        if (leveledUp) {
            showLevelUpModal(user.level, user.levelTitle);
        }

        // Perbarui elemen UI di halaman aktif jika ada
        updateDOMStats();
        return { xp: user.xp, level: user.level, leveledUp };
    }

    // PENCATATAN AKTIVITAS BACAAN & GAME KHUSUS
    function recordMaterialRead(category, title) {
        const todayKey = getTodayDateKeyWIB();
        try {
            localStorage.setItem('cendekia_read_today_' + todayKey, JSON.stringify({ category, title, timestamp: Date.now() }));
        } catch(e) {}

        const user = getUser();
        if (!user.stats) user.stats = { quizCompleted: 0, gamesCompleted: 0, materialsLearned: 0, worksCreated: 0, ideasArchived: 0 };
        user.stats.materialsLearned = (user.stats.materialsLearned || 0) + 1;
        saveUser(user);
        // Sesuai aturan: Modul materi dapat dibaca berulang kali secara penuh tanpa XP
        logActivity('Membaca Modul: ' + (title || category), 'book-open', 'read');
        completeChallenge('tc_read');
        checkAndAwardBadges(user);
    }

    function recordGameCompleted(gameName, score) {
        const user = getUser();
        if (!user.stats) user.stats = { quizCompleted: 0, gamesCompleted: 0, materialsLearned: 0, worksCreated: 0, ideasArchived: 0 };
        user.stats.gamesCompleted = (user.stats.gamesCompleted || 0) + 1;
        saveUser(user);
        checkAndAwardBadges(user);
    }

    // EVALUASI & NOTIFIKASI 6 LENCANA RESMI
    function checkAndAwardBadges(user) {
        if (!user) user = getUser();
        if (!Array.isArray(user.badges)) user.badges = [];

        let newlyUnlocked = [];

        Object.keys(BADGE_CATALOG).forEach(key => {
            const badge = BADGE_CATALOG[key];
            if (!user.badges.includes(badge.id)) {
                if (badge.check && badge.check(user)) {
                    user.badges.push(badge.id);
                    newlyUnlocked.push(badge);
                }
            }
        });

        if (newlyUnlocked.length > 0) {
            saveUser(user);
            newlyUnlocked.forEach((badge, idx) => {
                setTimeout(() => {
                    showBadgeUnlockedModal(badge);
                }, idx * 1200);
            });
        }

        return user.badges;
    }

    function showBadgeUnlockedModal(badge) {
        const overlay = document.createElement('div');
        overlay.className = 'app-modal-overlay';
        overlay.style.display = 'flex';
        overlay.style.zIndex = '9999';
        overlay.innerHTML = `
            <div class="app-modal-card" style="text-align:center; max-width:340px;">
                <div class="modal-icon-badge" style="background:#fef3c7; color:#b45309; width:68px; height:68px; border:2px solid var(--accent); margin:0 auto 12px; display:flex; align-items:center; justify-content:center; border-radius:50%;">
                    <i data-lucide="${badge.icon || 'medal'}" style="width:34px; height:34px;"></i>
                </div>
                <div style="font-size:0.7rem; font-weight:800; color:var(--accent-dark); text-transform:uppercase; letter-spacing:0.5px;">Pencapaian Baru Terbuka!</div>
                <h3 class="modal-title" style="color:var(--primary); font-size:1.15rem; margin:4px 0 8px;">${badge.name} 🏅</h3>
                <p class="modal-desc" style="font-size:0.75rem; line-height:1.45; color:var(--text-muted); margin-bottom:12px;">${badge.desc}</p>
                <div style="background:#ecfdf5; border:1px solid #a7f3d0; border-radius:var(--radius-sm); padding:6px 12px; margin-bottom:16px; font-size:0.72rem; font-weight:800; color:#065f46; display:inline-flex; align-items:center; gap:6px;">
                    <i data-lucide="sparkles" style="width:14px; height:14px; color:#059669;"></i> Lencana Resmi Aktif &bull; +25 XP
                </div>
                <button type="button" class="btn-modal-primary" style="background:var(--primary); width:100%;" onclick="this.closest('.app-modal-overlay').remove()">
                    Keren, Lanjutkan!
                </button>
            </div>
        `;
        document.body.appendChild(overlay);
        if (window.lucide) lucide.createIcons();
    }

    function showXPToast(text) {
        // Hapus elemen toast lama jika ada
        const oldToast = document.getElementById('cendekiaXPToast');
        if (oldToast) oldToast.remove();
        // Redirect ke floating XP toast tunggal tanpa background gelap
        const match = (text || '').match(/\+(\d+)\s*XP/i);
        const amount = match ? parseInt(match[1]) : 20;
        const isBonus = (text || '').toLowerCase().includes('bonus');
        showFloatingXP(amount, isBonus ? 'Bonus Cepat! ⚡' : '');
    }

    function showLevelUpModal(level, title) {
        const overlay = document.createElement('div');
        overlay.className = 'app-modal-overlay';
        overlay.style.display = 'flex';
        overlay.innerHTML = `
            <div class="app-modal-card">
                <div class="modal-icon-badge" style="background:#fef3c7; color:#b45309; width:68px; height:68px; font-size:1.8rem;">
                    <i data-lucide="trophy" style="width:34px; height:34px;"></i>
                </div>
                <h3 class="modal-title" style="color:#b45309;">Selamat! Naik Level ${level} 🎉</h3>
                <p class="modal-desc">Hebat sekali! Anda kini meraih gelar <b>${title}</b>. Terus tingkatkan karya dan kecakapan literasimu!</p>
                <button type="button" class="btn-modal-primary" style="background:var(--accent-dark);" onclick="this.closest('.app-modal-overlay').remove()">Lanjutkan Belajar</button>
            </div>
        `;
        document.body.appendChild(overlay);
        if (window.lucide) lucide.createIcons();
    }

    // 4. RIWAYAT AKTIVITAS
    function logActivity(title, icon = 'check-circle-2', type = 'info', value = null) {
        try {
            let history = JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORY) || '[]');
            const now = new Date();
            const yyyy = now.getFullYear();
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const dd = String(now.getDate()).padStart(2, '0');
            history.unshift({
                id: 'act_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
                title,
                icon,
                type,
                value,
                time: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                date: now.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
                isoDate: getTodayDateKeyWIB ? getTodayDateKeyWIB() : `${yyyy}-${mm}-${dd}`,
                timestamp: Date.now()
            });
            if (history.length > 40) history = history.slice(0, 40);
            localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));
            scheduleCloudMemorySync();
        } catch (e) {}
    }

    function getHistory() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORY) || '[]');
        } catch (e) {
            return [];
        }
    }

    // ANALITIK AKTIVITAS REALTIME PEKAN INI (SENIN - MINGGU DARI SELURUH SUMBER DATA)
    function getWeeklyActivityStats() {
        const history = getHistory();
        const works = getWorks();
        const ideas = getIdeas();

        const now = getWIBDate ? getWIBDate() : new Date();
        const currentDayOfWeek = (now.getDay() + 6) % 7; // 0 = Senin, ..., 6 = Minggu
        
        const monday = new Date(now);
        monday.setDate(now.getDate() - currentDayOfWeek);
        monday.setHours(0, 0, 0, 0);

        const days = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
        const dayCounts = [0, 0, 0, 0, 0, 0, 0];
        const dayDates = [];

        for (let i = 0; i < 7; i++) {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const dayNum = String(d.getDate()).padStart(2, '0');
            dayDates.push(`${y}-${m}-${dayNum}`);
        }

        // 1. Aktivitas dari history log
        if (Array.isArray(history)) {
            history.forEach(item => {
                let itemDate = item.isoDate;
                if (!itemDate && item.timestamp) {
                    const d = new Date(item.timestamp);
                    itemDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                }
                if (itemDate) {
                    const idx = dayDates.indexOf(itemDate);
                    if (idx !== -1) {
                        dayCounts[idx]++;
                    }
                }
            });
        }

        // 2. Aktivitas dari naskah karya yang dibuat / diperbarui
        if (Array.isArray(works)) {
            works.forEach(w => {
                const dateSource = w.updatedAt || w.createdAt;
                if (dateSource) {
                    const d = new Date(dateSource);
                    const y = d.getFullYear();
                    const m = String(d.getMonth() + 1).padStart(2, '0');
                    const dayNum = String(d.getDate()).padStart(2, '0');
                    const dateStr = `${y}-${m}-${dayNum}`;
                    const idx = dayDates.indexOf(dateStr);
                    if (idx !== -1) {
                        dayCounts[idx]++;
                    }
                }
            });
        }

        // 3. Aktivitas dari ide kreasi yang diarsipkan
        if (Array.isArray(ideas)) {
            ideas.forEach(idItem => {
                const dateSource = idItem.createdAt;
                if (dateSource) {
                    const d = new Date(dateSource);
                    const y = d.getFullYear();
                    const m = String(d.getMonth() + 1).padStart(2, '0');
                    const dayNum = String(d.getDate()).padStart(2, '0');
                    const dateStr = `${y}-${m}-${dayNum}`;
                    const idx = dayDates.indexOf(dateStr);
                    if (idx !== -1) {
                        dayCounts[idx]++;
                    }
                }
            });
        }

        // 4. Aktivitas dari game latihan, modul bacaan, tantangan harian, & kunjungan
        const gameKeys = ['kuis_pintar', 'tebak_kata', 'susun_kata', 'teka_teki', 'tebak_sastra', 'sambung_cerita', 'perbaiki_kalimat', 'tantangan_cepat'];
        const userObj = getUser();
        const visitDates = Array.isArray(userObj.visitDates) ? userObj.visitDates : [];

        dayDates.forEach((dateStr, idx) => {
            if (visitDates.includes(dateStr) && dayCounts[idx] === 0) {
                dayCounts[idx] += 1;
            }
            gameKeys.forEach(gk => {
                try {
                    if (localStorage.getItem(`cendekia_result_${gk}_${dateStr}`) || localStorage.getItem(`cendekia_game_result_${gk}_${dateStr}`)) {
                        dayCounts[idx]++;
                    }
                } catch(e) {}
            });
            try {
                if (localStorage.getItem('cendekia_read_today_' + dateStr)) {
                    dayCounts[idx]++;
                }
            } catch(e) {}
            try {
                const compl = localStorage.getItem('cendekia_completed_challenges_' + dateStr);
                if (compl) {
                    const parsed = JSON.parse(compl);
                    dayCounts[idx] += Object.keys(parsed).length;
                }
            } catch (e) {}
        });

        const totalActivities = dayCounts.reduce((a, b) => a + b, 0);
        const maxDayCount = Math.max(...dayCounts, 1);
        let activeDaysCount = 0;
        dayCounts.forEach((c, i) => {
            if (i <= currentDayOfWeek && c > 0) activeDaysCount++;
        });

        // Konsistensi pekan berjalan:
        // Sepekan adalah 7 hari penuh (Senin s.d. Minggu).
        // Selama pekan masih berjalan (belum melewati Minggu malam / 00:00 WIB pergantian pekan),
        // konsistensi dihitung terhadap total 7 hari dan berstatus "Sedang Berjalan",
        // sehingga konsistensi tidak langsung diklaim 100% di awal/tengah pekan.
        const consistencyRate = Math.round((activeDaysCount / 7) * 100);
        const isWeekEnded = currentDayOfWeek === 6 && (now.getHours() === 23 && now.getMinutes() >= 59);
        const statusText = isWeekEnded ? 'Pekan Selesai' : 'Sedang Berjalan';

        const resultDays = days.map((label, idx) => {
            const count = dayCounts[idx];
            const isToday = idx === currentDayOfWeek;
            const isFuture = idx > currentDayOfWeek;
            let heightPercent = 0;
            if (count > 0) {
                heightPercent = Math.min(100, Math.max(25, Math.round((count / maxDayCount) * 100)));
            }
            return {
                label,
                dateStr: dayDates[idx],
                count,
                heightPercent,
                isToday,
                isFuture,
                hasActivity: count > 0
            };
        });

        return {
            days: resultDays,
            totalActivities,
            activeDays: activeDaysCount,
            consistency: consistencyRate,
            isWeekEnded: isWeekEnded,
            statusText: statusText,
            currentDayIdx: currentDayOfWeek,
            isTodayActive: dayCounts[currentDayOfWeek] > 0
        };
    }

    // WIDGET KALENDER KEAKTIFAN PEKAN INI (REALTIME)
    function renderWeeklyCalendarWidget(containerOrId) {
        const el = typeof containerOrId === 'string' ? document.getElementById(containerOrId) : containerOrId;
        if (!el) return;

        const stats = getWeeklyActivityStats();

        let cellsHtml = '';
        stats.days.forEach(d => {
            let cellClass = 'cal-day-cell';
            let iconText = '-';

            if (d.isToday) {
                if (d.hasActivity) {
                    cellClass += ' active-streak today-burning';
                    iconText = '🔥';
                } else {
                    cellClass += ' today-waiting';
                    iconText = 'Hari Ini';
                }
            } else if (d.hasActivity) {
                cellClass += ' active-streak';
                iconText = '✓';
            } else if (d.isFuture) {
                cellClass += ' future-day';
                iconText = '-';
            }

            cellsHtml += `
                <div class="${cellClass}" title="${d.label} (${d.dateStr}): ${d.count} Aktivitas">
                    <span style="font-size:0.62rem; display:block; opacity:0.85; margin-bottom:2px;">${d.label}</span>
                    <span style="font-size:0.75rem; font-weight:800;">${iconText}</span>
                </div>
            `;
        });

        const statusBanner = stats.isTodayActive
            ? `<span style="font-size:0.68rem; font-weight:800; color:#059669; display:inline-flex; align-items:center; gap:3px; white-space:nowrap; flex-shrink:0;"><i data-lucide="flame" style="width:13px; height:13px; color:#f59e0b;"></i> Api Keaktifan Menyala!</span>`
            : `<span style="font-size:0.68rem; font-weight:700; color:#b45309; display:inline-flex; align-items:center; gap:3px; white-space:nowrap; flex-shrink:0;"><i data-lucide="sparkles" style="width:13px; height:13px; color:#d97706;"></i> Siap Beraktivitas Hari Ini</span>`;

        el.innerHTML = `
            <div class="cal-widget-inner">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:8px;">
                    <strong style="font-size:0.8rem; color:var(--primary); display:flex; align-items:center; gap:5px; white-space:nowrap;">
                        <i data-lucide="calendar" style="width:14px; height:14px; color:var(--accent-dark);"></i> Kalender Keaktifan Pekan Ini
                    </strong>
                    ${statusBanner}
                </div>
                <div class="cal-week-row">
                    ${cellsHtml}
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; font-size:0.68rem; color:var(--text-muted); margin-top:8px; white-space:nowrap;">
                    <span>${stats.activeDays}/7 Hari Aktif Pekan Ini</span>
                    <span>Konsistensi: <b style="color:var(--primary);">${stats.consistency}%</b></span>
                </div>
            </div>
        `;

        if (window.lucide) lucide.createIcons();
    }

    // 5. TANTANGAN HARIAN SISTEM REALTIME (TERHUBUNG KE AKTIVITAS NYATA)
    function getDailyChallenges() {
        const todayKey = getTodayDateKeyWIB ? getTodayDateKeyWIB() : new Date().toISOString().split('T')[0];
        const history = getHistory();
        const works = getWorks();

        let completedMap = {};
        try {
            completedMap = JSON.parse(localStorage.getItem('cendekia_completed_challenges_' + todayKey) || '{}');
        } catch(e) {}

        // 1. Cek Kuis Pintar
        const kuisRes = getGameResult('kuis_pintar');
        const isQuizDone = !!kuisRes || !!completedMap['tc_quiz'] || !!completedMap['tc_2'];

        // 2. Cek Baca Modul
        let isReadDone = !!completedMap['tc_read'] || !!completedMap['tc_1'];
        if (!isReadDone) {
            try {
                if (localStorage.getItem('cendekia_read_today_' + todayKey)) {
                    isReadDone = true;
                } else {
                    isReadDone = history.some(h => (h.isoDate === todayKey || (h.timestamp && new Date(h.timestamp).toISOString().split('T')[0] === todayKey)) && (h.type === 'read' || (h.title && h.title.toLowerCase().includes('membaca'))));
                }
            } catch(e) {}
        }

        // 3. Cek Game Kata & Sastra
        const tebakRes = getGameResult('tebak_kata');
        const susunRes = getGameResult('susun_kata');
        const tekaRes = getGameResult('teka_teki');
        const sastraRes = getGameResult('tebak_sastra');
        const sambungRes = getGameResult('sambung_cerita');
        const kalimatRes = getGameResult('perbaiki_kalimat');
        const cepatRes = getGameResult('tantangan_cepat');
        const isGameDone = !!(tebakRes || susunRes || tekaRes || sastraRes || sambungRes || kalimatRes || cepatRes) || !!completedMap['tc_game'] || !!completedMap['tc_3'];

        // 4. Cek Naskah Tulisan
        let isWriteDone = !!completedMap['tc_write'] || !!completedMap['tc_4'];
        if (!isWriteDone) {
            try {
                isWriteDone = works.some(w => {
                    const ds = w.updatedAt || w.createdAt;
                    return ds && ds.startsWith(todayKey);
                });
            } catch(e) {}
        }

        return [
            {
                id: 'tc_quiz',
                badge: 'Kuis Harian',
                icon: 'brain',
                title: 'Kuis Pintar Kaidah EYD V',
                desc: 'Selesaikan 15 butir soal pilihan ganda literasi & kata baku.',
                rewardXp: 25,
                link: `${PORTAL_PREFIX}/permainan/kuis-pintar.html`,
                actionText: 'Mulai Kuis',
                completed: isQuizDone,
                progressText: isQuizDone ? (kuisRes ? `Skor: ${kuisRes.score}/100 ✓` : 'Selesai ✓') : '15 Soal Menanti'
            },
            {
                id: 'tc_read',
                badge: 'Literasi Modul',
                icon: 'book-open',
                title: 'Jelajahi 1 Modul Pembelajaran',
                desc: IS_MEM_5K
                    ? 'Baca tuntas materi Pengetahuan Umum, Inti, atau Khusus.'
                    : 'Baca tuntas materi Pengetahuan Umum atau Pengetahuan Inti.',
                rewardXp: 15,
                link: `${PORTAL_PREFIX}/belajar.html`,
                actionText: 'Baca Modul',
                completed: isReadDone,
                progressText: isReadDone ? 'Selesai Dibaca ✓' : 'Belum Dibaca'
            },
            {
                id: 'tc_game',
                badge: 'Arena Kata',
                icon: 'gamepad-2',
                title: 'Asah Kosakata di Arena Permainan',
                desc: 'Pecahkan minimal 1 sesi permainan asah literasi hari ini.',
                rewardXp: 20,
                link: `${PORTAL_PREFIX}/bermain.html`,
                actionText: 'Mainkan Game',
                completed: isGameDone,
                progressText: isGameDone ? 'Game Ditaklukkan ✓' : 'Belum Dimainkan'
            },
            {
                id: 'tc_write',
                badge: 'Ruang Menulis',
                icon: 'pen-tool',
                title: 'Goreskan Draf Tulisan Baru',
                desc: 'Tulis ide puisi, cerpen, atau catatan gagasan di Ruang Menulis.',
                rewardXp: 20,
                link: `${PORTAL_PREFIX}/berkarya/ruang-menulis.html`,
                actionText: 'Mulai Menulis',
                completed: isWriteDone,
                progressText: isWriteDone ? 'Karya Tersimpan ✓' : 'Belum Menulis'
            }
        ];
    }

    function completeChallenge(id) {
        const todayKey = getTodayDateKeyWIB ? getTodayDateKeyWIB() : new Date().toISOString().split('T')[0];
        try {
            let completedMap = JSON.parse(localStorage.getItem('cendekia_completed_challenges_' + todayKey) || '{}');
            if (!completedMap[id]) {
                completedMap[id] = { completedAt: new Date().toISOString() };
                localStorage.setItem('cendekia_completed_challenges_' + todayKey, JSON.stringify(completedMap));
                
                const list = getDailyChallenges();
                const ch = list.find(c => c.id === id || (id === 'tc_2' && c.id === 'tc_quiz') || (id === 'tc_3' && c.id === 'tc_game') || (id === 'tc_1' && c.id === 'tc_read') || (id === 'tc_4' && c.id === 'tc_write'));
                const xpBonus = ch ? ch.rewardXp : 20;
                addXP(xpBonus, `Tantangan Selesai (${ch ? ch.title : id})`);
                return true;
            }
        } catch (e) {}
        return false;
    }

    // 6. KARYA & IDE REPOSITORY
    function getWorks() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY_WORKS) || '[]');
        } catch (e) {
            return [];
        }
    }

    function saveWork(work) {
        try {
            let works = getWorks();
            const existingIndex = works.findIndex(w => w.id === work.id);
            if (existingIndex >= 0) {
                works[existingIndex] = { ...works[existingIndex], ...work, updatedAt: new Date().toISOString() };
            } else {
                work.id = work.id || 'work_' + Date.now();
                work.createdAt = new Date().toISOString();
                work.updatedAt = work.createdAt;
                works.unshift(work);
            }
            localStorage.setItem(STORAGE_KEY_WORKS, JSON.stringify(works));
            
            const user = getUser();
            user.stats.worksCreated = works.length;
            saveUser(user);
            return work;
        } catch (e) {
            return null;
        }
    }

    function getIdeas() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY_IDEAS) || '[]');
        } catch (e) {
            return [];
        }
    }

    function saveIdea(idea) {
        try {
            let ideas = getIdeas();
            idea.id = idea.id || 'idea_' + Date.now();
            idea.createdAt = new Date().toISOString();
            ideas.unshift(idea);
            localStorage.setItem(STORAGE_KEY_IDEAS, JSON.stringify(ideas));

            const user = getUser();
            user.stats.ideasArchived = ideas.length;
            saveUser(user);
            addXP(10, 'Menyimpan Ide Kreatif');
            return idea;
        } catch (e) {
            return null;
        }
    }

    // 7. SISTEM TRANSAKSI & UPGRADE KEANGGOTAAN MEMBER (TANPA DAFTAR ULANG)
    function getTransactions() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY_TRANSACTIONS) || '[]');
        } catch (e) {
            return [];
        }
    }

    async function recordTransaction(tx) {
        try {
            let txs = getTransactions();
            const newTx = {
                id: tx.id || tx.invoiceNo || 'tx_' + Date.now(),
                invoiceNo: tx.invoiceNo || ('INV-UPG-' + Date.now().toString(36).toUpperCase()),
                packageId: tx.packageId || '5k',
                packageName: tx.packageName || 'Member 5K',
                amount: tx.amount || 5000,
                basePrice: tx.basePrice || 5000,
                uniqueCode: tx.uniqueCode || 0,
                status: tx.status || 'LUNAS',
                paymentMethod: tx.paymentMethod || 'QRIS Digital Otomatis',
                date: tx.date || new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
                timestamp: new Date().toISOString(),
                userName: tx.userName || '',
                userEmail: tx.userEmail || ''
            };
            txs.unshift(newTx);
            localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(txs));

            // Simpan ke Firestore transactions jika bridge aktif
            try {
                const fb = await getFirebaseBridge();
                if (fb && fb.db) {
                    const uid = fb.auth?.currentUser?.uid || 'guest';
                    await fb.setDoc(fb.doc(fb.db, "transactions", newTx.invoiceNo), {
                        ...newTx,
                        uid: uid,
                        createdAt: new Date().toISOString()
                    });
                }
            } catch (err) {
                console.warn('[Cendekia Central] Sync transaction firestore warning:', err);
            }

            return newTx;
        } catch (e) {
            console.error('[Cendekia Central] Gagal menyimpan transaksi:', e);
            return null;
        }
    }

    function getMembershipInfo(userObj) {
        const u = userObj || getUser();
        const pkg = String(u.packageId || '').toLowerCase();
        const tier = String(u.tier || '').toLowerCase();
        const is5k = pkg === '5k' || pkg === 'mem-5k' || tier.includes('5k');
        const isPro = pkg === '10k' || pkg === '15k' || pkg === '20k' || pkg === 'pro' || pkg === 'mem-pro'
            || tier.includes('10k') || tier.includes('15k') || tier.includes('20k') || tier.includes('pro');
        const isPaid = is5k || isPro;

        let expiresAtMs = null;
        let isExpired = false;
        let daysRemaining = 0;
        let formattedExpiry = '-';

        if (u.membershipExpiresAt) {
            const parsedMs = new Date(u.membershipExpiresAt).getTime();
            if (!isNaN(parsedMs)) {
                expiresAtMs = parsedMs;
                const diffMs = parsedMs - Date.now();
                isExpired = diffMs <= 0;
                daysRemaining = isExpired ? 0 : Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                formattedExpiry = new Date(parsedMs).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                });
            }
        }

        return {
            isPaid,
            is5k,
            isPro,
            isExpired,
            expiresAtMs,
            daysRemaining,
            formattedExpiry,
            durationDays: MEMBERSHIP_DURATION_DAYS
        };
    }

    async function upgradeUserTier(tierName, packageId = '5k') {
        const user = getUser();
        const now = Date.now();
        const durationMs = MEMBERSHIP_DURATION_DAYS * 24 * 60 * 60 * 1000; // 40 Hari Penuh

        // Jika sudah aktif & masih ada sisa masa aktif, perpanjang +40 hari dari tanggal berakhir sebelumnya
        let baseStartMs = now;
        if (user.membershipExpiresAt) {
            const prevExp = new Date(user.membershipExpiresAt).getTime();
            if (!isNaN(prevExp) && prevExp > now) {
                baseStartMs = prevExp;
            }
        }
        const startedIso = user.membershipStartedAt && baseStartMs > now
            ? user.membershipStartedAt
            : new Date(now).toISOString();
        const expiresIso = new Date(baseStartMs + durationMs).toISOString();

        user.tier = tierName;
        user.role = 'siswa';
        user.status = 'registered';
        user.packageId = packageId;
        user.packageName = tierName;
        user.membershipStartedAt = startedIso;
        user.membershipExpiresAt = expiresIso;
        user.membershipDurationDays = MEMBERSHIP_DURATION_DAYS;
        user.membershipStatus = 'active';
        saveUser(user, true);

        // Update di session legacy juga
        try {
            const legacy = JSON.parse(localStorage.getItem('cendekia_user') || '{}');
            legacy.tier = tierName;
            legacy.role = 'siswa';
            legacy.status = 'registered';
            legacy.packageId = packageId;
            legacy.packageName = tierName;
            legacy.membershipStartedAt = startedIso;
            legacy.membershipExpiresAt = expiresIso;
            legacy.membershipDurationDays = MEMBERSHIP_DURATION_DAYS;
            legacy.membershipStatus = 'active';
            localStorage.setItem('cendekia_user', JSON.stringify(legacy));
            localStorage.setItem('user_status', 'registered');
            localStorage.setItem('user_package', packageId);
        } catch (e) {}

        // Sync ke Firestore users/{uid} dengan merge: true agar selalu tersimpan utuh
        try {
            const fb = await getFirebaseBridge();
            if (fb && fb.auth && fb.auth.currentUser) {
                await fb.setDoc(fb.doc(fb.db, "users", fb.auth.currentUser.uid), {
                    tier: tierName,
                    role: 'siswa',
                    status: 'registered',
                    packageId: packageId,
                    packageName: tierName,
                    membershipStartedAt: startedIso,
                    membershipExpiresAt: expiresIso,
                    membershipDurationDays: MEMBERSHIP_DURATION_DAYS,
                    membershipStatus: 'active',
                    updatedAt: new Date().toISOString()
                }, { merge: true });
            }
        } catch (err) {
            console.warn('[Cendekia Central] Update tier Firestore warning:', err);
        }

        updateDOMStats();
        return user;
    }

    // Downgrade manual ke Member Free (masa aktif & kuota Member 5K hangus permanen)
    async function downgradeToFree() {
        const user = getUser();
        const prevPkg = user.packageId || '5k';
        const nowIso = new Date().toISOString();

        const patch = {
            tier: 'Member Free',
            packageId: 'free',
            packageName: 'Member Free',
            membershipStartedAt: null,
            membershipExpiresAt: null,
            membershipDurationDays: 0,
            membershipStatus: 'downgraded',
            downgradedFrom: prevPkg,
            downgradedAt: nowIso,
            curationQuota: 0,
            updatedAt: nowIso
        };

        Object.assign(user, patch);
        saveUser(user, true);

        try {
            const legacy = JSON.parse(localStorage.getItem('cendekia_user') || '{}');
            Object.assign(legacy, patch);
            localStorage.setItem('cendekia_user', JSON.stringify(legacy));
            localStorage.setItem('user_package', 'free');
        } catch (e) {}

        try {
            const fb = await getFirebaseBridge();
            if (fb && fb.auth && fb.auth.currentUser) {
                await fb.setDoc(fb.doc(fb.db, "users", fb.auth.currentUser.uid), patch, { merge: true });
            }
        } catch (err) {
            console.warn('[Cendekia Central] Downgrade Firestore warning:', err);
        }

        logActivity('Downgrade ke Member Free (Kuota paket sebelumnya hangus)', 'arrow-down-circle', 'info');
        return user;
    }

    // 8. TELAAH KURASI SISTEM CENDEKIA (SISTEM CERDAS BERKARYA TANPA KATA TERLARANG)
    function analyzeWritingSystem(text, category = 'cerpen') {
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        const characters = text.length;
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
        const avgSentenceLength = sentences > 0 ? Math.round(words / sentences) : 0;

        // Algoritma Evaluasi Struktur Tulisan
        let clarityScore = 80;
        let flowScore = 85;
        let creativityScore = 88;
        const suggestions = [];

        if (words < 50) {
            suggestions.push('Kembangkan detail suasana dan indra pembaca (aroma, bunyi, dan pencahayaan) untuk memperkuat imersi naskah.');
            clarityScore -= 10;
        } else if (words >= 300) {
            clarityScore = Math.min(95, clarityScore + 10);
            suggestions.push('Variasi panjang kalimat sudah sangat menarik. Pertahankan ritme antara kalimat pendek bertenaga dan kalimat deskriptif.');
        }

        if (avgSentenceLength > 22) {
            suggestions.push('Beberapa kalimat cukup panjang. Pertimbangkan memecah menjadi dua kalimat agar pesan tersampaikan lebih renyah.');
            flowScore -= 8;
        } else {
            suggestions.push('Aliran dan ritme kalimat terbaca mengalir dengan tempo yang nyaman.');
        }

        suggestions.push('Pemilihan diksi memiliki nuansa puitis yang baik. Sisipkan analogi metaforis untuk mempertegas konflik utama.');

        return {
            words,
            characters,
            sentences,
            avgSentenceLength,
            scores: {
                clarity: clarityScore,
                flow: flowScore,
                creativity: creativityScore,
                overall: Math.round((clarityScore + flowScore + creativityScore) / 3)
            },
            recommendations: suggestions,
            quotaRemaining: 5,
            analyzedAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        };
    }

    // 8. ROUTE RESOLVER KELAS & DASHBOARD
    function getClassDashboardUrl() {
        const user = getUser();
        const sem = parseInt(user.semester) || 1;
        return sem >= 3 ? '/dashboard/inkubasi.html' : '/dashboard/index.html';
    }

    // 9. NAVBAR RENDERER (UNIFORM STICKY BOTTOM NAV - OTOMATIS SESUAI PORTAL FREE / 5K)
    function renderBottomNav(activePage = 'beranda') {
        const navHtml = `
            <nav class="bottom-nav">
                <a href="${PORTAL_PREFIX}/index.html" class="nav-item ${activePage === 'beranda' ? 'active' : ''}">
                    <i data-lucide="home"></i>
                    <span>Beranda</span>
                </a>
                <a href="${PORTAL_PREFIX}/belajar.html" class="nav-item ${activePage === 'belajar' ? 'active' : ''}">
                    <i data-lucide="book-open-check"></i>
                    <span>Belajar</span>
                </a>
                <a href="${PORTAL_PREFIX}/bermain.html" class="nav-item ${activePage === 'bermain' ? 'active' : ''}">
                    <i data-lucide="gamepad-2"></i>
                    <span>Bermain</span>
                </a>
                <a href="${PORTAL_PREFIX}/berkarya.html" class="nav-item ${activePage === 'berkarya' ? 'active' : ''}">
                    <i data-lucide="pen-tool"></i>
                    <span>Berkarya</span>
                </a>
                <a href="${PORTAL_PREFIX}/dashboard-kelas.html" class="nav-item ${activePage === 'kelas' ? 'active' : ''}">
                    <i data-lucide="school"></i>
                    <span>Kelas</span>
                </a>
                <a href="${PORTAL_PREFIX}/profil.html" class="nav-item ${activePage === 'profil' ? 'active' : ''}">
                    <i data-lucide="user-round"></i>
                    <span>Profil</span>
                </a>
            </nav>
        `;

        const existingNav = document.querySelector('.bottom-nav');
        if (existingNav) {
            existingNav.outerHTML = navHtml;
        } else {
            const wrapper = document.querySelector('.mobile-app-wrapper') || document.body;
            wrapper.insertAdjacentHTML('beforeend', navHtml);
        }
        if (window.lucide) lucide.createIcons();
    }

    // 9B. ASISTEN AI AKSABOT / MENTOR AI (KHUSUS MEMBER 5K - TERHUBUNG LANGSUNG KE /api/aksabot & FALLBACK /api/central)
    async function askAksaBotAI(message, history = []) {
        const user = getUser();
        // 1. Prioritas utama: Endpoint resmi AksaBot (/api/aksabot)
        try {
            const res = await fetch('/api/aksabot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message,
                    userName: user.name || 'Siswa Cendekia',
                    history: Array.isArray(history) ? history.slice(-8) : []
                })
            });
            const data = await res.json().catch(() => null);
            if (data && data.reply && !data.error) {
                return { success: true, reply: data.reply, source: 'aksabot', model: data.model || 'AksaBot' };
            }
        } catch (err) {
            console.warn('[AksaBot] /api/aksabot fallback ke mentor-consultation:', err);
        }

        // 2. Fallback: Endpoint Mentor AI Literasi (/api/central)
        try {
            const res = await fetch('/api/central', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'mentor-consultation',
                    payload: {
                        message,
                        history: Array.isArray(history) ? history.slice(-8) : [],
                        topic: 'literasi',
                        userName: user.name || 'Siswa Cendekia'
                    }
                })
            });
            const data = await res.json().catch(() => null);
            if (data && data.reply) {
                return { success: true, reply: data.reply, source: 'mentor-ai' };
            }
        } catch (err2) {
            console.error('[Mentor AI Error]', err2);
        }

        return {
            success: false,
            reply: 'Mohon maaf, koneksi ke server AksaBot sedang sibuk. Silakan coba kirim pertanyaanmu kembali dalam beberapa detik ya! 🙏'
        };
    }

    const askMentorAI = askAksaBotAI;

    // 10. UPDATE DOM STATS BINDINGS (TERMASUK VISUAL API STREAK BERTINGKAT)
    function updateDOMStats() {
        const user = getUser();
        
        // Name & Greeting
        const nameEls = document.querySelectorAll('[data-bind="userName"]');
        nameEls.forEach(el => el.textContent = user.name || 'Siswa Cendekia');

        // Level & Title
        const levelEls = document.querySelectorAll('[data-bind="userLevel"]');
        levelEls.forEach(el => el.textContent = user.level);

        const levelTitleEls = document.querySelectorAll('[data-bind="userLevelTitle"]');
        levelTitleEls.forEach(el => el.textContent = user.levelTitle);

        // XP & Max XP
        const xpEls = document.querySelectorAll('[data-bind="userXp"]');
        xpEls.forEach(el => el.textContent = user.xp);

        const currentLvlConfig = LEVELS.find(l => l.level === user.level) || LEVELS[0];
        
        const maxXpEls = document.querySelectorAll('[data-bind="userMaxXp"]');
        maxXpEls.forEach(el => el.textContent = currentLvlConfig.maxXp);

        // Progress bar percentage
        const progressEls = document.querySelectorAll('[data-bind="xpProgressPercent"]');
        const xpInCurrentLevel = user.xp - currentLvlConfig.minXp;
        const totalXpInLevel = currentLvlConfig.maxXp - currentLvlConfig.minXp;
        const percent = Math.min(100, Math.max(0, Math.round((xpInCurrentLevel / totalXpInLevel) * 100)));
        progressEls.forEach(el => {
            el.style.width = percent + '%';
        });

        // Streak + Dinamika Tingkatan Api
        const streakEls = document.querySelectorAll('[data-bind="userStreak"]');
        streakEls.forEach(el => el.textContent = user.streak || 1);

        const flameInfo = getStreakFlameInfo(user.streak || 1, user.streakStatus || 'active');
        const streakPills = document.querySelectorAll('.hero-streak-pill');
        streakPills.forEach(pill => {
            pill.style.background = flameInfo.bgStyle;
            pill.style.borderColor = flameInfo.borderStyle;
            pill.style.boxShadow = flameInfo.glowStyle;
            pill.style.color = flameInfo.textColor;
            pill.style.cursor = 'pointer';
            pill.title = `${flameInfo.tierName} (${user.streak || 1} Hari) — Ketuk untuk melihat detail tingkatan api`;

            const flameIcon = pill.querySelector('svg, [data-lucide="flame"]');
            if (flameIcon) flameIcon.style.color = flameInfo.flameColor;

            if (!pill.dataset.streakModalBound) {
                pill.dataset.streakModalBound = '1';
                pill.addEventListener('click', () => showStreakInfoModal());
            }
        });

        // Photo / Avatar
        const photoEls = document.querySelectorAll('[data-bind="userPhoto"]');
        photoEls.forEach(img => {
            const avatarUrl = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'Siswa')}&background=003366&color=fff&size=200`;
            img.src = avatarUrl;
            img.style.display = 'block';
            img.onerror = function() {
                this.onerror = null;
                this.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'Siswa')}&background=003366&color=fff&size=200`;
            };
            if (img.parentElement) {
                const icon = img.parentElement.querySelector('.default-avatar-icon');
                if (icon) icon.style.display = 'none';
            }
        });
    }

    // Sinkronisasi Sesi Firebase, Cloud Memory (Ingatan), Auto-Expiry 40 Hari, & Kunci Portal Member 5K
    async function syncWithFirebaseUser() {
        try {
            const fb = await getFirebaseBridge();
            if (!fb || !fb.auth) return;

            const authModule = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js");
            authModule.onAuthStateChanged(fb.auth, async (authUser) => {
                if (authUser) {
                    let updated = false;
                    let currentUser = getUser();
                    const prevUid = currentUser.uid;
                    const isDifferentAccount = prevUid && !prevUid.startsWith('guest_') && prevUid !== authUser.uid;

                    if (isDifferentAccount) {
                        // Reset memori lokal dari akun berbeda agar tidak tercampur
                        currentUser = { ...defaultUser, uid: authUser.uid, email: authUser.email || '' };
                        try {
                            localStorage.removeItem(STORAGE_KEY_HISTORY);
                            localStorage.removeItem(STORAGE_KEY_WORKS);
                            localStorage.removeItem(STORAGE_KEY_IDEAS);
                        } catch (e) {}
                        updated = true;
                    } else if (currentUser.uid !== authUser.uid) {
                        currentUser.uid = authUser.uid;
                        updated = true;
                    }

                    if (authUser.email && currentUser.email !== authUser.email) {
                        currentUser.email = authUser.email;
                        updated = true;
                    }
                    if (authUser.photoURL && (!currentUser.photoURL || currentUser.photoURL !== authUser.photoURL)) {
                        currentUser.photoURL = authUser.photoURL;
                        updated = true;
                    }
                    if (authUser.displayName && (!currentUser.name || currentUser.name === 'Siswa Cendekia')) {
                        currentUser.name = authUser.displayName;
                        updated = true;
                    }

                    // 1. Baca dokumen utama users/{uid}
                    try {
                        const snap = await fb.getDoc(fb.doc(fb.db, "users", authUser.uid));
                        if (snap.exists()) {
                            const d = snap.data();
                            const newPhoto = d.photoURL || d.photo || d.foto || d.profilePic || d.avatar;
                            if (newPhoto && (!currentUser.photoURL || currentUser.photoURL !== newPhoto)) {
                                currentUser.photoURL = newPhoto;
                                currentUser.photo = newPhoto;
                                updated = true;
                            }
                            if (d.name && (!currentUser.name || currentUser.name === 'Siswa Cendekia' || currentUser.name !== d.name)) {
                                currentUser.name = d.name;
                                updated = true;
                            }
                            if (d.noHp && !currentUser.noHp) { currentUser.noHp = d.noHp; updated = true; }
                            if (d.alamat && !currentUser.alamat) { currentUser.alamat = d.alamat; updated = true; }
                            if (d.tanggalLahir && !currentUser.tanggalLahir) { currentUser.tanggalLahir = d.tanggalLahir; updated = true; }
                            if (d.bioSingkat && !currentUser.bioSingkat) { currentUser.bioSingkat = d.bioSingkat; updated = true; }
                            if (d.ips !== undefined) { currentUser.ips = d.ips; updated = true; }
                            if (d.semester) { currentUser.semester = parseInt(d.semester) || currentUser.semester; updated = true; }

                            // Sinkronkan XP & Statistik dari Cloud (Ingatan lintas perangkat & sesi)
                            if (typeof d.xp === 'number' && (isDifferentAccount || d.xp > (currentUser.xp || 0))) {
                                currentUser.xp = d.xp;
                                updated = true;
                            }
                            if (Array.isArray(d.badges) && d.badges.length > (currentUser.badges?.length || 0)) {
                                currentUser.badges = Array.from(new Set([...(currentUser.badges || []), ...d.badges]));
                                updated = true;
                            }
                            if (d.stats && typeof d.stats === 'object') {
                                currentUser.stats = {
                                    quizCompleted: Math.max(currentUser.stats?.quizCompleted || 0, d.stats.quizCompleted || 0),
                                    gamesCompleted: Math.max(currentUser.stats?.gamesCompleted || 0, d.stats.gamesCompleted || 0),
                                    materialsLearned: Math.max(currentUser.stats?.materialsLearned || 0, d.stats.materialsLearned || 0),
                                    worksCreated: Math.max(currentUser.stats?.worksCreated || 0, d.stats.worksCreated || 0),
                                    ideasArchived: Math.max(currentUser.stats?.ideasArchived || 0, d.stats.ideasArchived || 0)
                                };
                                updated = true;
                            }

                            // Sinkronkan Streak & Riwayat Kunjungan dari Cloud
                            const cloudLastVisit = d.lastVisitDate || d.lastActiveDate;
                            if (cloudLastVisit) {
                                const cloudVisitList = Array.isArray(d.visitDates) ? d.visitDates : [];
                                currentUser.visitDates = Array.from(new Set([...(currentUser.visitDates || []), ...cloudVisitList])).sort().slice(-60);
                                // Ambil streak & lastVisitDate cloud lalu evaluasi terhadap hari ini
                                if (typeof d.streak === 'number' && (isDifferentAccount || !currentUser.lastVisitDate || cloudLastVisit >= currentUser.lastVisitDate)) {
                                    currentUser.streak = d.streak;
                                    currentUser.lastVisitDate = cloudLastVisit;
                                    currentUser.lastActiveDate = cloudLastVisit;
                                    currentUser.streakStatus = d.streakStatus || 'active';
                                    updated = true;
                                }
                            }

                            // Sinkronkan Membership (Tier, PackageId, Masa Aktif 40 Hari) dari Firestore (Authoritative)
                            const cloudPkg = String(d.packageId || '').toLowerCase();
                            const cloudTier = String(d.tier || '').toLowerCase();
                            const isCloud5k = cloudPkg === '5k' || cloudPkg === 'mem-5k' || cloudTier.includes('5k');
                            const isCloudPro = cloudPkg === '10k' || cloudPkg === '15k' || cloudPkg === '20k' || cloudPkg === 'pro' || cloudPkg === 'mem-pro'
                                || cloudTier.includes('10k') || cloudTier.includes('15k') || cloudTier.includes('pro');

                            if (isCloud5k || isCloudPro) {
                                let expIso = d.membershipExpiresAt || null;
                                let startIso = d.membershipStartedAt || null;

                                if (!expIso) {
                                    // Akun Member 5K/Pro lama yang belum punya expiry -> tetapkan 40 hari dari sekarang
                                    startIso = new Date().toISOString();
                                    expIso = new Date(Date.now() + (MEMBERSHIP_DURATION_DAYS * 86400000)).toISOString();
                                    fb.setDoc(fb.doc(fb.db, "users", authUser.uid), {
                                        membershipStartedAt: startIso,
                                        membershipExpiresAt: expIso,
                                        membershipDurationDays: MEMBERSHIP_DURATION_DAYS,
                                        membershipStatus: 'active'
                                    }, { merge: true }).catch(() => {});
                                }

                                const expMs = new Date(expIso).getTime();
                                if (!isNaN(expMs) && Date.now() > expMs) {
                                    // MASA AKTIF 40 HARI SUDAH HABIS -> AUTO-DOWNGRADE KE MEMBER FREE
                                    const expPatch = {
                                        tier: 'Member Free',
                                        packageId: 'free',
                                        packageName: 'Member Free',
                                        membershipExpiresAt: null,
                                        membershipStatus: 'expired',
                                        lastAutoDowngradeAt: new Date().toISOString()
                                    };
                                    Object.assign(currentUser, expPatch);
                                    updated = true;
                                    await fb.setDoc(fb.doc(fb.db, "users", authUser.uid), expPatch, { merge: true }).catch(() => {});

                                    if (IS_MEM_5K) {
                                        saveUser(currentUser, true);
                                        alert('Masa aktif Member 5K Anda (40 hari) telah berakhir. Akun Anda otomatis beralih ke Member Free. Anda dapat memperpanjang kapan saja di menu Profil.');
                                        window.location.replace('/mem-free/index.html');
                                        return;
                                    }
                                } else {
                                    currentUser.tier = isCloud5k ? 'Member 5K' : (d.tier || d.packageName || 'Member Pro');
                                    currentUser.packageId = isCloud5k ? '5k' : (d.packageId || '15k');
                                    currentUser.packageName = d.packageName || currentUser.tier;
                                    currentUser.membershipStartedAt = startIso;
                                    currentUser.membershipExpiresAt = expIso;
                                    currentUser.membershipStatus = 'active';
                                    updated = true;

                                    // PORTAL LOCK GUARD: Member 5K aktif terkunci di /mem-5k/ (tidak boleh nyasar ke /mem-free/)
                                    const pathNow = window.location.pathname || '';
                                    if (isCloud5k && pathNow.startsWith('/mem-free') && !pathNow.includes('langganan')) {
                                        saveUser(currentUser, true);
                                        window.location.replace('/mem-5k/index.html');
                                        return;
                                    }
                                }
                            } else {
                                // Akun Member Free (atau sudah di-downgrade)
                                currentUser.tier = 'Member Free';
                                currentUser.packageId = 'free';
                                currentUser.packageName = 'Member Free';
                                currentUser.membershipExpiresAt = null;
                                currentUser.membershipStartedAt = null;
                                updated = true;

                                // PORTAL LOCK GUARD: Member Free tidak boleh masuk portal /mem-5k/
                                if (IS_MEM_5K) {
                                    saveUser(currentUser, true);
                                    window.location.replace('/mem-free/index.html');
                                    return;
                                }
                            }
                        }
                    } catch (e) {
                        console.warn('[Cendekia Central] Sync firestore doc warn:', e);
                    }

                    // 2. Pulihkan Cloud Memory (history, works, ideas, tantangan & hasil game hari ini)
                    try {
                        const memSnap = await fb.getDoc(fb.doc(fb.db, "mem_user_memory", authUser.uid));
                        if (memSnap.exists()) {
                            const m = memSnap.data();
                            const todayKey = getTodayDateKeyWIB();

                            if (Array.isArray(m.history) && m.history.length > 0) {
                                const localHist = getHistory();
                                const mapH = new Map();
                                [...m.history, ...localHist].forEach(h => { if (h && h.id) mapH.set(h.id, h); });
                                const mergedH = Array.from(mapH.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 40);
                                localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(mergedH));
                            }
                            if (Array.isArray(m.works) && m.works.length > 0) {
                                const localWorks = getWorks();
                                const mapW = new Map();
                                [...m.works, ...localWorks].forEach(w => { if (w && w.id) mapW.set(w.id, w); });
                                localStorage.setItem(STORAGE_KEY_WORKS, JSON.stringify(Array.from(mapW.values())));
                            }
                            if (Array.isArray(m.ideas) && m.ideas.length > 0) {
                                const localIdeas = getIdeas();
                                const mapI = new Map();
                                [...m.ideas, ...localIdeas].forEach(i => { if (i && i.id) mapI.set(i.id, i); });
                                localStorage.setItem(STORAGE_KEY_IDEAS, JSON.stringify(Array.from(mapI.values())));
                            }
                            if (m.todayDateKey === todayKey) {
                                if (m.completedChallengesToday && typeof m.completedChallengesToday === 'object') {
                                    const curC = JSON.parse(localStorage.getItem('cendekia_completed_challenges_' + todayKey) || '{}');
                                    localStorage.setItem('cendekia_completed_challenges_' + todayKey, JSON.stringify({ ...m.completedChallengesToday, ...curC }));
                                }
                                if (m.readToday && !localStorage.getItem('cendekia_read_today_' + todayKey)) {
                                    localStorage.setItem('cendekia_read_today_' + todayKey, JSON.stringify(m.readToday));
                                }
                                if (m.gameResultsToday && typeof m.gameResultsToday === 'object') {
                                    Object.keys(m.gameResultsToday).forEach(gk => {
                                        const rKey = getResultStorageKey(gk);
                                        if (!localStorage.getItem(rKey)) {
                                            localStorage.setItem(rKey, JSON.stringify(m.gameResultsToday[gk]));
                                        }
                                    });
                                }
                            }
                        }
                    } catch (memErr) {
                        console.warn('[Cendekia Central] Restore cloud memory warn:', memErr);
                    }

                    // Evaluasi ulang streak berbasis cloud data terbaru
                    checkStreak(currentUser);
                    saveUser(currentUser, true);
                    updateDOMStats();
                    scheduleCloudMemorySync();

                    if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('cendekia:synced', { detail: currentUser }));
                    }
                }
            });
        } catch (err) {
            console.warn('[Cendekia Central] Auth listener warn:', err);
        }
    }

    // 11. FIREBASE BRIDGE, BAHAN AJAR, & GENERATOR SOAL 24 JAM
    let _fbCache = null;
    async function getFirebaseBridge() {
        if (_fbCache) return _fbCache;
        try {
            const fbConfig = await import('/js/firebase-config.js');
            const firestore = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
            _fbCache = {
                db: fbConfig.db,
                auth: fbConfig.auth,
                storage: fbConfig.storage,
                ...firestore
            };
            return _fbCache;
        } catch (err) {
            console.warn('[Cendekia Central] Gagal inisialisasi Firebase Bridge:', err);
            return null;
        }
    }

    // Helper format cerdas materi kurikulum: Mengubah Markdown / poin-poin menjadi elemen HTML modern yang rapi dan terstruktur
    function renderFormattedMaterial(rawContent) {
        if (!rawContent || typeof rawContent !== 'string') return '';

        const lines = rawContent.trim().split(/\r?\n/);
        let html = '<div class="mat-structured-wrapper">';
        let inList = false;
        let listType = ''; // 'bullet' or 'number'

        const closeListIfNeeded = () => {
            if (inList) {
                html += `</div>`; // tutup list container
                inList = false;
                listType = '';
            }
        };

        const formatInline = (text) => {
            if (!text) return '';
            return text
                // Bold: **text** atau __text__
                .replace(/\*\*(.*?)\*\*/g, '<strong class="mat-term-highlight">$1</strong>')
                .replace(/__(.*?)__/g, '<strong class="mat-term-highlight">$1</strong>')
                // Italic: *text* atau _text_
                .replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, '<em class="mat-term-italic">$1</em>')
                .replace(/(?<!_)_(?!_)(.*?)(?<!_)_(?!_)/g, '<em class="mat-term-italic">$1</em>')
                // Inline code / keyword: `text`
                .replace(/`([^`]+)`/g, '<code class="mat-code-tag">$1</code>');
        };

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            if (!line) {
                closeListIfNeeded();
                continue;
            }

            // 1. Heading H3 / H2 / H4
            if (/^#{1,4}\s+/.test(line)) {
                closeListIfNeeded();
                const headingText = formatInline(line.replace(/^#{1,4}\s+/, ''));
                html += `
                    <div class="mat-section-header">
                        <div class="mat-section-icon"><i data-lucide="bookmark" style="width:14px; height:14px;"></i></div>
                        <h3 class="mat-heading-text">${headingText}</h3>
                    </div>
                `;
                continue;
            }

            // 2. Callout / Catatan Kritis (> atau Tips: atau Catatan:)
            if (/^>\s+/.test(line) || /^(Catatan|Tips|Penting|Perhatian)\s*:\s*/i.test(line)) {
                closeListIfNeeded();
                let cleanCallout = line.replace(/^>\s+/, '');
                html += `
                    <div class="mat-callout-card">
                        <div class="mat-callout-icon"><i data-lucide="sparkles" style="width:16px; height:16px;"></i></div>
                        <div class="mat-callout-body">${formatInline(cleanCallout)}</div>
                    </div>
                `;
                continue;
            }

            // 3. Bullet points (- atau * atau •)
            if (/^[-*•]\s+/.test(line)) {
                if (!inList || listType !== 'bullet') {
                    closeListIfNeeded();
                    inList = true;
                    listType = 'bullet';
                    html += `<div class="mat-list-container mat-bullet-group">`;
                }
                const bulletText = formatInline(line.replace(/^[-*•]\s+/, ''));
                html += `
                    <div class="mat-bullet-item">
                        <span class="mat-bullet-dot"><i data-lucide="check" style="width:11px; height:11px;"></i></span>
                        <div class="mat-point-text">${bulletText}</div>
                    </div>
                `;
                continue;
            }

            // 4. Numbered list (1. , 2. , dst)
            if (/^\d+\.\s+/.test(line)) {
                if (!inList || listType !== 'number') {
                    closeListIfNeeded();
                    inList = true;
                    listType = 'number';
                    html += `<div class="mat-list-container mat-number-group">`;
                }
                const numMatch = line.match(/^(\d+)\.\s+/);
                const num = numMatch ? numMatch[1] : '•';
                const numText = formatInline(line.replace(/^\d+\.\s+/, ''));
                html += `
                    <div class="mat-number-item">
                        <span class="mat-number-badge">${num}</span>
                        <div class="mat-point-text">${numText}</div>
                    </div>
                `;
                continue;
            }

            // 5. Paragraf biasa
            closeListIfNeeded();
            html += `<p class="mat-paragraph">${formatInline(line)}</p>`;
        }

        closeListIfNeeded();
        html += '</div>';

        // Trigger Lucide icon parsing if available
        setTimeout(() => {
            if (window.lucide && typeof window.lucide.createIcons === 'function') {
                window.lucide.createIcons();
            }
        }, 50);

        return html;
    }

    function normalizeCategoryKey(rawCat, docId = '') {
        const val = String(rawCat || docId || '').toLowerCase();
        if (val.includes('umum')) return 'pengetahuan-umum';
        if (val.includes('inti')) return 'pengetahuan-inti';
        if (val.includes('khusus')) return 'pengetahuan-khusus';
        if (val.includes('mendalam')) return 'pengetahuan-mendalam';
        return val || 'pengetahuan-umum';
    }

    // Ambil seluruh bahan ajar yang sudah diunggah oleh admin (mendukung multi-materi per kategori)
    async function getAllMaterials() {
        try {
            const fb = await getFirebaseBridge();
            if (!fb) return [];
            const q = await fb.getDocs(fb.collection(fb.db, "mem_free_materials"));
            const list = [];
            q.forEach(d => {
                const data = d.data();
                if (data && data.content && data.content.trim().length > 0) {
                    const normCat = normalizeCategoryKey(data.category, d.id);
                    list.push({
                        ...data,
                        id: d.id,
                        docId: d.id,
                        category: normCat
                    });
                }
            });
            // Urutkan deterministik berdasarkan createdAt / id agar index rolling stabil untuk semua siswa
            list.sort((a, b) => {
                const ta = new Date(a.createdAt || a.updatedAt || 0).getTime();
                const tb = new Date(b.createdAt || b.updatedAt || 0).getTime();
                if (ta !== tb) return ta - tb;
                return String(a.id).localeCompare(String(b.id));
            });
            return list;
        } catch (err) {
            console.error('[Cendekia Central] Gagal membaca daftar bahan ajar:', err);
            return [];
        }
    }

    // Ambil seluruh daftar materi dalam satu kategori tertentu
    async function getMaterialsByCategory(categoryId) {
        const normTarget = normalizeCategoryKey(categoryId);
        const all = await getAllMaterials();
        return all.filter(m => m.category === normTarget);
    }

    // Ambil materi spesifik (jika ?id= diberikan) ATAU rolling otomatis harian per-siswa dari bank kategori
    async function getMaterialByCategory(categoryId, specificDocId = null) {
        try {
            const fb = await getFirebaseBridge();
            if (!fb) return null;

            // 1. Jika ada permintaan docId spesifik (misal klik dari Rekomendasi Modul)
            if (specificDocId) {
                try {
                    const directSnap = await fb.getDoc(fb.doc(fb.db, "mem_free_materials", specificDocId));
                    if (directSnap.exists()) {
                        const dt = directSnap.data();
                        if (dt && dt.content && dt.content.trim().length > 0) {
                            const normCat = normalizeCategoryKey(dt.category, directSnap.id);
                            const catAll = await getMaterialsByCategory(normCat);
                            const pos = catAll.findIndex(x => x.id === directSnap.id);
                            return {
                                ...dt,
                                id: directSnap.id,
                                docId: directSnap.id,
                                category: normCat,
                                _rollingMeta: {
                                    index: pos >= 0 ? pos + 1 : 1,
                                    total: Math.max(1, catAll.length),
                                    dateKey: getTodayDateKeyWIB(),
                                    isDirectPick: true
                                }
                            };
                        }
                    }
                } catch (e) {}
            }

            // 2. Ambil seluruh materi pada kategori tersebut untuk di-rolling harian per-siswa
            const catList = await getMaterialsByCategory(categoryId);
            if (!catList || catList.length === 0) {
                // Fallback cek dokumen legacy persis sesuai categoryId
                const legacySnap = await fb.getDoc(fb.doc(fb.db, "mem_free_materials", categoryId));
                if (legacySnap.exists()) {
                    return {
                        ...legacySnap.data(),
                        id: legacySnap.id,
                        docId: legacySnap.id,
                        category: normalizeCategoryKey(legacySnap.data().category, legacySnap.id),
                        _rollingMeta: { index: 1, total: 1, dateKey: getTodayDateKeyWIB() }
                    };
                }
                return null;
            }

            if (catList.length === 1) {
                return {
                    ...catList[0],
                    _rollingMeta: { index: 1, total: 1, dateKey: getTodayDateKeyWIB() }
                };
            }

            // 3. Rolling deterministik: berbeda antar-siswa & berganti otomatis setiap hari (00:00 WIB)
            const user = getUser();
            const userSeedStr = `${user.uid || user.email || 'guest'}_${normalizeCategoryKey(categoryId)}`;
            let userHash = 0;
            for (let i = 0; i < userSeedStr.length; i++) {
                userHash = ((userHash << 5) - userHash) + userSeedStr.charCodeAt(i);
                userHash |= 0;
            }
            const wibNow = getWIBDate();
            const daysSinceEpoch = Math.floor(Date.UTC(wibNow.getFullYear(), wibNow.getMonth(), wibNow.getDate()) / 86400000);
            const rollingIdx = (Math.abs(userHash) + daysSinceEpoch) % catList.length;

            return {
                ...catList[rollingIdx],
                _rollingMeta: {
                    index: rollingIdx + 1,
                    total: catList.length,
                    dateKey: getTodayDateKeyWIB(),
                    isRolling: true
                }
            };
        } catch (err) {
            console.error('[Cendekia Central] Gagal membaca materi:', err);
            return null;
        }
    }

    // Simpan / tambahkan bahan ajar materi baru ke Firestore (tanpa menimpa yang lama jika docId baru)
    async function saveMaterial(categoryId, materialData, existingDocId = null) {
        const fb = await getFirebaseBridge();
        if (!fb) throw new Error("Koneksi database tidak tersedia.");
        const normCat = normalizeCategoryKey(categoryId);
        const docId = existingDocId || `${normCat}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const docRef = fb.doc(fb.db, "mem_free_materials", docId);
        const nowIso = new Date().toISOString();
        await fb.setDoc(docRef, {
            id: docId,
            category: normCat,
            title: materialData.title || '',
            summary: materialData.summary || '',
            content: materialData.content || '',
            examples: materialData.examples || '',
            charCount: (materialData.content || '').length,
            createdAt: materialData.createdAt || nowIso,
            updatedAt: nowIso,
            updatedBy: fb.auth.currentUser?.email || 'admin'
        });
        return docId;
    }

    // Hapus materi spesifik dari Firestore berdasarkan docId
    async function deleteMaterial(docId) {
        const fb = await getFirebaseBridge();
        if (!fb) throw new Error("Koneksi database tidak tersedia.");
        await fb.deleteDoc(fb.doc(fb.db, "mem_free_materials", docId));
        return true;
    }

    // ========================================================
    // SIKLUS WAKTU INDONESIA BARAT (WIB) & RESET JAM 00:00 WIB
    // ========================================================
    function getWIBDate() {
        const now = new Date();
        const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
        return new Date(utcTime + (7 * 3600000));
    }

    function getTodayDateKeyWIB() {
        const wib = getWIBDate();
        const yyyy = wib.getFullYear();
        const mm = String(wib.getMonth() + 1).padStart(2, '0');
        const dd = String(wib.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }

    function getNextMidnightWIBTimestamp() {
        const wib = getWIBDate();
        const nextMidnightWib = new Date(wib);
        nextMidnightWib.setDate(nextMidnightWib.getDate() + 1);
        nextMidnightWib.setHours(0, 0, 0, 0);

        const diffMs = nextMidnightWib.getTime() - wib.getTime();
        return Date.now() + diffMs;
    }

    function formatCountdownToMidnightWIB() {
        const wib = getWIBDate();
        const nextMidnightWib = new Date(wib);
        nextMidnightWib.setDate(nextMidnightWib.getDate() + 1);
        nextMidnightWib.setHours(0, 0, 0, 0);

        const diffMs = Math.max(0, nextMidnightWib.getTime() - wib.getTime());
        const hrs = Math.floor(diffMs / 3600000);
        const mins = Math.floor((diffMs % 3600000) / 60000);
        const secs = Math.floor((diffMs % 60000) / 1000);
        return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    
    // ========================================================
    // BANK SOAL TERPUSAT, ANTI-REPETISI 7 HARI & SELEKSI MODE
    // ========================================================
    const DEFAULT_BANK_KUIS_PINTAR = [
    {
        "id": "kp_s_1",
        "difficulty": "santai",
        "question": "Manakah penulisan kata baku yang tepat menurut Pedoman Umum Ejaan Bahasa Indonesia (EYD V)?",
        "options": [
            "Antri",
            "Antre",
            "Antree",
            "Ngangtri"
        ],
        "correctIndex": 1,
        "explanation": "Bentuk baku menurut KBBI dan EYD V adalah 'antre', bukan 'antri'. Kata turunannya adalah 'mengantre'."
    },
    {
        "id": "kp_s_2",
        "difficulty": "santai",
        "question": "Penulisan kata depan 'di' yang menunjukkan keterangan tempat yang benar adalah...",
        "options": [
            "di rumah",
            "dirumah",
            "di-rumah",
            "dirumahkan"
        ],
        "correctIndex": 0,
        "explanation": "Kata depan 'di' yang menyatakan arah atau lokasi tempat ditulis terpisah dari kata yang mengikutinya ('di rumah')."
    },
    {
        "id": "kp_s_3",
        "difficulty": "santai",
        "question": "Manakah kalimat berikut yang menggunakan huruf kapital secara tepat?",
        "options": [
            "Ibu membeli jeruk bali di pasar tradisional.",
            "Ibu membeli jeruk Bali di pasar tradisional.",
            "Ibu membeli Jeruk bali di pasar Tradisional.",
            "Ibu membeli Jeruk Bali Di Pasar Tradisional."
        ],
        "correctIndex": 0,
        "explanation": "Nama jenis tanaman atau buah tidak ditulis dengan huruf kapital meskipun menggunakan nama geografi ('jeruk bali', 'kunci inggris', 'pisang ambon')."
    },
    {
        "id": "kp_s_4",
        "difficulty": "santai",
        "question": "Bentuk kata serapan yang baku di bawah ini adalah...",
        "options": [
            "Praktek",
            "Praktik",
            "Praktekan",
            "Praktikan"
        ],
        "correctIndex": 1,
        "explanation": "Bentuk baku serapan dari bahasa Belanda 'praktijk' adalah 'praktik' (menggunakan fonem 'i'). Kata turunannya adalah 'praktikum'."
    },
    {
        "id": "kp_s_5",
        "difficulty": "santai",
        "question": "Unsur intrinsik karya sastra yang merupakan ide pokok atau gagasan sentral yang menjiwai seluruh cerita disebut...",
        "options": [
            "Amanat",
            "Latar",
            "Tema",
            "Sudut Pandang"
        ],
        "correctIndex": 2,
        "explanation": "Tema adalah gagasan pokok atau landasan konseptual utama yang melandasi jalannya suatu cerita sastra."
    },
    {
        "id": "kp_s_6",
        "difficulty": "santai",
        "question": "Manakah pasangan kata baku dan tidak baku berikut yang paling tepat?",
        "options": [
            "Izin (baku) - Ijin (tidak baku)",
            "Nasehat (baku) - Nasihat (tidak baku)",
            "Jaman (baku) - Zaman (tidak baku)",
            "Faham (baku) - Paham (tidak baku)"
        ],
        "correctIndex": 0,
        "explanation": "Bentuk baku adalah 'izin' dengan fonem 'z', sedangkan 'ijin' merupakan bentuk tidak baku."
    },
    {
        "id": "kp_s_7",
        "difficulty": "santai",
        "question": "Gaya bahasa yang membandingkan benda mati seolah-olah memiliki sifat dan perilaku seperti manusia disebut...",
        "options": [
            "Metafora",
            "Personifikasi",
            "Hiperbola",
            "Litotes"
        ],
        "correctIndex": 1,
        "explanation": "Personifikasi adalah majas yang memberikan sifat-sifat insani kepada benda mati atau gagasan abstrak (contoh: 'angin berbisik lembut')."
    },
    {
        "id": "kp_s_8",
        "difficulty": "santai",
        "question": "Penulisan gabungan kata yang sudah padu senyawa dan harus ditulis serangkai adalah...",
        "options": [
            "tanda tangan",
            "tanggung jawab",
            "olahraga",
            "terima kasih"
        ],
        "correctIndex": 2,
        "explanation": "'Olahraga' ditulis serangkai karena sudah dianggap senyawa padu, sedangkan 'tanda tangan', 'tanggung jawab', dan 'terima kasih' ditulis terpisah."
    },
    {
        "id": "kp_s_9",
        "difficulty": "santai",
        "question": "Manakah penggunaan tanda koma (,) yang benar dalam kalimat majemuk bertingkat?",
        "options": [
            "Karena hujan lebat, jalanan protokol menjadi macet parah.",
            "Jalanan protokol menjadi macet parah, karena hujan lebat.",
            "Karena hujan lebat jalanan protokol, menjadi macet parah.",
            "Jalanan protokol, menjadi macet parah karena hujan lebat."
        ],
        "correctIndex": 0,
        "explanation": "Jika anak kalimat mendahului induk kalimat, tanda koma wajib diletakkan di antara anak kalimat dan induk kalimat."
    },
    {
        "id": "kp_s_10",
        "difficulty": "santai",
        "question": "Pilihan kata yang tepat dan selaras dalam penggunaannya untuk mengungkapkan gagasan dalam karya tulis disebut...",
        "options": [
            "Sintaksis",
            "Diksi",
            "Morfologi",
            "Fonologi"
        ],
        "correctIndex": 1,
        "explanation": "Diksi adalah ketepatan pemilihan dan penggunaan kata oleh penulis untuk menyatakan gagasan dan memberikan efek estetis tertentu."
    },
    {
        "id": "kp_s_11",
        "difficulty": "santai",
        "question": "Bentuk kata ulang berikut yang bermakna 'saling' adalah...",
        "options": [
            "Rumah-rumah",
            "Tarik-menarik",
            "Kemerah-merahan",
            "Pohon-pohonan"
        ],
        "correctIndex": 1,
        "explanation": "'Tarik-menarik' adalah bentuk perulangan kata berimbuhan yang bermakna resiprokal atau saling melakukan pekerjaan."
    },
    {
        "id": "kp_s_12",
        "difficulty": "santai",
        "question": "Manakah penulisan gelar akademik yang sesuai dengan kaidah EYD V?",
        "options": [
            "Dr. Budi Santoso, S.Pd.",
            "Dr Budi Santoso S.Pd",
            "Dr. Budi Santoso, SPd",
            "Dr. Budi Santoso S.Pd."
        ],
        "correctIndex": 0,
        "explanation": "Gelar akademik di belakang nama dipisahkan tanda koma dan tiap singkatan kata diakhiri tanda titik ('S.Pd.')."
    },
    {
        "id": "kp_s_13",
        "difficulty": "santai",
        "question": "Kata penghubung antarparagraf yang tepat untuk menunjukkan hubungan pertentangan adalah...",
        "options": [
            "Selain itu",
            "Oleh karena itu",
            "Namun demikian",
            "Sebagai kesimpulan"
        ],
        "correctIndex": 2,
        "explanation": "'Namun demikian' atau 'Meskipun demikian' digunakan sebagai konjungsi antarkalimat/antarparagraf yang menyatakan pertentangan."
    },
    {
        "id": "kp_s_14",
        "difficulty": "santai",
        "question": "Pesan moral atau ajaran kebaikan yang ingin disampaikan pengarang kepada pembaca dalam karya fiksi disebut...",
        "options": [
            "Amanat",
            "Sudut pandang",
            "Konflik",
            "Klimaks"
        ],
        "correctIndex": 0,
        "explanation": "Amanat adalah pesan moral atau nilai keteladanan yang disampaikan pengarang melalui jalan cerita."
    },
    {
        "id": "kp_s_15",
        "difficulty": "santai",
        "question": "Penulisan partikel '-pun' yang tepat berikut ini adalah...",
        "options": [
            "Meskipun hari hujan, dia tetap datang.",
            "Meski pun hari hujan, dia tetap datang.",
            "Walau pun hari hujan, dia tetap datang.",
            "Kapan pun dia datang, saya selalu ada."
        ],
        "correctIndex": 0,
        "explanation": "Partikel 'pun' pada kata penghubung yang lazim ditulis serangkai seperti 'meskipun', 'walaupun', 'bagaimanapun', 'sungguhpun'."
    },
    {
        "id": "kp_t_1",
        "difficulty": "tantangan",
        "question": "Perhatikan kalimat: 'Meskipun pembangunan gedung perpustakaan itu terhambat, tetapi anggaran renovasi tetap dialokasikan secara penuh.' Kesalahan utama pada kalimat majemuk bertingkat di atas adalah...",
        "options": [
            "Penggunaan konjungsi ganda yang menyebabkan kalimat tidak memiliki induk kalimat mandiri.",
            "Penulisan kata 'perpustakaan' yang seharusnya diawali huruf kapital.",
            "Penggunaan tanda koma sebelum kata 'tetapi' yang seharusnya dihilangkan.",
            "Pemilihan kata 'dialokasikan' yang tidak sesuai dengan kaidah pembentukan kata kerja pasif."
        ],
        "correctIndex": 0,
        "explanation": "Konjungsi subordinatif konsesif 'meskipun' tidak boleh disandingkan dengan konjungsi koordinatif 'tetapi' dalam satu kalimat karena membuat kalimat kehilangan induk kalimat (kehilangan klausul bebas)."
    },
    {
        "id": "kp_t_2",
        "difficulty": "tantangan",
        "question": "Kalimat di bawah ini yang memenuhi prinsip keparalelan bentuk (kesejajaran gramatikal) dalam kalimat efektif adalah...",
        "options": [
            "Kegiatan literasi di sekolah meliputi membaca buku, pembuatan resensi naskah, dan berdiskusi kelompok.",
            "Kegiatan literasi di sekolah meliputi membaca buku, membuat resensi naskah, dan mendiskusikan gagasan kelompok.",
            "Kegiatan literasi di sekolah meliputi pembacaan buku, membuat resensi naskah, dan berdiskusi kelompok.",
            "Kegiatan literasi di sekolah meliputi dibacanya buku, pembuatan resensi naskah, dan mendiskusikan gagasan."
        ],
        "correctIndex": 1,
        "explanation": "Keparalelan mensyaratkan bentuk verba yang setara: 'membaca', 'membuat', dan 'mendiskusikan' (semuanya verba aktif transitif berprefiks me-)."
    },
    {
        "id": "kp_t_3",
        "difficulty": "tantangan",
        "question": "Manakah kalimat yang bebas dari unsur kemubaziran kata (pleonasme)?",
        "options": [
            "Semua para siswa berkumpul di aula utama sekolah.",
            "Peserta seminar diminta untuk maju ke depan panggung.",
            "Kita harus saling tolong-menolong dalam kebajikan.",
            "Para cendekiawan berkumpul di aula utama perpustakaan."
        ],
        "correctIndex": 3,
        "explanation": "Kalimat 'Para cendekiawan berkumpul...' hemat dan cermat. Opsi lain mengandung pleonasme: 'semua para', 'maju ke depan', dan 'saling tolong-menolong'."
    },
    {
        "id": "kp_t_4",
        "difficulty": "tantangan",
        "question": "Perhatikan kalimat: 'Karena sering terlambat mengumpulkan naskah antologi, redaktur majalah sastra itu menegurnya secara lisan.' Subjek pada anak kalimat di atas adalah...",
        "options": [
            "Redaktur majalah sastra",
            "Naskah antologi",
            "Bersifat implisit mengacu pada pihak yang ditegur (dia)",
            "Terlambat mengumpulkan"
        ],
        "correctIndex": 2,
        "explanation": "Anak kalimat 'Karena sering terlambat mengumpulkan naskah antologi' mengalami pelesapan subjek yang secara anaforis merujuk kepada pronomina persona orang ketiga yang menjadi objek teguran."
    },
    {
        "id": "kp_t_5",
        "difficulty": "tantangan",
        "question": "Majas yang memperlihatkan pertentangan nyata antara dua hal yang tampak mustahil atau bertolak belakang namun sesungguhnya mengandung kebenaran mendalam disebut...",
        "options": [
            "Oksimoron",
            "Paradoks",
            "Antitesis",
            "Sinekdoke"
        ],
        "correctIndex": 1,
        "explanation": "Paradoks adalah majas yang memuat pertentangan semu antara fakta yang tampak kontradiktif dengan kebenaran hakiki (contoh: 'Ia merasa kesepian di tengah hiruk-pikuk pesta kota metropolitan')."
    },
    {
        "id": "kp_t_6",
        "difficulty": "tantangan",
        "question": "Manakah penulisan kata berimbuhan gabungan (konfiks) pada kata dasar majemuk yang tepat?",
        "options": [
            "Menandatangani, pertanggungjawaban, mengkambinghitamkan",
            "Menanda tangani, pertanggung jawaban, mengkambing hitamkan",
            "Menandatangani, pertanggung jawaban, mengambinghitamkan",
            "Menandatangani, pertanggungjawaban, mengambinghitamkan"
        ],
        "correctIndex": 3,
        "explanation": "Jika gabungan kata mendapat awalan dan akhiran sekaligus (konfiks), penulisannya diserangkai: 'menandatangani', 'pertanggungjawaban', dan fonem /k/ pada 'kambing' luluh menjadi 'mengambinghitamkan'."
    },
    {
        "id": "kp_t_7",
        "difficulty": "tantangan",
        "question": "Penggunaan tanda titik koma (;) yang tepat menurut kaidah EYD V adalah...",
        "options": [
            "Ibu membeli apel; jeruk; dan anggur di pasar swalayan.",
            "Hari sudah malam; anak-anak masih asyik menyelesaikan cerpennya.",
            "Dia sangat rajin membaca buku; sehingga nilainya selalu memuaskan.",
            "Meskipun sudah larut malam; dia belum tidur."
        ],
        "correctIndex": 1,
        "explanation": "Tanda titik koma dapat dipakai sebagai pengganti kata penghubung untuk memisahkan kalimat setara di dalam kalimat majemuk."
    },
    {
        "id": "kp_t_8",
        "difficulty": "tantangan",
        "question": "Kalimat di bawah ini yang memiliki struktur sintaksis yang rancu (kontaminasi) adalah...",
        "options": [
            "Dalam buku ini membahas problematika pendidikan pedesaan.",
            "Buku ini membahas problematika pendidikan pedesaan.",
            "Di dalam buku ini dibahas problematika pendidikan pedesaan.",
            "Penulis membahas problematika pendidikan pedesaan di dalam buku ini."
        ],
        "correctIndex": 0,
        "explanation": "Kalimat 'Dalam buku ini membahas...' kehilangan subjek karena predikat transitif 'membahas' didahului frasa preposisional 'dalam buku ini'."
    },
    {
        "id": "kp_t_9",
        "difficulty": "tantangan",
        "question": "Penyerapan istilah asing yang mengadaptasi ejaan dan lafal Indonesia secara tepat terdapat pada kata...",
        "options": [
            "Standarisasi",
            "Kwalitas",
            "Fasilitir",
            "Standarisasi",
            "Standardisasi"
        ],
        "correctIndex": 4,
        "explanation": "Bentuk baku serapan dari 'standardization' adalah 'standardisasi' (bukan standarisasi), karena imbuhan -isasi diserap dari -ization pada kata dasar standard."
    },
    {
        "id": "kp_t_10",
        "difficulty": "tantangan",
        "question": "Perhatikan teks cerpen: 'Matanya menatap jendela yang basah oleh rinai gerimis. Dalam benaknya, ingatan tentang masa kecil di tepi Sungai Musi mendadak meluap.' Sudut pandang yang digunakan oleh pengarang adalah...",
        "options": [
            "Orang pertama pelaku utama",
            "Orang pertama pelaku sampingan",
            "Orang ketiga serbatahu (omniscien)",
            "Orang ketiga pengamat terbatas"
        ],
        "correctIndex": 2,
        "explanation": "Pengarang menggunakan kata ganti orang ketiga ('matanya', 'benaknya') dan mengetahui isi pikiran serta gejolak batin tokoh secara bebas (sudut pandang serbatahu)."
    },
    {
        "id": "kp_t_11",
        "difficulty": "tantangan",
        "question": "Penulisan bilangan dan lambang angka yang benar sesuai kaidah EYD V adalah...",
        "options": [
            "15 orang peserta seminar sastra berhasil mendapatkan piagam kehormatan.",
            "Sebanyak 15 orang peserta seminar sastra berhasil mendapatkan piagam kehormatan.",
            "Sebanyak lima belas peserta seminar sastra berhasil mendapatkan piagam kehormatan.",
            "Peserta seminar sastra yang hadir berjumlah 15 orang."
        ],
        "correctIndex": 1,
        "explanation": "Bilangan pada awal kalimat tidak boleh ditulis dengan lambang angka. Jika awal kalimat harus memuat angka besar, susunan kalimat diubah atau didahului kata keterangan (misal: 'Sebanyak 15 orang...')."
    },
    {
        "id": "kp_t_12",
        "difficulty": "tantangan",
        "question": "Manakah frasa berikut yang tergolong idiom (ungkapan kiasan)?",
        "options": [
            "Meja hijau",
            "Buku tebal",
            "Rumah megah",
            "Kertas putih"
        ],
        "correctIndex": 0,
        "explanation": "'Meja hijau' merupakan ungkapan idiomatis yang bermakna pengadilan, bukan meja yang dicat warna hijau secara harfiah."
    },
    {
        "id": "kp_t_13",
        "difficulty": "tantangan",
        "question": "Bentuk penulisan kata ulang gabungan dengan kata berimbuhan berikut yang paling tepat adalah...",
        "options": [
            "Surat-surat kabar",
            "Surat kabar-surat kabar",
            "Surat kabar-kabar",
            "Surat kabar-kabaran"
        ],
        "correctIndex": 0,
        "explanation": "Bentuk jamak dari kata majemuk diulang pada unsur pertamanya: 'surat-surat kabar', 'kereta-kereta api', 'meja-meja tulis'."
    },
    {
        "id": "kp_t_14",
        "difficulty": "tantangan",
        "question": "Perbedaan mendasar antara kalimat fakta dan kalimat opini dalam artikel adalah...",
        "options": [
            "Fakta bersifat subjektif dan memuat saran, opini bersifat objektif dan memuat data.",
            "Fakta memuat data terverifikasi dan kenyataan empiris, opini memuat pendapat, tafsiran, atau penilaian pribadi.",
            "Fakta selalu menggunakan kata kerja aktif, sedangkan opini selalu menggunakan kata kerja pasif.",
            "Fakta hanya terdapat di paragraf pembuka, sedangkan opini selalu di paragraf penutup."
        ],
        "correctIndex": 1,
        "explanation": "Fakta berlandaskan kenyataan objektif dan data yang dapat dibuktikan kebenarannya, sedangkan opini berisi sikap, pandangan, atau interpretasi subjektif penulis."
    },
    {
        "id": "kp_t_15",
        "difficulty": "tantangan",
        "question": "Ciri utama dari struktur teks argumentasi yang kokoh adalah...",
        "options": [
            "Mengutamakan keindahan rima dan bait puisi.",
            "Menyajikan tesis, argumen logis yang ditopang fakta/data valid, serta simpulan penegasan.",
            "Menyusun urutan dialog antar-tokoh fiktif dari awal sampai akhir.",
            "Menghadirkan kejutan di akhir cerita tanpa penjelasan logis."
        ],
        "correctIndex": 1,
        "explanation": "Teks argumentasi dibangun atas pernyataan sikap (tesis), rangkaian alasan logis berbasis pembuktian data faktual (argumen), dan penegasan kembali (kesimpulan)."
    }
];

    const DEFAULT_BANK_TEBAK_KATA = [
    {
        "id": "tk_s_1",
        "difficulty": "santai",
        "word": "LITERASI",
        "clue": "Kemampuan membaca, menulis, dan mengolah informasi secara kritis dalam kehidupan sehari-hari."
    },
    {
        "id": "tk_s_2",
        "difficulty": "santai",
        "word": "PUSTAKA",
        "clue": "Kitab atau buku tempat tersimpannya khazanah ilmu pengetahuan dan karya sastra."
    },
    {
        "id": "tk_s_3",
        "difficulty": "santai",
        "word": "AKSARA",
        "clue": "Sistem lambang atau grafem yang digunakan manusia untuk menuliskan bahasa dan ujaran."
    },
    {
        "id": "tk_s_4",
        "difficulty": "santai",
        "word": "NARASI",
        "clue": "Teks atau wacana yang menceritakan rangkaian peristiwa berdasarkan urutan waktu (kronologis)."
    },
    {
        "id": "tk_s_5",
        "difficulty": "santai",
        "word": "KALIMAT",
        "clue": "Satuan bahasa terkecil yang mengungkapkan pikiran utuh secara gramatikal dan intonasi."
    },
    {
        "id": "tk_s_6",
        "difficulty": "santai",
        "word": "METAFORA",
        "clue": "Majas kiasan perbandingan langsung tanpa kata pembanding (seperti, laksana, bagai)."
    },
    {
        "id": "tk_s_7",
        "difficulty": "santai",
        "word": "DIKSI",
        "clue": "Pilihan kata yang tepat dan selaras untuk mewakili gagasan atau nuansa emosi tertentu."
    },
    {
        "id": "tk_s_8",
        "difficulty": "santai",
        "word": "PUISI",
        "clue": "Bentuk karya sastra yang terikat oleh rima, matra, irama, bait, dan kepadatan makna."
    },
    {
        "id": "tk_s_9",
        "difficulty": "santai",
        "word": "CERPEN",
        "clue": "Cerita fiksi berbentuk prosa naratif pendek yang fokus pada satu peristiwa sentral tokoh."
    },
    {
        "id": "tk_s_10",
        "difficulty": "santai",
        "word": "SINONIM",
        "clue": "Bentuk bahasa yang maknanya mirip atau sama dengan bentuk bahasa yang lain."
    },
    {
        "id": "tk_s_11",
        "difficulty": "santai",
        "word": "ANTONIM",
        "clue": "Bentuk bahasa yang maknanya berlawanan atau berkebalikan dari bentuk bahasa lain."
    },
    {
        "id": "tk_s_12",
        "difficulty": "santai",
        "word": "PARAGRAF",
        "clue": "Bagian bab karangan yang memuat satu ide pokok dan beberapa kalimat pengembang."
    },
    {
        "id": "tk_s_13",
        "difficulty": "santai",
        "word": "RANGKUMAN",
        "clue": "Hasil menyarikan intisari atau pokok-pokok penting dari suatu wacana bacaan."
    },
    {
        "id": "tk_s_14",
        "difficulty": "santai",
        "word": "RINGKASAN",
        "clue": "Penyajian singkat karangan asli dengan mempertahankan urutan isi dan sudut pandang."
    },
    {
        "id": "tk_s_15",
        "difficulty": "santai",
        "word": "PROSA",
        "clue": "Karangan bebas yang tidak terikat oleh rima, bait, atau jumlah suku kata."
    },
    {
        "id": "tk_t_1",
        "difficulty": "tantangan",
        "word": "ARKAIS",
        "clue": "Kata atau ungkapan yang berhubungan dengan masa lampau dan tidak lazim digunakan lagi saat ini."
    },
    {
        "id": "tk_t_2",
        "difficulty": "tantangan",
        "word": "PARADOKS",
        "clue": "Pernyataan yang seolah-olah bertentangan dengan akal sehat namun mengandung kebenaran hakiki."
    },
    {
        "id": "tk_t_3",
        "difficulty": "tantangan",
        "word": "HIPERBOLA",
        "clue": "Gaya bahasa yang melebih-lebihkan suatu kenyataan hingga melampaui batas kewajaran."
    },
    {
        "id": "tk_t_4",
        "difficulty": "tantangan",
        "word": "EUFEMISME",
        "clue": "Penggunaan ungkapan yang lebih halus dan sopan untuk menggantikan kata yang dianggap kasar atau tabu."
    },
    {
        "id": "tk_t_5",
        "difficulty": "tantangan",
        "word": "ANALOGI",
        "clue": "Persamaan atau persesuaian antara dua benda atau hal yang berlainan untuk memperjelas konsep."
    },
    {
        "id": "tk_t_6",
        "difficulty": "tantangan",
        "word": "HOMONIM",
        "clue": "Kata yang sama lafal dan ejaannya, tetapi berbeda maknanya karena tidak seakar kata."
    },
    {
        "id": "tk_t_7",
        "difficulty": "tantangan",
        "word": "AMBIGUITAS",
        "clue": "Sifat atau keadaan yang bermakna ganda, kabur, atau menimbulkan lebih dari satu penafsiran."
    },
    {
        "id": "tk_t_8",
        "difficulty": "tantangan",
        "word": "PERSUASIF",
        "clue": "Sifat komunikasi yang bertujuan membujuk atau meyakinkan pembaca agar menyetujui pendapat penulis."
    },
    {
        "id": "tk_t_9",
        "difficulty": "tantangan",
        "word": "ELABORASI",
        "clue": "Penggarapan suatu gagasan secara tekun, mendalam, dan terperinci hingga tuntas."
    },
    {
        "id": "tk_t_10",
        "difficulty": "tantangan",
        "word": "REDUNDANSI",
        "clue": "Kelebihan pemakaian unsur bahasa yang tidak menambah kejelasan makna (kemubaziran)."
    },
    {
        "id": "tk_t_11",
        "difficulty": "tantangan",
        "word": "DEKONSTRUKSI",
        "clue": "Metode analisis sastra yang membongkar stabilitas makna teks untuk menguak kontradiksi tersembunyi."
    },
    {
        "id": "tk_t_12",
        "difficulty": "tantangan",
        "word": "EKSEGESIS",
        "clue": "Penjelasan kritis atau interpretasi mendalam terhadap teks sastra atau naskah kuno."
    },
    {
        "id": "tk_t_13",
        "difficulty": "tantangan",
        "word": "ONOMATOPE",
        "clue": "Penamaan benda atau perbuatan berdasarkan tiruan bunyi yang dihasilkannya (seperti desir, gemerisik)."
    },
    {
        "id": "tk_t_14",
        "difficulty": "tantangan",
        "word": "SOLILOKUI",
        "clue": "Monolog tokoh berbicara sendiri pada lakon sandiwara untuk mengungkapkan isi batin kepada penonton."
    },
    {
        "id": "tk_t_15",
        "difficulty": "tantangan",
        "word": "KATARSIS",
        "clue": "Pelepasan emosi, kelegaan batin, atau pemurnian jiwa yang dialami pembaca usai menyaksikan klimaks tragedi."
    }
];

    const DEFAULT_BANK_SUSUN_KATA = [
    {
        "id": "sk_s_1",
        "difficulty": "santai",
        "word": "BAHASA",
        "clue": "Sistem lambang bunyi arbitrer yang digunakan masyarakat untuk berinteraksi dan berkomunikasi."
    },
    {
        "id": "sk_s_2",
        "difficulty": "santai",
        "word": "SASTRA",
        "clue": "Karya tulisan yang memiliki nilai estetika, keindahan bahasa, dan kedalaman makna budi pekerti."
    },
    {
        "id": "sk_s_3",
        "difficulty": "santai",
        "word": "NOVEL",
        "clue": "Karangan prosa panjang yang mengandung rangkaian cerita kehidupan seseorang dengan orang di sekelilingnya."
    },
    {
        "id": "sk_s_4",
        "difficulty": "santai",
        "word": "TEMA",
        "clue": "Gagasan dasar atau ide sentral yang menopang keseluruhan cerita sastra."
    },
    {
        "id": "sk_s_5",
        "difficulty": "santai",
        "word": "ALUR",
        "clue": "Rangkaian jalinan peristiwa yang disusun berdasarkan hukum sebab-akibat (kausalitas)."
    },
    {
        "id": "sk_s_6",
        "difficulty": "santai",
        "word": "TOKOH",
        "clue": "Individu rekaan yang mengalami peristiwa atau berperilaku dalam berbagai babak cerita."
    },
    {
        "id": "sk_s_7",
        "difficulty": "santai",
        "word": "MAJAS",
        "clue": "Pemanfaatan kekayaan bahasa untuk memperoleh efek estetis dan memikat hati pembaca."
    },
    {
        "id": "sk_s_8",
        "difficulty": "santai",
        "word": "RIMBA",
        "clue": "Hutan lebat luas yang kerap menjadi latar petualangan kisah fiksi."
    },
    {
        "id": "sk_s_9",
        "difficulty": "santai",
        "word": "CITRA",
        "clue": "Gambaran angan indrawi yang dibangkitkan oleh rangkaian kata puitis dalam puisi."
    },
    {
        "id": "sk_s_10",
        "difficulty": "santai",
        "word": "RIMA",
        "clue": "Pengulangan bunyi yang berselang, baik di dalam larik maupun pada akhir larik sajak."
    },
    {
        "id": "sk_s_11",
        "difficulty": "santai",
        "word": "KALBU",
        "clue": "Pangkal perasaan batin atau hati nurani yang peka terhadap nilai estetis dan kebenaran."
    },
    {
        "id": "sk_s_12",
        "difficulty": "santai",
        "word": "KARYA",
        "clue": "Hasil ciptaan atau buah gagasan yang memiliki nilai estetika dan budi pekerti."
    },
    {
        "id": "sk_s_13",
        "difficulty": "santai",
        "word": "NASKAH",
        "clue": "Karangan atau draf tulisan yang disusun untuk diterbitkan atau dipentaskan di panggung."
    },
    {
        "id": "sk_s_14",
        "difficulty": "santai",
        "word": "DONGENG",
        "clue": "Cerita rakyat khayalan yang penuh keajaiban dan sarat akan pesan budi pekerti."
    },
    {
        "id": "sk_s_15",
        "difficulty": "santai",
        "word": "BABAK",
        "clue": "Bagian besar dalam lakon drama atau sandiwara yang menandai pergeseran peristiwa."
    },
    {
        "id": "sk_t_1",
        "difficulty": "tantangan",
        "word": "PROTAGONIS",
        "clue": "Tokoh utama dalam karya sastra yang menjadi pusat perhatian dan pembawa nilai positif."
    },
    {
        "id": "sk_t_2",
        "difficulty": "tantangan",
        "word": "INTRINSIK",
        "clue": "Unsur-unsur pembangun struktur karya sastra yang bersumber dari dalam naskah itu sendiri."
    },
    {
        "id": "sk_t_3",
        "difficulty": "tantangan",
        "word": "EKSTRINSIK",
        "clue": "Unsur di luar karya sastra seperti latar belakang pengarang dan nilai sosial budaya pengarang."
    },
    {
        "id": "sk_t_4",
        "difficulty": "tantangan",
        "word": "PANTUN",
        "clue": "Puisi lama Melayu yang tiap baitnya terdiri atas empat baris berima a-b-a-b (sampiran dan isi)."
    },
    {
        "id": "sk_t_5",
        "difficulty": "tantangan",
        "word": "SYAIR",
        "clue": "Puisi lama yang berasal dari tradisi Arab-Persia dengan pola rima akhir sama rata a-a-a-a."
    },
    {
        "id": "sk_t_6",
        "difficulty": "tantangan",
        "word": "SONETA",
        "clue": "Bentuk puisi empat belas baris yang terdiri atas dua quatrain dan dua terzina."
    },
    {
        "id": "sk_t_7",
        "difficulty": "tantangan",
        "word": "ALUSI",
        "clue": "Gaya bahasa kiasan yang menunjuk secara tidak langsung pada tokoh, peristiwa, atau mitos terkenal."
    },
    {
        "id": "sk_t_8",
        "difficulty": "tantangan",
        "word": "PLEONASME",
        "clue": "Pemakaian kata yang berlebih-lebihan yang sebenarnya tidak diperlukan dalam kalimat."
    },
    {
        "id": "sk_t_9",
        "difficulty": "tantangan",
        "word": "AFORISME",
        "clue": "Ungkapan ringkas padat yang menyatakan kebenaran umum atau prinsip moral kehidupan."
    },
    {
        "id": "sk_t_10",
        "difficulty": "tantangan",
        "word": "EKSPRESI",
        "clue": "Pengungkapan atau proses menyatakan perasaan, batin, dan gagasan melalui karya seni."
    },
    {
        "id": "sk_t_11",
        "difficulty": "tantangan",
        "word": "ANAKRONISME",
        "clue": "Ketidaksesuaian latar waktu, benda, atau peristiwa dengan era sejarah yang sedang dikisahkan."
    },
    {
        "id": "sk_t_12",
        "difficulty": "tantangan",
        "word": "POLISINDETON",
        "clue": "Gaya bahasa yang mempergunakan konjungsi secara berulang-ulang untuk memperlambat tempo narasi."
    },
    {
        "id": "sk_t_13",
        "difficulty": "tantangan",
        "word": "ALEGORI",
        "clue": "Cerita kiasan metaforis yang maknanya melambangkan ajaran moral atau kebenaran filosofis."
    },
    {
        "id": "sk_t_14",
        "difficulty": "tantangan",
        "word": "RETORIKA",
        "clue": "Keterampilan bertutur kata secara persuasif, logis, dan memikat daya pikat pendengar."
    },
    {
        "id": "sk_t_15",
        "difficulty": "tantangan",
        "word": "ASINDETON",
        "clue": "Gaya bahasa yang meniadakan kata penghubung antarunsur kalimat yang setara untuk mempercepat ritme."
    }
];

    const DEFAULT_BANK_TEKA_TEKI = [
    {
        "id": "tt_s_1",
        "difficulty": "santai",
        "prompt": "Aku memiliki lembaran putih tak bersuara, tetapi jika kau buka, aku berbicara tentang seribu cerita dan ilmu dunia. Siapakah aku?",
        "answer": "BUKU",
        "hint": "Benda berlembar-lembar kertas dijilid",
        "explanation": "Buku adalah kumpulan kertas berisi tulisan atau gambar yang menyimpan ilmu dan cerita."
    },
    {
        "id": "tt_s_2",
        "difficulty": "santai",
        "prompt": "Aku selalu berdiri di awal kalimat, memimpin rekan-rekanku dengan tubuh yang lebih tegak dan besar daripada huruf lainnya. Siapakah aku?",
        "answer": "KAPITAL",
        "hint": "Jenis huruf besar di awal kalimat",
        "explanation": "Huruf kapital digunakan sebagai huruf pertama pada awal kalimat menurut kaidah EYD V."
    },
    {
        "id": "tt_s_3",
        "difficulty": "santai",
        "prompt": "Bentukku bundar kecil tak kasat kata jika diucapkan, tetapi di akhir kalimat berita akulah yang menghentikan pembicaraan. Siapakah aku?",
        "answer": "TITIK",
        "hint": "Tanda baca pengakhir kalimat deklaratif",
        "explanation": "Tanda titik (.) dipakai pada akhir kalimat pernyataan atau deklaratif."
    },
    {
        "id": "tt_s_4",
        "difficulty": "santai",
        "prompt": "Aku hanya sebuah garis lengkung berkait ke bawah, tetapi berkatku pembaca dapat menarik napas sejenak sebelum kalimat selesai. Siapakah aku?",
        "answer": "KOMA",
        "hint": "Tanda jeda antarklausa",
        "explanation": "Tanda koma (,) berfungsi memberikan jeda pendek di antara unsur-unsur kalimat."
    },
    {
        "id": "tt_s_5",
        "difficulty": "santai",
        "prompt": "Aku diciptakan dari kata-kata yang singkat padat, penuh rima dan irama merdu yang menyentuh relung sanubari. Siapakah aku?",
        "answer": "SAJAK",
        "hint": "Persamaan bunyi atau sinonim puisi",
        "explanation": "Sajak adalah karya sastra berirama dan berima yang memadatkan curahan rasa."
    },
    {
        "id": "tt_s_6",
        "difficulty": "santai",
        "prompt": "Aku bertugas mengantar jalannya cerita, mulai dari orientasi, komplikasi, hingga resolusi akhir. Siapakah aku?",
        "answer": "ALUR",
        "hint": "Jalan rangkaian peristiwa cerita",
        "explanation": "Alur atau plot adalah rangkaian peristiwa yang membentuk suatu kesatuan cerita utuh."
    },
    {
        "id": "tt_s_7",
        "difficulty": "santai",
        "prompt": "Di dalam kamus aku bertahta sebagai tolok ukur kebenaran ejaan resmi bangsa. Kata apakah yang mengikutiku?",
        "answer": "BAKU",
        "hint": "Lawan dari kata tidak baku",
        "explanation": "Kata baku adalah ragam bahasa resmi yang sesuai dengan pedoman ejaan dan KBBI."
    },
    {
        "id": "tt_s_8",
        "difficulty": "santai",
        "prompt": "Aku adalah watak yang berdiri melawan tokoh utama, sering kali menebar konflik dan ketegangan naskah. Siapakah aku?",
        "answer": "ANTAGONIS",
        "hint": "Tokoh penentang tokoh utama",
        "explanation": "Antagonis adalah tokoh dalam karya sastra yang menjadi penentang protagonis."
    },
    {
        "id": "tt_s_9",
        "difficulty": "santai",
        "prompt": "Aku selalu mendahului nama tempat atau arah tujuan, tetapi jangan sambungkan tubuhku dengan kata setelahku. Siapakah aku?",
        "answer": "PREPOSISI",
        "hint": "Istilah tata bahasa untuk kata depan",
        "explanation": "Preposisi (seperti 'di', 'ke', 'dari') ditulis terpisah dari kata yang mengikutinya."
    },
    {
        "id": "tt_s_10",
        "difficulty": "santai",
        "prompt": "Aku terbit setiap hari atau pekanan, memuat berita terkini yang dicetak di atas lembaran kertas koran besar. Siapakah aku?",
        "answer": "KORAN",
        "hint": "Surat kabar harian",
        "explanation": "Koran atau surat kabar adalah media cetak berkala yang memuat warta berita."
    },
    {
        "id": "tt_s_11",
        "difficulty": "santai",
        "prompt": "Aku adalah tanda baca tegak lurus dengan titik di bawahnya, berseru memerintah atau meluapkan rasa kagum yang membara. Siapakah aku?",
        "answer": "SERU",
        "hint": "Tanda baca perintah atau kekaguman",
        "explanation": "Tanda seru (!) digunakan untuk mengakhiri kalimat seruan, perintah, atau luapan emosi."
    },
    {
        "id": "tt_s_12",
        "difficulty": "santai",
        "prompt": "Aku adalah buku tempat mengumpulkan coretan gagasan, bait puisi, dan sketsa cerita yang kau bawa ke mana pun kau melangkah. Siapakah aku?",
        "answer": "CATATAN",
        "hint": "Buku jurnal harian",
        "explanation": "Buku catatan adalah tempat menghimpun gagasan dan draf tulisan."
    },
    {
        "id": "tt_s_13",
        "difficulty": "santai",
        "prompt": "Bila dua kata bertemu membentuk arti baru yang berbeda dari asalnya, ilmu bahasa menyebutku sebagai kata...",
        "answer": "MAJEMUK",
        "hint": "Kata bentukan dari dua morfem bebas",
        "explanation": "Kata majemuk adalah gabungan dua kata dasar yang membentuk makna baru (contoh: rumah sakit, kacamata)."
    },
    {
        "id": "tt_s_14",
        "difficulty": "santai",
        "prompt": "Aku mengisahkan riwayat hidup seorang tokoh hebat yang ditulis oleh orang lain dari masa kecil hingga kesuksesannya. Siapakah aku?",
        "answer": "BIOGRAFI",
        "hint": "Riwayat hidup tokoh oleh orang lain",
        "explanation": "Biografi adalah karya tulis yang menceritakan riwayat hidup seseorang yang disusun oleh penulis lain."
    },
    {
        "id": "tt_s_15",
        "difficulty": "santai",
        "prompt": "Di dalam kalimat aku adalah pelaku yang melakukan tindakan atau berada dalam keadaan tertentu. Unsur apakah aku?",
        "answer": "SUBJEK",
        "hint": "Unsur inti kalimat selain predikat",
        "explanation": "Subjek adalah unsur pokok kalimat yang menjadi pokok pembicaraan atau pelaku tindakan."
    },
    {
        "id": "tt_t_1",
        "difficulty": "tantangan",
        "prompt": "Aku adalah puncak ketegangan tertinggi dalam drama atau novel, di mana nasib para tokoh dipertaruhkan sebelum lerai. Siapakah aku?",
        "answer": "KLIMAKS",
        "hint": "Titik puncak konflik cerita",
        "explanation": "Klimaks adalah titik balik atau momen paling intens dan menegangkan dalam perkembangan alur cerita."
    },
    {
        "id": "tt_t_2",
        "difficulty": "tantangan",
        "prompt": "Aku menyandingkan dua kata yang berlawanan arti secara berdampingan untuk menimbulkan kesan kontras yang tajam (seperti 'manis-getir'). Siapakah aku?",
        "answer": "OKSIMORON",
        "hint": "Gaya bahasa kontras berjejer",
        "explanation": "Oksimoron adalah majas yang menempatkan dua istilah berlawanan berdampingan untuk menciptakan kontras dramatis."
    },
    {
        "id": "tt_t_3",
        "difficulty": "tantangan",
        "prompt": "Aku berupa tulisan ulasan kritis mengenai kelebihan dan kelemahan suatu buku baru agar pembaca mengetahuinya. Siapakah aku?",
        "answer": "RESENSI",
        "hint": "Timbangan buku atau ulasan karya",
        "explanation": "Resensi adalah ulasan atau penilaian kritis terhadap kualitas suatu karya tulis atau buku."
    },
    {
        "id": "tt_t_4",
        "difficulty": "tantangan",
        "prompt": "Aku menyebutkan sebagian kecil untuk mewakili keseluruhan, atau menyebutkan seluruhnya untuk menggambarkan yang sedikit. Majas apakah aku?",
        "answer": "SINEKDOKE",
        "hint": "Majas pars pro toto dan totem pro parte",
        "explanation": "Sinekdoke adalah majas penyebutan sebagian untuk seluruhnya (pars pro toto) atau seluruhnya untuk sebagian (totem pro parte)."
    },
    {
        "id": "tt_t_5",
        "difficulty": "tantangan",
        "prompt": "Aku berbicara seolah-olah merendahkan diri, mengecilkan kenyataan agar tidak terkesan sombong di hadapan orang lain. Majas apakah aku?",
        "answer": "LITOTES",
        "hint": "Majas merendahkan diri secara santun",
        "explanation": "Litotes adalah majas yang menggunakan ungkapan penurunan kualitas atau merendahkan kenyataan untuk menjaga kesantunan."
    },
    {
        "id": "tt_t_6",
        "difficulty": "tantangan",
        "prompt": "Aku adalah himpunan kata-kata pilihan dari berbagai pengarang yang dibukukan menjadi satu jilid indah bernama...",
        "answer": "ANTOLOGI",
        "hint": "Bunga rampai karya sastra",
        "explanation": "Antologi (bunga rampai) adalah buku kumpulan karya sastra pilihan dari satu atau beberapa penulis."
    },
    {
        "id": "tt_t_7",
        "difficulty": "tantangan",
        "prompt": "Di balik karya fiksi, aku bersembunyi di balik nama samaran pengarang agar identitas asliku tetap rahasia. Apakah istilahku?",
        "answer": "PSEUDONIM",
        "hint": "Nama pena fiktif penulis",
        "explanation": "Pseudonim adalah nama samaran yang dipakai pengarang untuk menyamarkan identitas aslinya."
    },
    {
        "id": "tt_t_8",
        "difficulty": "tantangan",
        "prompt": "Aku adalah bagian babak pembuka dalam naskah drama yang bertugas memperkenalkan latar dan situasi awal tokoh. Siapakah aku?",
        "answer": "PROLOG",
        "hint": "Pengantar awal lakon drama",
        "explanation": "Prolog adalah pengantar naratif di awal naskah lakon atau sandiwara sastra."
    },
    {
        "id": "tt_t_9",
        "difficulty": "tantangan",
        "prompt": "Sebaliknya, akulah yang menutup pertunjukan panggung, menyampaikan simpulan pesan moral kepada para penonton. Siapakah aku?",
        "answer": "EPILOG",
        "hint": "Kata penutup lakon cerita",
        "explanation": "Epilog adalah bagian penutup naskah sastra yang memuat amanat akhir atau nasib para tokoh."
    },
    {
        "id": "tt_t_10",
        "difficulty": "tantangan",
        "prompt": "Aku adalah kumpulan kamus istilah khusus mengenai makna kata-kata sulit yang dicantumkan pada bagian akhir buku ilmiah. Siapakah aku?",
        "answer": "GLOSARIUM",
        "hint": "Daftar istilah dan artinya di belakang buku",
        "explanation": "Glosarium adalah daftar alfabetis kata-kata sulit atau istilah khusus beserta definisinya."
    },
    {
        "id": "tt_t_11",
        "difficulty": "tantangan",
        "prompt": "Aku adalah pengulangan konsonan bunyi yang sama secara beruntun pada satu larik sajak untuk menghasilkan efek musikalitas merdu. Gaya apakah aku?",
        "answer": "ALITERASI",
        "hint": "Purwakanti bunyi konsonan",
        "explanation": "Aliterasi adalah majas penegasan berupa perulangan bunyi konsonan yang sama pada kata-kata yang berurutan."
    },
    {
        "id": "tt_t_12",
        "difficulty": "tantangan",
        "prompt": "Sebaliknya, akulah yang mengulang bunyi vokal merdu di tengah baris sajak agar terdengar selaras di telinga pendengar. Gaya apakah aku?",
        "answer": "ASONANSI",
        "hint": "Perulangan bunyi vokal",
        "explanation": "Asonansi adalah majas berupa pengulangan bunyi vokal yang sama dalam deretan kata puisi."
    },
    {
        "id": "tt_t_13",
        "difficulty": "tantangan",
        "prompt": "Aku adalah bagian naskah lakon yang memuat percakapan antara dua tokoh atau lebih di atas panggung sandiwara. Istilahku adalah...",
        "answer": "DIALOG",
        "hint": "Percakapan antartokoh",
        "explanation": "Dialog adalah percakapan timbal balik antar-tokoh dalam karya drama atau narasi sastra."
    },
    {
        "id": "tt_t_14",
        "difficulty": "tantangan",
        "prompt": "Aku adalah ragam bahasa kiasan yang mengganti nama benda dengan nama jenama, atribut, atau ciri khas yang sangat lekat dengannya. Majas apakah aku?",
        "answer": "METONIMIA",
        "hint": "Majas bertaut jenama/atribut",
        "explanation": "Metonimia adalah majas yang menggunakan nama ciri atau label dagang suatu barang untuk menyebut barang itu sendiri."
    },
    {
        "id": "tt_t_15",
        "difficulty": "tantangan",
        "prompt": "Aku berupa ucapan atau tulisan persembahan di halaman depan buku sebagai tanda penghormatan pengarang kepada orang tercinta. Istilahku adalah...",
        "answer": "DEDIKASI",
        "hint": "Halaman persembahan buku",
        "explanation": "Dedikasi adalah lembar persembahan atau tanda penghormatan tulus pengarang dalam penerbitan karyanya."
    }
];

    const DEFAULT_BANK_TEBAK_SASTRA = [
        { id: "ts_s_1", difficulty: "santai", quote: "Aku ingin mencintaimu dengan sederhana: dengan kata yang tak sempat diucapkan kayu kepada api yang menjadikannya abu.", question: "Siapakah penyair legendaris penulis puisi 'Aku Ingin' di atas?", options: ["Sapardi Djoko Damono", "Chairil Anwar", "W.S. Rendra", "Goenawan Mohamad"], answer: 0, exp: "Puisi 'Aku Ingin' (1989) adalah mahakarya Sapardi Djoko Damono yang terkenal akan kesederhanaan diksi dan kedalaman metaforanya." },
        { id: "ts_s_2", difficulty: "santai", quote: "Kalau sampai waktuku, 'ku mau tak seorang 'kan merayu, tidak juga kau. Tak perlu sedu sedan itu. Aku ini binatang jalang...", question: "Kutipan puisi penuh semangat kebebasan berjudul 'Aku' tersebut merupakan karya...", options: ["Amir Hamzah", "Chairil Anwar", "Taufik Ismail", "Sutardji Calzoum Bachri"], answer: 1, exp: "Puisi 'Aku' (1943) adalah karya monumental Chairil Anwar, pelopor Angkatan '45 dalam sastra Indonesia." },
        { id: "ts_s_3", difficulty: "santai", quote: "Angin malam berbisik lirih di antara dedaunan cemara, menyampaikan salam dingin dari puncak bukit.", question: "Majas apakah yang dominan digunakan pada kutipan prosa di atas?", options: ["Hiperbola", "Personifikasi", "Ironi", "Litotes"], answer: 1, exp: "Personifikasi memberikan sifat insani ('berbisik', 'menyampaikan salam') kepada benda mati ('angin malam')." },
        { id: "ts_s_4", difficulty: "santai", quote: "Tuhan, kami telah terlalu banyak berdosa, namun pintu ampunan-Mu tetap terbuka bagai samudra tak bertepi.", question: "Gaya bahasa perbandingan yang menggunakan kata 'bagai' disebut majas...", options: ["Simile (Asosiasi)", "Metafora", "Metonimia", "Paradoks"], answer: 0, exp: "Simile membandingkan dua hal secara eksplisit menggunakan kata penghubung seperti 'bagai', 'laksana', 'bak', atau 'seperti'." },
        { id: "ts_s_5", difficulty: "santai", quote: "Ia bekerja membanting tulang dari fajar menyingsing hingga senja tenggelam demi pendidikan adik-adiknya.", question: "Ungkapan 'membanting tulang' dalam kalimat sastra tersebut bermakna...", options: ["Bekerja keras sekuat tenaga", "Berolahraga di pagi hari", "Beristirahat setelah lelah", "Menyerah pada keadaan"], answer: 0, exp: "Idiom 'membanting tulang' bermakna bekerja sangat keras untuk memenuhi kebutuhan hidup." },
        { id: "ts_s_6", difficulty: "santai", quote: "Laskar Pelangi menceritakan perjuangan sepuluh anak Belitung mempertahankan sekolah Muhammadiyah yang nyaris roboh.", question: "Siapakah novelis penulis 'Laskar Pelangi' yang mengangkat kisah pendidikan di Belitung?", options: ["Andrea Hirata", "Tere Liye", "Habiburrahman El Shirazy", "Ahmad Fuadi"], answer: 0, exp: "Andrea Hirata menulis tetralogi Laskar Pelangi (2005) yang terinspirasi dari masa kecilnya di Pulau Belitung." },
        { id: "ts_s_7", difficulty: "santai", quote: "Pena adalah pedang yang tak melukai raga, melainkan membelah gelapnya kebodohan sepanjang zaman.", question: "Perbandingan langsung 'Pena adalah pedang' tanpa kata pembanding merupakan majas...", options: ["Metafora", "Sinekdoke", "Eufemisme", "Aliterasi"], answer: 0, exp: "Metafora membandingkan dua objek secara langsung tanpa kata penghubung seperti 'bagai' atau 'seperti'." },
        { id: "ts_s_8", difficulty: "santai", quote: "Suaranya menggelegar membelah langit dan mengguncang seluruh penjuru negeri.", question: "Majas yang melebih-lebihkan kenyataan untuk efek dramatis pada kalimat di atas adalah...", options: ["Litotes", "Hiperbola", "Sarkasme", "Oksimoron"], answer: 1, exp: "Hiperbola adalah majas yang menyatakan sesuatu secara berlebih-lebihan melampaui batas kewajaran." },
        { id: "ts_s_9", difficulty: "santai", quote: "Terimalah pemberian kecil ini, sekadar pelepas dahaga di perjalanan panjangmu.", question: "Sikap merendahkan diri dengan mengecilkan nilai pemberian dalam sastra disebut majas...", options: ["Hiperbola", "Litotes", "Pleonasme", "Antitesis"], answer: 1, exp: "Litotes digunakan untuk merendahkan diri dengan mengungkapkan sesuatu yang lebih kecil dari keadaan sebenarnya." },
        { id: "ts_s_10", difficulty: "santai", quote: "Burung pun bernyanyi menyambut mentari pagi yang tersenyum ramah di ufuk timur.", question: "Citraan (imaji) utama yang dibangun oleh kalimat 'Burung pun bernyanyi' adalah...", options: ["Citraan pendengaran (auditif)", "Citraan pencecapan", "Citraan penciuman", "Citraan perabaan"], answer: 0, exp: "Citraan auditif mengajak pembaca seolah-olah mendengar bunyi atau suara dalam karya sastra." },
        { id: "ts_t_1", difficulty: "tantangan", quote: "Seseorang harus adil sejak dalam pikiran, apalagi dalam perbuatan.", question: "Kalimat filosofis terkenal ini berasal dari roman sejarah 'Bumi Manusia' karya...", options: ["Pramoedya Ananta Toer", "Mochtar Lubis", "Y.B. Mangunwijaya", "Nh. Dini"], answer: 0, exp: "Kutipan ini diucapkan Jean Marais kepada Minke dalam novel 'Bumi Manusia' karya Pramoedya Ananta Toer." },
        { id: "ts_t_2", difficulty: "tantangan", quote: "Kesepian yang ramai menghantui setiap sudut kota metropolitan di tengah gemerlap lampu neon.", question: "Penggabungan dua kata berlawanan makna secara berdampingan ('kesepian yang ramai') disebut majas...", options: ["Oksimoron", "Klimaks", "Anafora", "Alusi"], answer: 0, exp: "Oksimoron menempatkan dua unsur yang bertentangan secara langsung dalam satu frasa untuk efek makna mendalam." },
        { id: "ts_t_3", difficulty: "tantangan", quote: "Dari Sabang sampai Merauke, bendera berkibar megah; setiap pasang mata menatap penuh harap.", question: "Penggunaan frasa 'setiap pasang mata' untuk mewakili manusia secara keseluruhan merupakan majas...", options: ["Sinekdoke Pars Pro Toto", "Sinekdoke Totem Pro Parte", "Metonimia", "Antonomasia"], answer: 0, exp: "Pars pro toto menyebut sebagian ('sepasang mata') untuk menyatakan keseluruhan (seluruh manusia)." },
        { id: "ts_t_4", difficulty: "tantangan", quote: "Bukan beta bijak berperi, pandai menggubah madahan syair; bukan beta budak negeri, musti menurut undangan mair.", question: "Gaya perulangan kata di awal baris secara berturut-turut ('Bukan beta...') disebut majas...", options: ["Anafora", "Epifora", "Tautologi", "Asindeton"], answer: 0, exp: "Anafora adalah repetisi kata atau frasa yang sama pada awal larik atau kalimat berurutan." },
        { id: "ts_t_5", difficulty: "tantangan", quote: "Dalam novel 'Sitti Nurbaya', konflik utama berpusat pada pertentangan adat kawin paksa dengan semangat modernitas.", question: "Siapakah pengarang roman klasik Angkatan Balai Pustaka 'Sitti Nurbaya' (1922)?", options: ["Marah Rusli", "Abdul Muis", "Sutan Takdir Alisjahbana", "Merari Siregar"], answer: 0, exp: "Marah Rusli adalah penulis roman 'Sitti Nurbaya: Kasih Tak Sampai' yang terbit pada tahun 1922." },
        { id: "ts_t_6", difficulty: "tantangan", quote: "Ia duduk termangu di beranda senja, membiarkan kenangan lama mengetuk pelan pintu batinnya yang mulai berkarat.", question: "Sudut pandang (point of view) yang digunakan narator dalam penggalan cerita di atas adalah...", options: ["Orang ketiga serbatahu", "Orang pertama pelaku utama", "Orang pertama sampingan", "Orang kedua instruktif"], answer: 0, exp: "Penggunaan pronomina 'ia' dan pengetahuan narator atas kondisi batin tokoh menandakan sudut pandang orang ketiga serbatahu." },
        { id: "ts_t_7", difficulty: "tantangan", quote: "Puisi mantra yang membebaskan kata dari beban makna kamus demi energi bunyi dipelopori oleh penulis kumpulan 'O Amuk Kapak'.", question: "Siapakah penyair yang dikenal sebagai Presiden Penyair Indonesia lewat karya tersebut?", options: ["Sutardji Calzoum Bachri", "Joko Pinurbo", "Rendra", "Subagio Sastrowardoyo"], answer: 0, exp: "Sutardji Calzoum Bachri memperkenalkan kredo puisi mantra dalam kumpulan 'O, Amuk, Kapak'." },
        { id: "ts_t_8", difficulty: "tantangan", quote: "Rapi sekali tulisanmu hari ini, sampai-sampai butuh mikroskop dan penerjemah kuno untuk membacanya.", question: "Sindiran halus dengan menyatakan kebalikan dari maksud sebenarnya disebut majas...", options: ["Ironi", "Eufemisme", "Sinekdoke", "Inversi"], answer: 0, exp: "Ironi adalah gaya bahasa sindiran yang menyatakan hal bertolak belakang dengan kenyataan yang dimaksud." },
        { id: "ts_t_9", difficulty: "tantangan", quote: "Negeri ini bukan milik segelintir penguasa; negeri ini lahir dari keringat petani, peluh nelayan, dan doa ibu di beranda sunyi.", question: "Struktur sejajar 'keringat petani, peluh nelayan, dan doa ibu' menggunakan teknik retorika...", options: ["Paralelisme", "Elipsis", "Kiasmus", "Aposiopesis"], answer: 0, exp: "Paralelisme menyejajarkan bentuk gramatikal frasa yang setara untuk memperkuat ritme dan penekanan makna." },
        { id: "ts_t_10", difficulty: "tantangan", quote: "Peristiwa berputar kembali ke masa lima belas tahun silam ketika hujan deras meruntuhkan jembatan desa.", question: "Teknik pengaluran cerita yang bergerak mundur mengenang peristiwa masa lampau disebut...", options: ["Alur sorot balik (flashback)", "Alur progresif (maju)", "Foreshadowing", "Klimaks"], answer: 0, exp: "Alur sorot balik (regresif/flashback) membawa pembaca menelusuri kejadian masa lalu untuk menjelaskan konflik masa kini." }
    ];

    const DEFAULT_BANK_PERBAIKI_KALIMAT = [
        { id: "pk_s_1", difficulty: "santai", err: "Para siswa-siswa diharapkan segera berkumpul di lapangan upacara.", options: ["Para siswa diharapkan segera berkumpul di lapangan upacara.", "Para siswa-siswa harap segera kumpul di lapangan upacara.", "Semua para siswa diharapkan berkumpul dilapangan upacara.", "Siswa-siswa sekalian di harapkan berkumpul di lapangan."], correct: 0, exp: "Kata 'para' sudah menyatakan jamak, sehingga tidak perlu mengulang 'siswa-siswa' agar kalimat efektif dan tidak pleonastis." },
        { id: "pk_s_2", difficulty: "santai", err: "Dimana kamu meletakkan buku catatan literasi kemarin?", options: ["Di mana kamu meletakkan buku catatan literasi kemarin?", "Dimana kamu meletakan buku catatan literasi kemarin?", "Di mana kamu meletakan buku catatan literasi kemarin?", "Dimanakah kamu meletakkan buku catatan literasi kemarin?"], correct: 0, exp: "Kata depan 'di' yang menunjukkan tempat ('di mana') harus dipisah, dan bentuk baku dari dasar 'letak' + me-kan adalah 'meletakkan'." },
        { id: "pk_s_3", difficulty: "santai", err: "Saya membeli obat di apotik dekat rumah sakit.", options: ["Saya membeli obat di apotek dekat rumah sakit.", "Saya membeli obat diapootek dekat rumah sakit.", "Saya membeli obat di apotik dekat rumahsakit.", "Saya beli obat di apotik dekat rumah sakit."], correct: 0, exp: "Bentuk baku dalam KBBI adalah 'apotek' (bukan 'apotik'), dan kata depan 'di' harus ditulis terpisah." },
        { id: "pk_s_4", difficulty: "santai", err: "Walaupun hujan deras, tetapi ia tetap berangkat ke perpustakaan.", options: ["Walaupun hujan deras, ia tetap berangkat ke perpustakaan.", "Walaupun hujan deras, namun ia tetap berangkat ke perpustakaan.", "Meskipun hujan deras tetapi ia tetap berangkat ke perpustakaan.", "Walaupun hujan deras, melainkan ia tetap berangkat."], correct: 0, exp: "Konjungsi intrakalimat 'walaupun' tidak boleh dipasangkan ganda dengan 'tetapi' atau 'namun' dalam satu kalimat." },
        { id: "pk_s_5", difficulty: "santai", err: "Rapat redaksi majalah sekolah itu di laksanakan pada hari jumat.", options: ["Rapat redaksi majalah sekolah itu dilaksanakan pada hari Jumat.", "Rapat redaksi majalah sekolah itu di laksanakan pada hari Jumat.", "Rapat redaksi majalah sekolah itu dilaksanakan pada Hari jumat.", "Rapat redaksi majalah sekolah itu di laksanakan pada Hari Jumat."], correct: 0, exp: "Imbuhan pasif 'di-' ditulis serangkai ('dilaksanakan') dan nama hari diawali huruf kapital ('Jumat')." },
        { id: "pk_s_6", difficulty: "santai", err: "Kegiatan literasi ini bertujuan agar supaya siswa gemar membaca.", options: ["Kegiatan literasi ini bertujuan agar siswa gemar membaca.", "Kegiatan literasi ini bertujuan untuk supaya siswa gemar membaca.", "Kegiatan literasi ini tujuannya agar supaya siswa gemar membaca.", "Kegiatan literasi ini bertujuan demi agar siswa gemar membaca."], correct: 0, exp: "Hindari penggunaan konjungsi bersinonim secara bersamaan ('agar supaya'); pilih salah satu ('agar' atau 'supaya')." },
        { id: "pk_s_7", difficulty: "santai", err: "Dia sangat amat rajin menulis cerpen setiap malam minggu.", options: ["Dia sangat rajin menulis cerpen setiap malam Minggu.", "Dia sangat amat rajin menulis cerpen setiap malam Minggu.", "Dia amat sangat rajin menulis cerpen setiap malam minggu.", "Dia sangat rajin sekali menulis cerpen tiap malam minggu."], correct: 0, exp: "Penggunaan 'sangat amat' bersifat berlebihan (mubazir); cukup 'sangat rajin', dan nama hari 'Minggu' berkapital." },
        { id: "pk_s_8", difficulty: "santai", err: "Presiden menghadiri peresmian pameran buku nasional di bandung.", options: ["Presiden menghadiri peresmian pameran buku nasional di Bandung.", "presiden menghadiri peresmian pameran buku nasional di Bandung.", "Presiden menghadiri peresmian pameran buku Nasional di bandung.", "Presiden mengahdiri peresmian pameran buku nasional di Bandung."], correct: 0, exp: "Nama unsur geografi/kota ('Bandung') wajib diawali huruf kapital sesuai kaidah EYD V." },
        { id: "pk_s_9", difficulty: "santai", err: "Kami mengucapkan terimakasih atas partisipasi seluruh peserta.", options: ["Kami mengucapkan terima kasih atas partisipasi seluruh peserta.", "Kami mengucapkan terimakasih atas partisifasi seluruh peserta.", "Kami mengucap terima kasih atas partisipasi semua seluruh peserta.", "Kami mengucapkan terima-kasih atas partisipasi seluruh peserta."], correct: 0, exp: "Gabungan kata 'terima kasih' tanpa imbuhan awalan-akhiran wajib ditulis terpisah." },
        { id: "pk_s_10", difficulty: "santai", err: "Ia pergi ke toko buku, membeli novel, kamus dan pena.", options: ["Ia pergi ke toko buku, membeli novel, kamus, dan pena.", "Ia pergi ketoko buku, membeli novel, kamus, dan pena.", "Ia pergi ke toko buku membeli novel kamus dan pena.", "Ia pergi ke toko buku; membeli novel, kamus dan pena."], correct: 0, exp: "Pada perincian tiga unsur atau lebih, tanda koma wajib diletakkan sebelum kata penghubung 'dan' (koma serial EYD V)." },
        { id: "pk_t_1", difficulty: "tantangan", err: "Dalam rapat tersebut membahas tentang strategi peningkatan minat baca.", options: ["Rapat tersebut membahas strategi peningkatan minat baca.", "Dalam rapat tersebut membahas strategi peningkatan minat baca.", "Di dalam rapat tersebut membicarakan tentang strategi minat baca.", "Rapat tersebut membahas tentang strategi peningkatan minat baca."], correct: 0, exp: "Kalimat tanpa subjek karena preposisi 'dalam' di awal, serta kata kerja transitif 'membahas' langsung diikuti objek tanpa 'tentang'." },
        { id: "pk_t_2", difficulty: "tantangan", err: "Ia berhasil merubah konsep naskah itu menjadi lebih sistimatis.", options: ["Ia berhasil mengubah konsep naskah itu menjadi lebih sistematis.", "Ia berhasil merubah konsep naskah itu menjadi lebih sistematis.", "Ia berhasil mengubah konsep naskah itu menjadi lebih sistimatis.", "Ia berhasil mengubahkan konsep naskah itu menjadi sistematis."], correct: 0, exp: "Kata dasar 'ubah' + me- menjadi 'mengubah' (bukan 'merubah'), dan bentuk baku adalah 'sistematis'." },
        { id: "pk_t_3", difficulty: "tantangan", err: "Naskah yang mana telah dikirimkan kemarin sudah dikoreksi oleh kurator.", options: ["Naskah yang telah dikirimkan kemarin sudah dikoreksi oleh kurator.", "Naskah dimana telah dikirimkan kemarin sudah dikoreksi kurator.", "Naskah yang mana telah di kirim kemarin sudah dikoreksi kurator.", "Naskah yang telah dikirimkan kemarin sudah di koreksi oleh kurator."], correct: 0, exp: "Kata tanya 'yang mana' bukan konjungsi baku dalam bahasa Indonesia; cukup gunakan 'yang'." },
        { id: "pk_t_4", difficulty: "tantangan", err: "Atas perhatiannya Bapak dan Ibu sekalian, kami haturkan terima kasih.", options: ["Atas perhatian Bapak dan Ibu, kami mengucapkan terima kasih.", "Atas perhatiannya Bapak/Ibu sekalian, kami ucapkan terimakasih.", "Atas perhatiannya daripada Bapak dan Ibu, kami terima kasih.", "Atas perhatian Bapak dan Ibu sekalian, kami haturkan terimakasih."], correct: 0, exp: "Akhiran '-nya' pada 'perhatiannya' rancu bila diikuti langsung 'Bapak dan Ibu'. Gunakan sapaan langsung yang ringkas dan baku." },
        { id: "pk_t_5", difficulty: "tantangan", err: "Analisis data itu dilakukan secara kwalitatif dan komprehensip.", options: ["Analisis data itu dilakukan secara kualitatif dan komprehensif.", "Analisa data itu dilakukan secara kualitatif dan komprehensif.", "Analisis data itu dilakukan secara kwalitatif dan komprehensif.", "Analisa data itu dilakukan secara kualitatif dan komprehensip."], correct: 0, exp: "Kata baku KBBI adalah 'analisis', 'kualitatif', dan 'komprehensif'." },
        { id: "pk_t_6", difficulty: "tantangan", err: "Walaupun ia sibuk bekerja namun ia selalu menyempatkan membaca buku.", options: ["Walaupun sibuk bekerja, ia selalu menyempatkan diri membaca buku.", "Walaupun ia sibuk bekerja tetapi ia selalu menyempatkan membaca buku.", "Meskipun ia sibuk bekerja namun ia selalu menyempatkan membaca buku.", "Walau sibuk bekerja, namun ia selalu menyempatkan membaca buku."], correct: 0, exp: "Konjungsi 'walaupun' cukup diikuti tanda koma di akhir anak kalimat tanpa menambahkan 'namun' atau 'tetapi'." },
        { id: "pk_t_7", difficulty: "tantangan", err: "Buku itu saya sudah baca sampai halaman terakhir sejak kemarin sore.", options: ["Buku itu sudah saya baca sampai halaman terakhir sejak kemarin sore.", "Buku itu saya telah baca sampai halaman terakhir sejak kemarin sore.", "Buku itu sudah dibaca oleh saya sampai halaman terakhir kemarin sore.", "Buku itu saya sudah membaca sampai halaman terakhir sejak kemarin sore."], correct: 0, exp: "Dalam konstruksi pasif persona pertama, aspek 'sudah' diletakkan sebelum pronomina pelaku: 'sudah saya baca'." },
        { id: "pk_t_8", difficulty: "tantangan", err: "Para peserta lomba diwajibkan untuk mensubmit naskah sebelum jam 23.59.", options: ["Peserta lomba diwajibkan mengirimkan naskah sebelum pukul 23.59.", "Para peserta lomba diwajibkan untuk mensubmit naskah sebelum pukul 23.59.", "Peserta lomba di wajibkan mengirim naskah sebelum jam 23.59.", "Para peserta lomba wajib mensubmit naskah sebelum jam 23.59."], correct: 0, exp: "Gunakan padanan Indonesia baku ('mengirimkan') bukan 'mensubmit', serta gunakan 'pukul' (bukan 'jam') untuk menunjukkan titik waktu." },
        { id: "pk_t_9", difficulty: "tantangan", err: "Rumah penulis senior itu terletak diantara dua sungai yang jernih.", options: ["Rumah penulis senior itu terletak di antara dua sungai yang jernih.", "Rumah penulis senior itu terletak diantara dua sungai yang jernih.", "Rumah penulis senior itu di letakkan di antara dua sungai jernih.", "Rumah penulis senior itu ter letak di antara dua sungai yang jernih."], correct: 0, exp: "Preposisi 'di antara' ditulis terpisah karena menunjukkan posisi tempat." },
        { id: "pk_t_10", difficulty: "tantangan", err: "Karena keterbatasan waktu, maka diskusi sastra terpaksa diakhiri.", options: ["Karena keterbatasan waktu, diskusi sastra terpaksa diakhiri.", "Dikarenakan keterbatasan waktu, maka diskusi sastra terpaksa diakhiri.", "Sebab karena keterbatasan waktu, diskusi sastra terpaksa diakhiri.", "Karena keterbatasan waktu maka daripada itu diskusi diakhiri."], correct: 0, exp: "Hindari penggunaan konjungsi ganda 'karena ... maka ...' dalam satu kalimat majemuk bertingkat." }
    ];

    const DEFAULT_BANK_TANTANGAN_CEPAT = [
        { id: "tc_s_1", difficulty: "santai", word: "ANTRE", isBaku: true, bakuForm: "antre", exp: "Baku menurut KBBI (bukan 'antri')." },
        { id: "tc_s_2", difficulty: "santai", word: "APOTIK", isBaku: false, bakuForm: "apotek", exp: "Tidak baku; bentuk bakunya adalah 'apotek'." },
        { id: "tc_s_3", difficulty: "santai", word: "AKTIVITAS", isBaku: true, bakuForm: "aktivitas", exp: "Baku menurut KBBI (bukan 'aktifitas')." },
        { id: "tc_s_4", difficulty: "santai", word: "ANALISA", isBaku: false, bakuForm: "analisis", exp: "Tidak baku; bentuk bakunya adalah 'analisis'." },
        { id: "tc_s_5", difficulty: "santai", word: "ATLET", isBaku: true, bakuForm: "atlet", exp: "Baku menurut KBBI (bukan 'atlit')." },
        { id: "tc_s_6", difficulty: "santai", word: "IJASAH", isBaku: false, bakuForm: "ijazah", exp: "Tidak baku; bentuk bakunya adalah 'ijazah'." },
        { id: "tc_s_7", difficulty: "santai", word: "JADWAL", isBaku: true, bakuForm: "jadwal", exp: "Baku menurut KBBI (bukan 'jadual')." },
        { id: "tc_s_8", difficulty: "santai", word: "KARIR", isBaku: false, bakuForm: "karier", exp: "Tidak baku; bentuk bakunya adalah 'karier'." },
        { id: "tc_s_9", difficulty: "santai", word: "KREATIVITAS", isBaku: true, bakuForm: "kreativitas", exp: "Baku menurut KBBI (bukan 'kreatifitas')." },
        { id: "tc_s_10", difficulty: "santai", word: "KWITANSI", isBaku: false, bakuForm: "kuitansi", exp: "Tidak baku; bentuk bakunya adalah 'kuitansi'." },
        { id: "tc_s_11", difficulty: "santai", word: "NASIHAT", isBaku: true, bakuForm: "nasihat", exp: "Baku menurut KBBI (bukan 'nasehat')." },
        { id: "tc_s_12", difficulty: "santai", word: "PRAKTEK", isBaku: false, bakuForm: "praktik", exp: "Tidak baku; bentuk bakunya adalah 'praktik'." },
        { id: "tc_s_13", difficulty: "santai", word: "RISIKO", isBaku: true, bakuForm: "risiko", exp: "Baku menurut KBBI (bukan 'resiko')." },
        { id: "tc_s_14", difficulty: "santai", word: "SEKEDAR", isBaku: false, bakuForm: "sekadar", exp: "Tidak baku; bentuk bakunya adalah 'sekadar'." },
        { id: "tc_s_15", difficulty: "santai", word: "TEKNIK", isBaku: true, bakuForm: "teknik", exp: "Baku menurut KBBI (bukan 'tehnik')." },
        { id: "tc_t_1", difficulty: "tantangan", word: "ABJAD", isBaku: true, bakuForm: "abjad", exp: "Baku menurut KBBI (bukan 'abjat')." },
        { id: "tc_t_2", difficulty: "tantangan", word: "ADZAN", isBaku: false, bakuForm: "azan", exp: "Tidak baku; bentuk bakunya dalam KBBI adalah 'azan'." },
        { id: "tc_t_3", difficulty: "tantangan", word: "AUTHENTIC", isBaku: false, bakuForm: "autentik", exp: "Tidak baku dalam bahasa Indonesia; padanan bakunya adalah 'autentik'." },
        { id: "tc_t_4", difficulty: "tantangan", word: "CENDERA MATA", isBaku: true, bakuForm: "cendera mata", exp: "Baku menurut KBBI (ditulis terpisah 'cendera mata', bukan 'cinderamata')." },
        { id: "tc_t_5", difficulty: "tantangan", word: "DIAGNOSA", isBaku: false, bakuForm: "diagnosis", exp: "Tidak baku; bentuk bakunya adalah 'diagnosis'." },
        { id: "tc_t_6", difficulty: "tantangan", word: "EKOSISTEM", isBaku: true, bakuForm: "ekosistem", exp: "Baku menurut KBBI (bukan 'ekosistim')." },
        { id: "tc_t_7", difficulty: "tantangan", word: "FONDASI", isBaku: true, bakuForm: "fondasi", exp: "Baku menurut KBBI (bukan 'pondasi')." },
        { id: "tc_t_8", difficulty: "tantangan", word: "HAKEKAT", isBaku: false, bakuForm: "hakikat", exp: "Tidak baku; bentuk bakunya adalah 'hakikat'." },
        { id: "tc_t_9", difficulty: "tantangan", word: "HIERARKI", isBaku: true, bakuForm: "hierarki", exp: "Baku menurut KBBI (bukan 'hirarki')." },
        { id: "tc_t_10", difficulty: "tantangan", word: "HIPOTESA", isBaku: false, bakuForm: "hipotesis", exp: "Tidak baku; bentuk bakunya adalah 'hipotesis'." },
        { id: "tc_t_11", difficulty: "tantangan", word: "KAIDAH", isBaku: true, bakuForm: "kaidah", exp: "Baku menurut KBBI (bukan 'kaedah')." },
        { id: "tc_t_12", difficulty: "tantangan", word: "KOMODITI", isBaku: false, bakuForm: "komoditas", exp: "Tidak baku; bentuk bakunya adalah 'komoditas'." },
        { id: "tc_t_13", difficulty: "tantangan", word: "MATERAI", isBaku: false, bakuForm: "meterai", exp: "Tidak baku; bentuk bakunya adalah 'meterai'." },
        { id: "tc_t_14", difficulty: "tantangan", word: "OTENTIK", isBaku: false, bakuForm: "autentik", exp: "Tidak baku; bentuk bakunya adalah 'autentik'." },
        { id: "tc_t_15", difficulty: "tantangan", word: "SINTESIS", isBaku: true, bakuForm: "sintesis", exp: "Baku menurut KBBI (bukan 'sintesa')." }
    ];

    const DEFAULT_BANK_SAMBUNG_CERITA = [
        { id: "sc_s_1", difficulty: "santai", opener: "Di sudut paling sunyi perpustakaan tua itu, aku menemukan sebuah buku bersampul kulit cokelat tanpa nama pengarang. Ketika halamannya kubuka, tinta emas di dalamnya mulai bergerak membentuk namaku sendiri...", guide: "Lanjutkan cerita dengan suasana misterius dan sisipkan minimal satu majas personifikasi." },
        { id: "sc_s_2", difficulty: "santai", opener: "Hujan turun tak henti-henti sejak fajar. Di halte kayu dekat persimpangan desa, seorang kakek menyerahkan sebuah surat tersegel lilin biru kepadaku sebelum ia menghilang di balik kabut...", guide: "Bangun rasa ingin tahu pembaca tentang isi surat dan alasan kakek itu memilih tokoh utama." },
        { id: "sc_s_3", difficulty: "santai", opener: "Jam dinding di ruang baca berdentang tiga belas kali. Seketika itu pula, suara gemericik ombak terdengar jelas dari balik pintu lemari buku...", guide: "Gambarkan transisi dunia nyata ke dunia imajinasi menggunakan citraan visual dan pendengaran." },
        { id: "sc_t_1", difficulty: "tantangan", opener: "Kota ini melarang warganya menyimpan kenangan lebih dari sepuluh tahun. Namun malam ini, aku menyembunyikan sebuah buku harian kakekku di bawah papan lantai kayu...", guide: "Kembangkan konflik batin tokoh utama dan hadirkan dialog singkat yang menegangkan." },
        { id: "sc_t_2", difficulty: "tantangan", opener: "Semua orang mengira mercusuar di ujung karang itu sudah kosong puluhan tahun, hingga cahaya lampu minyaknya menyala kembali tepat di malam gerhana bulan...", guide: "Tulis lanjutan paragraf dengan tempo dramatis, diksi puitis, dan akhiri dengan cliffhanger." },
        { id: "sc_t_3", difficulty: "tantangan", opener: "Di pasar malam yang hanya muncul setahun sekali, seorang penjual menawarkan botol-botol kaca berisi suara tawa masa kecil yang telah lama hilang...", guide: "Eksplorasi tema nostalgia dengan gaya bahasa metafora dan akhir yang menyentuh hati." }
    ];

    function getQuestionBank(gameKey) {
        try {
            const key = 'cendekia_qbank_' + gameKey;
            const raw = localStorage.getItem(key);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        } catch (e) {}

        let fallback = [];
        if (gameKey === 'kuis_pintar') fallback = DEFAULT_BANK_KUIS_PINTAR;
        else if (gameKey === 'tebak_kata') fallback = DEFAULT_BANK_TEBAK_KATA;
        else if (gameKey === 'susun_kata') fallback = DEFAULT_BANK_SUSUN_KATA;
        else if (gameKey === 'teka_teki') fallback = DEFAULT_BANK_TEKA_TEKI;
        else if (gameKey === 'tebak_sastra') fallback = DEFAULT_BANK_TEBAK_SASTRA;
        else if (gameKey === 'perbaiki_kalimat') fallback = DEFAULT_BANK_PERBAIKI_KALIMAT;
        else if (gameKey === 'tantangan_cepat') fallback = DEFAULT_BANK_TANTANGAN_CEPAT;
        else if (gameKey === 'sambung_cerita') fallback = DEFAULT_BANK_SAMBUNG_CERITA;

        try {
            localStorage.setItem('cendekia_qbank_' + gameKey, JSON.stringify(fallback));
        } catch (e) {}
        return fallback.slice();
    }

    function addToQuestionBank(gameKey, items) {
        if (!Array.isArray(items) || items.length === 0) return;
        try {
            const current = getQuestionBank(gameKey);
            let addedCount = 0;

            items.forEach((item, idx) => {
                const text = (item.question || item.q || item.word || item.prompt || '').trim().toLowerCase();
                const exists = current.some(c => {
                    const cText = (c.question || c.q || c.word || c.prompt || '').trim().toLowerCase();
                    return cText && cText === text;
                });
                if (!exists) {
                    const newItem = {
                        id: item.id || (`ai_${gameKey}_${Date.now()}_${idx}`),
                        difficulty: item.difficulty || (idx % 2 === 0 ? 'santai' : 'tantangan'),
                        ...item
                    };
                    current.push(newItem);
                    addedCount++;
                }
            });

            if (addedCount > 0) {
                localStorage.setItem('cendekia_qbank_' + gameKey, JSON.stringify(current));
            }
        } catch (e) {
            console.warn('[Cendekia Central] Gagal menambahkan soal ke Bank Soal:', e);
        }
    }

    function getServedQuestionHistory(gameKey) {
        try {
            const raw = localStorage.getItem('cendekia_served_' + gameKey);
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            return {};
        }
    }

    function markQuestionsServed(gameKey, questionIds) {
        if (!Array.isArray(questionIds) || questionIds.length === 0) return;
        try {
            const history = getServedQuestionHistory(gameKey);
            const now = Date.now();
            questionIds.forEach(id => {
                if (id) history[id] = now;
            });
            localStorage.setItem('cendekia_served_' + gameKey, JSON.stringify(history));
        } catch (e) {}
    }

    function selectQuestionsFromBank(gameKey, count, mode = 'santai') {
        const bank = getQuestionBank(gameKey);
        if (!bank || bank.length === 0) return [];

        const normalizedMode = (mode || 'santai').toLowerCase();

        // 1. Filter berdasarkan mode permainan
        let filtered = bank.slice();
        if (normalizedMode === 'santai') {
            const santaiOnly = filtered.filter(q => q.difficulty === 'santai');
            filtered = santaiOnly.length >= count ? santaiOnly : filtered;
        } else if (normalizedMode === 'tantangan') {
            const tantanganOnly = filtered.filter(q => q.difficulty === 'tantangan');
            filtered = tantanganOnly.length >= count ? tantanganOnly : filtered;
        }

        // 2. Filter Anti-Repetisi 7 Hari (Cooldown 7x24 jam)
        const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
        const now = Date.now();
        const servedHistory = getServedQuestionHistory(gameKey);

        const eligible = [];
        const cooledDown = [];

        filtered.forEach(q => {
            const servedTime = servedHistory[q.id];
            if (!servedTime || (now - servedTime >= SEVEN_DAYS_MS)) {
                eligible.push(q);
            } else {
                cooledDown.push({ q, servedTime });
            }
        });

        // 3. Acak urutan kumpulan soal yang eligible (Fisher-Yates Shuffle)
        for (let i = eligible.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
        }

        let selected = eligible.slice(0, count);

        // 4. Jika jumlah soal eligible < count, ambil sisa dari soal yang paling lama tidak disajikan
        if (selected.length < count) {
            cooledDown.sort((a, b) => (a.servedTime || 0) - (b.servedTime || 0));
            const needed = count - selected.length;
            for (let i = 0; i < needed && i < cooledDown.length; i++) {
                selected.push(cooledDown[i].q);
            }
        }

        // Acak sekali lagi susunan paket soal
        for (let i = selected.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [selected[i], selected[j]] = [selected[j], selected[i]];
        }

        // 5. Tandai soal-soal terpilih agar tertahan 7 hari ke depan untuk pengguna ini
        markQuestionsServed(gameKey, selected.map(q => q.id));

        return selected;
    }

    // Menghitung akumulasi XP aktual yang didapatkan user hari ini
    function getTodayEarnedXP() {
        const todayKey = getTodayDateKeyWIB();
        const history = getHistory();
        let total = 0;

        if (Array.isArray(history)) {
            history.forEach(item => {
                const itemDate = item.isoDate || (item.timestamp ? new Date(item.timestamp).toISOString().split('T')[0] : '');
                if (itemDate === todayKey) {
                    if (typeof item.value === 'number' && (item.type === 'xp' || item.type === 'award' || item.icon === 'award')) {
                        total += item.value;
                    } else if (typeof item.title === 'string') {
                        const match = item.title.match(/\+(\d+)\s*XP/i);
                        if (match) {
                            total += parseInt(match[1]);
                        }
                    }
                }
            });
        }

        // Akumulasi dari game result hari ini jika ada (seluruh 8 arena)
        const gameKeys = ['kuis_pintar', 'tebak_kata', 'susun_kata', 'teka_teki', 'tebak_sastra', 'sambung_cerita', 'perbaiki_kalimat', 'tantangan_cepat'];
        let gameResultsTotal = 0;
        gameKeys.forEach(gk => {
            const res = getGameResult(gk);
            if (res && typeof res.xpEarned === 'number' && res.xpEarned > 0) {
                gameResultsTotal += res.xpEarned;
            }
        });

        return Math.max(total, gameResultsTotal);
    }

    // Mendeteksi draft game yang belum tuntas (4 arena di Member Free, 8 arena di Member 5K)
    function getUnfinishedGames() {
        const list = [
            { key: 'kuis_pintar', title: 'Kuis Pintar', link: `${PORTAL_PREFIX}/permainan/kuis-pintar.html`, total: 15, icon: 'brain', color: '#7c3aed', bg: '#ede9fe' },
            { key: 'tebak_kata', title: 'Tebak Kata', link: `${PORTAL_PREFIX}/permainan/tebak-kata.html`, total: 10, icon: 'text-search', color: '#0284c7', bg: '#e0f2fe' },
            { key: 'susun_kata', title: 'Susun Kata', link: `${PORTAL_PREFIX}/permainan/susun-kata.html`, total: 10, icon: 'combine', color: '#059669', bg: '#d1fae5' },
            { key: 'teka_teki', title: 'Teka-Teki Aksara', link: `${PORTAL_PREFIX}/permainan/teka-teki.html`, total: 10, icon: 'puzzle', color: '#b45309', bg: '#fef3c7' }
        ];

        if (IS_MEM_5K) {
            list.push(
                { key: 'tebak_sastra', title: 'Tebak Sastra', link: `${PORTAL_PREFIX}/permainan/tebak-sastra.html`, total: 10, icon: 'book-open', color: '#059669', bg: '#dcfce7' },
                { key: 'sambung_cerita', title: 'Sambung Cerita', link: `${PORTAL_PREFIX}/permainan/sambung-cerita.html`, total: 3, icon: 'book-text', color: '#2563eb', bg: '#dbeafe' },
                { key: 'perbaiki_kalimat', title: 'Perbaiki Kalimat', link: `${PORTAL_PREFIX}/permainan/perbaiki-kalimat.html`, total: 10, icon: 'spell-check', color: '#e11d48', bg: '#ffe4e6' },
                { key: 'tantangan_cepat', title: 'Tantangan Cepat', link: `${PORTAL_PREFIX}/permainan/tantangan-cepat.html`, total: 10, icon: 'timer', color: '#ea580c', bg: '#ffedd5' }
            );
        }

        const unfinished = [];

        list.forEach(g => {
            if (isGameCompletedToday(g.key)) return;

            const draft = getGameDraft(g.key);
            if (!draft) return;

            let answered = 0;
            if (g.key === 'kuis_pintar') {
                answered = Object.keys(draft.answers || {}).length;
            } else if (draft.currentIndex !== undefined) {
                answered = draft.currentIndex;
            } else if (draft.pIndex !== undefined) {
                answered = draft.pIndex;
            } else if (draft.rIndex !== undefined) {
                answered = draft.rIndex;
            }

            // Jika permainan sedang berjalan dan belum tuntas
            if (answered < g.total && (draft.questions || answered > 0)) {
                unfinished.push({
                    ...g,
                    answeredCount: answered,
                    remainingCount: g.total - answered,
                    mode: draft.mode || 'santai',
                    savedAt: draft.savedAt
                });
            }
        });

        return unfinished;
    }

    // Notifikasi XP Melayang Naik & Memudar (Tanpa Background Hitam / Modal Nyangkut)
    function showFloatingXP(amount, bonusLabel = '') {
        try {
            const toast = document.createElement('div');
            toast.className = 'floating-xp-toast' + (bonusLabel ? ' bonus' : '');
            toast.innerHTML = `+${amount} XP${bonusLabel ? ' <b>' + bonusLabel + '</b>' : ''}`;
            document.body.appendChild(toast);
            setTimeout(() => {
                if (toast && toast.parentElement) toast.remove();
            }, 1900);
        } catch (e) {}
    }

    // Balon Motivasi Melayang Naik & Memudar Otomatis
    function showEncouragementToast(message = 'Semangat, sebentar lagi! ✨') {
        try {
            const toast = document.createElement('div');
            toast.className = 'floating-encouragement-toast';
            toast.innerHTML = `<i data-lucide="sparkles" style="width:14px; height:14px; color:#f59e0b; flex-shrink:0;"></i> <span>${message}</span>`;
            document.body.appendChild(toast);
            if (window.lucide) lucide.createIcons();
            setTimeout(() => {
                if (toast && toast.parentElement) toast.remove();
            }, 2400);
        } catch (e) {}
    }

    // ========================================================
    // AUTOSAVE DRAFT & PERSISTENSI HASIL KUIS/GAME
    // ========================================================
    function getDraftStorageKey(gameKey) {
        return `cendekia_draft_${gameKey}_${getTodayDateKeyWIB()}`;
    }

    function getResultStorageKey(gameKey) {
        return `cendekia_result_${gameKey}_${getTodayDateKeyWIB()}`;
    }

    function saveGameDraft(gameKey, draftData) {
        try {
            const key = getDraftStorageKey(gameKey);
            localStorage.setItem(key, JSON.stringify({
                ...draftData,
                savedAt: Date.now(),
                dateKey: getTodayDateKeyWIB()
            }));
            return true;
        } catch (e) {
            console.warn('[Cendekia Central] Gagal menyimpan draft game:', e);
            return false;
        }
    }

    function getGameDraft(gameKey) {
        try {
            const key = getDraftStorageKey(gameKey);
            const raw = localStorage.getItem(key);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (parsed.dateKey === getTodayDateKeyWIB()) {
                return parsed;
            }
            localStorage.removeItem(key);
            return null;
        } catch (e) {
            return null;
        }
    }

    function clearGameDraft(gameKey) {
        try {
            localStorage.removeItem(getDraftStorageKey(gameKey));
        } catch (e) {}
    }

    async function saveGameResult(gameKey, resultData) {
        const todayKey = getTodayDateKeyWIB();
        const payload = {
            ...resultData,
            gameKey,
            dateKey: todayKey,
            completedAt: new Date().toISOString(),
            expiresAt: getNextMidnightWIBTimestamp()
        };

        // 1. Simpan di localStorage
        try {
            localStorage.setItem(getResultStorageKey(gameKey), JSON.stringify(payload));
            clearGameDraft(gameKey);
        } catch (e) {}

        // 2. Simpan di Firestore jika user terotentikasi
        try {
            const fb = await getFirebaseBridge();
            if (fb && fb.auth.currentUser) {
                const uid = fb.auth.currentUser.uid;
                await fb.setDoc(fb.doc(fb.db, "users", uid, "game_history", `${gameKey}_${todayKey}`), payload);
            }
        } catch (err) {
            console.warn('[Cendekia Central] Gagal menyimpan riwayat kuis ke cloud:', err);
        }

        // Catat aktivitas global & sinkronkan memori cloud
        logActivity(`Menyelesaikan ${gameKey.replace(/_/g, ' ')} (Skor: ${resultData.score || 0})`, 'gamepad-2', 'game', resultData.xpEarned || 0);
        scheduleCloudMemorySync();
        return payload;
    }

    function getGameResult(gameKey) {
        try {
            const key = getResultStorageKey(gameKey);
            const raw = localStorage.getItem(key);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (parsed.dateKey === getTodayDateKeyWIB()) {
                return parsed;
            }
            return null; // Sudah lewat jam 00:00 WIB
        } catch (e) {
            return null;
        }
    }

    function isGameCompletedToday(gameKey) {
        return getGameResult(gameKey) !== null;
    }

    // ========================================================
    // GENERATOR LAPORAN EVALUASI & HASIL BELAJAR (PDFMAKE)
    // ========================================================
    function downloadEvaluationPDF(evalData, userProfile) {
        const executePdf = () => {
            if (!window.pdfMake) {
                alert("Pustaka PDFMake belum siap. Harap tunggu beberapa detik.");
                return;
            }

            const studentName = userProfile?.name || evalData.studentName || 'Peserta Cendekia';
            const studentTier = userProfile?.tier || 'Member Free';
            const dateStr = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
            const timeStr = getWIBDate().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
            const score = Math.round(evalData.score || 0);
            const correctCount = evalData.correctCount || 0;
            const totalCount = evalData.totalCount || (evalData.questions ? evalData.questions.length : 15);
            const xpEarned = evalData.xpEarned || (correctCount * 10);

            let gradeText = "SANGAT BAIK (MAHIR LITERASI)";
            let gradeColor = "#059669";
            if (score < 50) {
                gradeText = "PERLU BIMBINGAN & EVALUASI";
                gradeColor = "#dc2626";
            } else if (score < 70) {
                gradeText = "CUKUP (PERLU PEMANTAPAN KAIDAH)";
                gradeColor = "#d97706";
            } else if (score < 85) {
                gradeText = "BAIK (KOMPETENSI TERCAPAI)";
                gradeColor = "#0284c7";
            }

            // Susun baris soal untuk lembar pembahasan
            const questionBlocks = [];
            const questions = evalData.questions || [];

            questions.forEach((q, idx) => {
                const qNum = idx + 1;
                const isCorrect = q.isCorrect;
                const selectedText = q.selectedText || (q.options ? q.options[q.selectedIdx] : '-');
                const correctText = q.correctText || (q.options ? q.options[q.correctIdx] : '-');
                const explanation = q.exp || q.explanation || 'Pembahasan kaidah tertera pada bahan ajar kurikulum.';

                questionBlocks.push({
                    margin: [0, 6, 0, 10],
                    stack: [
                        {
                            text: `${qNum}. ${q.q || q.question || 'Pertanyaan'}`,
                            fontSize: 10,
                            bold: true,
                            color: '#003366',
                            margin: [0, 0, 0, 4]
                        },
                        {
                            table: {
                                widths: ['*'],
                                body: [
                                    [
                                        {
                                            fillColor: isCorrect ? '#ecfdf5' : '#fef2f2',
                                            borderColor: [isCorrect ? '#a7f3d0' : '#fecaca', isCorrect ? '#a7f3d0' : '#fecaca', isCorrect ? '#a7f3d0' : '#fecaca', isCorrect ? '#a7f3d0' : '#fecaca'],
                                            stack: [
                                                {
                                                    text: isCorrect 
                                                        ? `✓ Jawaban Anda Benar: ${selectedText}` 
                                                        : `✗ Jawaban Anda: ${selectedText} | Kunci Jawaban Benar: ${correctText}`,
                                                    fontSize: 9,
                                                    bold: true,
                                                    color: isCorrect ? '#065f46' : '#991b1b',
                                                    margin: [6, 4, 6, 4]
                                                }
                                            ]
                                        }
                                    ]
                                ]
                            }
                        },
                        {
                            table: {
                                widths: ['*'],
                                body: [
                                    [
                                        {
                                            fillColor: '#f8fafc',
                                            borderColor: ['#e2e8f0', '#e2e8f0', '#e2e8f0', '#e2e8f0'],
                                            stack: [
                                                {
                                                    text: `Pembahasan Kaidah: ${explanation}`,
                                                    fontSize: 8.5,
                                                    italics: true,
                                                    color: '#334155',
                                                    margin: [6, 4, 6, 4]
                                                }
                                            ]
                                        }
                                    ]
                                ]
                            }
                        }
                    ]
                });
            });

            const docDefinition = {
                pageSize: 'A4',
                pageMargins: [36, 36, 36, 40],
                header: function(currentPage, pageCount) {
                    return {
                        margin: [36, 15, 36, 0],
                        columns: [
                            { text: 'Cendekia Aksara Edukasi — Lembar Evaluasi Belajar', fontSize: 7.5, color: '#94a3b8' },
                            { text: `Halaman ${currentPage} dari ${pageCount}`, alignment: 'right', fontSize: 7.5, color: '#94a3b8' }
                        ]
                    };
                },
                content: [
                    // 1. BANNER KOP SURAT RESMI
                    {
                        table: {
                            widths: ['*'],
                            body: [
                                [
                                    {
                                        fillColor: '#003366',
                                        borderColor: ['#003366', '#003366', '#003366', '#003366'],
                                        margin: [10, 10, 10, 10],
                                        stack: [
                                            { text: 'PT CENDEKIA AKSARA EDUKASI', fontSize: 13, bold: true, color: '#f59e0b', alignment: 'center' },
                                            { text: 'LEMBAR HASIL EVALUASI PEMBELAJARAN & KUIS LITERASI', fontSize: 11, bold: true, color: '#ffffff', alignment: 'center', margin: [0, 2, 0, 2] },
                                            { text: 'Program Penguatan Literasi & Kaidah Bahasa Indonesia — Akses Siswa Terbuka', fontSize: 8, color: '#cbd5e1', alignment: 'center' }
                                        ]
                                    }
                                ]
                            ]
                        },
                        margin: [0, 0, 0, 12]
                    },

                    // 2. KARTU IDENTITAS PESERTA
                    {
                        table: {
                            widths: ['25%', '35%', '20%', '20%'],
                            body: [
                                [
                                    { text: 'Nama Siswa', bold: true, fontSize: 8.5, color: '#475569', fillColor: '#f1f5f9' },
                                    { text: studentName, bold: true, fontSize: 8.5, color: '#003366' },
                                    { text: 'Status Akun', bold: true, fontSize: 8.5, color: '#475569', fillColor: '#f1f5f9' },
                                    { text: studentTier, bold: true, fontSize: 8.5, color: '#0284c7' }
                                ],
                                [
                                    { text: 'Waktu Pelaksanaan', bold: true, fontSize: 8.5, color: '#475569', fillColor: '#f1f5f9' },
                                    { text: `${dateStr} (${timeStr})`, fontSize: 8, color: '#334155' },
                                    { text: 'Nomor Sertifikat', bold: true, fontSize: 8.5, color: '#475569', fillColor: '#f1f5f9' },
                                    { text: `CA-${Date.now().toString().slice(-6)}`, fontSize: 8, bold: true, color: '#64748b' }
                                ]
                            ]
                        },
                        margin: [0, 0, 0, 12]
                    },

                    // 3. KARTU REKAPITULASI NILAI
                    {
                        table: {
                            widths: ['30%', '23%', '23%', '24%'],
                            body: [
                                [
                                    { text: 'SKOR AKHIR', alignment: 'center', fontSize: 8, bold: true, color: '#475569', fillColor: '#e2e8f0' },
                                    { text: 'JAWABAN BENAR', alignment: 'center', fontSize: 8, bold: true, color: '#065f46', fillColor: '#d1fae5' },
                                    { text: 'JAWABAN SALAH', alignment: 'center', fontSize: 8, bold: true, color: '#991b1b', fillColor: '#fee2e2' },
                                    { text: 'TOTAL POIN XP', alignment: 'center', fontSize: 8, bold: true, color: '#5b21b6', fillColor: '#ede9fe' }
                                ],
                                [
                                    { text: `${score} / 100`, alignment: 'center', fontSize: 18, bold: true, color: '#003366', margin: [0, 6, 0, 6] },
                                    { text: `${correctCount} Soal`, alignment: 'center', fontSize: 13, bold: true, color: '#059669', margin: [0, 6, 0, 6] },
                                    { text: `${totalCount - correctCount} Soal`, alignment: 'center', fontSize: 13, bold: true, color: '#dc2626', margin: [0, 6, 0, 6] },
                                    { text: `+${xpEarned} XP`, alignment: 'center', fontSize: 13, bold: true, color: '#7c3aed', margin: [0, 6, 0, 6] }
                                ],
                                [
                                    {
                                        colSpan: 4,
                                        fillColor: '#f8fafc',
                                        alignment: 'center',
                                        text: [
                                            { text: 'PREDIKAT CAPAIAN: ', bold: true, fontSize: 8.5, color: '#475569' },
                                            { text: gradeText, bold: true, fontSize: 9, color: gradeColor }
                                        ],
                                        margin: [0, 4, 0, 4]
                                    },
                                    {}, {}, {}
                                ]
                            ]
                        },
                        margin: [0, 0, 0, 16]
                    },

                    // 4. JUDUL BAGIAN EVALUASI
                    {
                        text: 'LEMBAR PEMBAHASAN SOAL & KAIDAH LITERASI',
                        fontSize: 10,
                        bold: true,
                        color: '#003366',
                        margin: [0, 0, 0, 6]
                    },
                    {
                        text: 'Gunakan lembar pembahasan di bawah ini untuk mempelajari kaidah bahasa dan memperkuat kompetensi literasi:',
                        fontSize: 8,
                        color: '#64748b',
                        margin: [0, 0, 0, 10]
                    },

                    // 5. BLOK BUTIR-BUTIR SOAL
                    ...questionBlocks,

                    // 6. CATATAN KAKI & TANDA TANGAN RESMI
                    {
                        margin: [0, 16, 0, 0],
                        columns: [
                            {
                                width: '60%',
                                stack: [
                                    { text: 'Catatan Evaluasi:', fontSize: 8, bold: true, color: '#475569' },
                                    { text: '1. Hasil evaluasi ini berlaku sah sebagai rekap capaian belajar harian siswa.', fontSize: 7.5, color: '#64748b' },
                                    { text: '2. Kuis latihan berikutnya akan dibuka kembali secara otomatis setiap hari pada pukul 00:00 WIB.', fontSize: 7.5, color: '#64748b' },
                                    { text: '3. Seluruh butir soal disusun berbasis kurikulum bahan ajar terverifikasi.', fontSize: 7.5, color: '#64748b' }
                                ]
                            },
                            {
                                width: '40%',
                                alignment: 'center',
                                stack: [
                                    { text: 'Verifikasi Sistem Akademik,', fontSize: 8, color: '#475569' },
                                    { text: 'Cendekia Aksara AI Learning', fontSize: 8, bold: true, color: '#003366', margin: [0, 2, 0, 20] },
                                    { text: 'TIM KURIKULUM CENDEKIA', fontSize: 8, bold: true, decoration: 'underline', color: '#003366' },
                                    { text: 'Sistem Terverifikasi Otomatis', fontSize: 7, color: '#94a3b8' }
                                ]
                            }
                        ]
                    }
                ],
                defaultStyle: {
                    font: 'Roboto',
                    lineHeight: 1.2
                }
            };

            const fileName = `Evaluasi-Kuis-Cendekia-${getTodayDateKeyWIB()}-${studentName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
            window.pdfMake.createPdf(docDefinition).download(fileName);
        };

        if (window.pdfMake) {
            executePdf();
        } else {
            const script1 = document.createElement('script');
            script1.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.10/pdfmake.min.js';
            script1.onload = () => {
                const script2 = document.createElement('script');
                script2.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.10/vfs_fonts.js';
                script2.onload = () => {
                    executePdf();
                };
                document.head.appendChild(script2);
            };
            document.head.appendChild(script1);
        }
    }

    // Ambil pool soal harian aktif (berlaku s.d. jam 00:00 WIB)
    async function getDailyPool() {
        const now = Date.now();
        const todayKey = getTodayDateKeyWIB();

        // Cek Firestore terlebih dahulu
        try {
            const fb = await getFirebaseBridge();
            if (fb) {
                const snap = await fb.getDoc(fb.doc(fb.db, "mem_free_daily_pool", "active_pool"));
                if (snap.exists()) {
                    const data = snap.data();
                    if (data.expiresAt && now < data.expiresAt && data.dateKey === todayKey && data.questions) {
                        try {
                            localStorage.setItem(STORAGE_KEY_DAILY_POOL, JSON.stringify(data));
                        } catch (e) {}
                        return { active: true, data };
                    }
                }
            }
        } catch (err) {
            console.warn('[Cendekia Central] Gagal membaca pool Firestore, beralih ke cache lokal:', err);
        }

        // Cek cache lokal jika Firestore offline
        try {
            const localRaw = localStorage.getItem(STORAGE_KEY_DAILY_POOL);
            if (localRaw) {
                const parsed = JSON.parse(localRaw);
                if (parsed.expiresAt && now < parsed.expiresAt && parsed.dateKey === todayKey && parsed.questions) {
                    return { active: true, data: parsed };
                }
            }
        } catch (e) {}

        return { active: false, data: null };
    }

    // Hapus / Reset pool soal aktif
    async function resetDailyPool() {
        try {
            localStorage.removeItem(STORAGE_KEY_DAILY_POOL);
            const fb = await getFirebaseBridge();
            if (fb) {
                await fb.deleteDoc(fb.doc(fb.db, "mem_free_daily_pool", "active_pool"));
            }
            return true;
        } catch (err) {
            console.error('[Cendekia Central] Gagal mereset pool harian:', err);
            return false;
        }
    }

    // Generate pool soal harian baru dari materi via backend API Groq (Reset 00:00 WIB)
    async function generateDailyPoolFromMaterials(materials) {
        const res = await fetch('/api/central', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'generate-mem-free-daily',
                materials: materials
            })
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `HTTP ${res.status}: Gagal memproses paket soal.`);
        }

        const resData = await res.json();
        if (!resData.questions) {
            throw new Error('Format hasil generate soal tidak valid.');
        }

        const now = Date.now();
        const expiresAt = getNextMidnightWIBTimestamp(); // Tepat jam 00:00 WIB
        const poolDoc = {
            generatedAt: now,
            expiresAt: expiresAt,
            dateKey: getTodayDateKeyWIB(),
            questions: resData.questions,
            materialsCount: materials.length,
            modelUsed: resData.modelUsed || 'AI Engine',
            status: 'active'
        };

        // Simpan ke Firestore untuk dibagikan ke seluruh member free
        try {
            const fb = await getFirebaseBridge();
            if (fb) {
                await fb.setDoc(fb.doc(fb.db, "mem_free_daily_pool", "active_pool"), poolDoc);
            }
        } catch (e) {
            console.warn('[Cendekia Central] Gagal menyimpan pool ke Firestore:', e);
        }

        // Simpan ke localStorage
        try {
            localStorage.setItem(STORAGE_KEY_DAILY_POOL, JSON.stringify(poolDoc));
        } catch (e) {}

        return poolDoc;
    }

    // Helper sinkronisasi latihan harian untuk game/kuis (Bank Soal terkurasi, Anti-Repetisi 7 Hari, AI Sync & Seleksi Mode)
    async function ensureDailyGame(gameKey, options = {}) {
        const { onLoading, onNoMaterials, onReady } = options;
        if (onLoading) onLoading("Memeriksa kesiapan latihan harian & bank soal...");

        try {
            // 1. Cek apakah ada draft hari ini untuk game ini agar user melanjutkan pengerjaan
            const draft = getGameDraft(gameKey);
            if (draft && draft.questions && draft.questions.length > 0) {
                if (onReady) onReady(draft.questions, { mode: draft.mode || 'santai', isDraft: true, draftData: draft });
                return;
            }

            // 2. Baca mode aktif (dari opsi, URL parameter ?mode=, atau localStorage)
            const urlParams = typeof window !== 'undefined' && window.location ? new URLSearchParams(window.location.search) : new URLSearchParams();
            const activeMode = options.mode || urlParams.get('mode') || localStorage.getItem('cendekia_active_game_mode') || 'santai';
            const targetCount = gameKey === 'kuis_pintar' ? 15 : (gameKey === 'sambung_cerita' ? 3 : 10);

            // 3. Periksa apakah ada paket soal dari pool harian (jika ada, masukkan ke Bank Soal agar tersimpan permanen)
            try {
                const poolRes = await getDailyPool();
                if (poolRes.active && poolRes.data && poolRes.data.questions) {
                    const poolQuestions = poolRes.data.questions[gameKey];
                    if (Array.isArray(poolQuestions) && poolQuestions.length > 0) {
                        addToQuestionBank(gameKey, poolQuestions);
                    }
                }
            } catch (err) {}

            // 4. Seleksi soal dari Bank Soal dengan mode aktif & anti-repetisi 7 hari
            const selectedQuestions = selectQuestionsFromBank(gameKey, targetCount, activeMode);
            if (selectedQuestions && selectedQuestions.length > 0) {
                if (onReady) onReady(selectedQuestions, { mode: activeMode, source: 'bank_soal' });
                return;
            }

            // 5. Fallback ke pembacaan bahan ajar jika bank soal lokal belum siap
            if (onLoading) onLoading("Mengecek ketersediaan bahan ajar kurikulum dari Admin...");
            const materials = await getAllMaterials();

            if (!materials || materials.length === 0) {
                // Bank soal default selalu tersedia sebagai jaminan
                const fallbackQ = getQuestionBank(gameKey);
                if (fallbackQ && fallbackQ.length > 0) {
                    const fallbackSelected = selectQuestionsFromBank(gameKey, targetCount, activeMode);
                    if (onReady) onReady(fallbackSelected, { mode: activeMode, source: 'default_bank' });
                    return;
                }

                if (onNoMaterials) {
                    onNoMaterials("Bahan ajar materi belum diunggah oleh Admin di sistem. Soal latihan harian belum dapat disiapkan.");
                }
                return;
            }

            // 6. User pertama memicu generate via AI Groq lalu ditampung ke Bank Soal
            if (onLoading) onLoading("Sistem sedang menganalisis materi kurikulum & memproses paket soal latihan 24 jam...");
            const newPool = await generateDailyPoolFromMaterials(materials);
            const poolGameData = newPool.questions[gameKey];

            if (poolGameData && Array.isArray(poolGameData) && poolGameData.length > 0) {
                addToQuestionBank(gameKey, poolGameData);
                const finalSelected = selectQuestionsFromBank(gameKey, targetCount, activeMode);
                if (onReady) onReady(finalSelected, newPool);
            } else {
                const fallbackSelected = selectQuestionsFromBank(gameKey, targetCount, activeMode);
                if (onReady) onReady(fallbackSelected, { mode: activeMode, source: 'default_bank' });
            }
        } catch (err) {
            console.error('[Cendekia Central] Error ensureDailyGame:', err);
            // Fallback aman ke Bank Soal internal
            const fallbackSelected = selectQuestionsFromBank(gameKey, gameKey === 'kuis_pintar' ? 15 : 10, 'santai');
            if (fallbackSelected && fallbackSelected.length > 0 && onReady) {
                onReady(fallbackSelected, { mode: 'santai', source: 'default_bank' });
            } else if (onNoMaterials) {
                onNoMaterials("Terjadi kendala saat memuat latihan harian: " + err.message);
            }
        }
    }

    // Helper format hitung mundur (misal: "18j 24m 10d")
    function formatTimeRemaining(ms) {
        if (ms <= 0) return 'Kadaluarsa';
        const totalSecs = Math.floor(ms / 1000);
        const hours = Math.floor(totalSecs / 3600);
        const mins = Math.floor((totalSecs % 3600) / 60);
        const secs = totalSecs % 60;
        return `${hours}j ${mins}m ${secs}d`;
    }

    // Ambil data peringkat pengguna asli (Leaderboard nyata tanpa dummy)
    async function getLeaderboardUsers() {
        const currentUser = getUser();
        const usersList = [];

        try {
            const fb = await getFirebaseBridge();
            if (fb && fb.db) {
                const snap = await fb.getDocs(fb.collection(fb.db, "users"));
                snap.forEach(d => {
                    const data = d.data();
                    const xp = typeof data.xp === 'number' ? data.xp : (parseInt(data.xp) || 0);
                    // Masukkan hanya user asli yang memiliki nama dan terdaftar di database
                    if (data.name || data.email || xp > 0) {
                        usersList.push({
                            uid: d.id,
                            name: data.name || 'Siswa Cendekia',
                            username: data.username || '',
                            photoURL: data.photoURL || '',
                            levelTitle: data.levelTitle || 'Penulis Pemula 🌱',
                            semester: data.semester ? `Semester ${data.semester}` : (data.role === 'siswa' ? 'Siswa' : 'Member Free'),
                            xp: xp,
                            isCurrentUser: (fb.auth?.currentUser && d.id === fb.auth.currentUser.uid) || (data.email && data.email === currentUser.email)
                        });
                    }
                });
            }
        } catch (err) {
            console.warn('[Cendekia Central] Gagal membaca koleksi users dari Firestore:', err);
        }

        // Pastikan pengguna saat ini masuk ke daftar jika belum ada
        const alreadyInList = usersList.some(u => u.isCurrentUser || (currentUser.email && u.email === currentUser.email));
        if (!alreadyInList) {
            usersList.push({
                uid: currentUser.uid || 'me',
                name: currentUser.name || 'Siswa Cendekia',
                username: currentUser.username || '',
                photoURL: currentUser.photoURL || '',
                levelTitle: currentUser.levelTitle || 'Penulis Pemula 🌱',
                semester: currentUser.semester ? `Semester ${currentUser.semester}` : 'Member Free',
                xp: currentUser.xp || 0,
                isCurrentUser: true
            });
        }

        // Urutkan berdasarkan XP tertinggi ke terendah
        usersList.sort((a, b) => b.xp - a.xp);

        // Beri nomor peringkat asli
        usersList.forEach((u, idx) => {
            u.rank = idx + 1;
        });

        return usersList;
    }

    // 12. INIT ENGINE
    function init() {
        getUser();
        updateDOMStats();
        if (window.lucide) {
            lucide.createIcons();
        }
        syncWithFirebaseUser();
    }

    return {
        getUser,
        saveUser,
        addXP,
        logActivity,
        getHistory,
        getWeeklyActivityStats,
        renderWeeklyCalendarWidget,
        getDailyChallenges,
        completeChallenge,
        getWorks,
        saveWork,
        getIdeas,
        saveIdea,
        analyzeWritingSystem,
        getClassDashboardUrl,
        renderBottomNav,
        updateDOMStats,
        getFirebaseBridge,
        renderFormattedMaterial,
        getMaterialByCategory,
        getMaterialsByCategory,
        normalizeCategoryKey,
        getAllMaterials,
        saveMaterial,
        deleteMaterial,
        getDailyPool,
        resetDailyPool,
        generateDailyPoolFromMaterials,
        ensureDailyGame,
        formatTimeRemaining,
        getWIBDate,
        getTodayDateKeyWIB,
        getNextMidnightWIBTimestamp,
        formatCountdownToMidnightWIB,
        saveGameDraft,
        getGameDraft,
        clearGameDraft,
        saveGameResult,
        getGameResult,
        isGameCompletedToday,
        downloadEvaluationPDF,
        getLeaderboardUsers,
        recordMaterialRead,
        recordGameCompleted,
        checkAndAwardBadges,
        showBadgeUnlockedModal,
        getTransactions,
        recordTransaction,
        upgradeUserTier,
        downgradeToFree,
        getMembershipInfo,
        getStreakFlameInfo,
        showStreakInfoModal,
        syncMemoryToFirestore,
        askAksaBotAI,
        askMentorAI,
        getQuestionBank,
        addToQuestionBank,
        getServedQuestionHistory,
        markQuestionsServed,
        selectQuestionsFromBank,
        getTodayEarnedXP,
        getUnfinishedGames,
        showFloatingXP,
        showEncouragementToast,
        init,
        IS_MEM_5K,
        PORTAL_PREFIX,
        MEMBERSHIP_DURATION_DAYS,
        BADGE_CATALOG,
        LEVELS
    };
})();

// Pastikan tersedia di objek window
if (typeof window !== 'undefined') {
    window.CendekiaApp = CendekiaApp;
}

// Jalankan otomatis saat DOM siap
document.addEventListener('DOMContentLoaded', () => {
    CendekiaApp.init();
});
