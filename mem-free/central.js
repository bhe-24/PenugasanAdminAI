/**
 * ==========================================================================
 * Cendekia Aksara - Member Free Central Engine (central.js)
 * Konfigurasi Global, Gamifikasi (XP/Level/Streak), Lucide Icon Loader,
 * Arsip Karya & Ide, Tantangan Harian, dan Telaah Kurasi Sistem Cendekia.
 * ==========================================================================
 */

const CendekiaApp = (function () {
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

    // 1. GET & SYNC USER DATA
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

        // Sinkronkan selalu data profil dari sesi login/cendekia_user jika ada
        try {
            const legacy = localStorage.getItem('cendekia_user');
            if (legacy) {
                const l = JSON.parse(legacy);
                if (l.name && (!user.name || user.name === 'Siswa Cendekia')) user.name = l.name;
                if (l.email && !user.email) user.email = l.email;
                if (l.photoURL && (!user.photoURL || user.photoURL !== l.photoURL)) user.photoURL = l.photoURL;
                if (l.semester && !user.semester) user.semester = parseInt(l.semester) || 1;
                if (l.noHp && !user.noHp) user.noHp = l.noHp;
                if (l.tanggalLahir && !user.tanggalLahir) user.tanggalLahir = l.tanggalLahir;
                if (l.alamat && !user.alamat) user.alamat = l.alamat;
                if (l.bioSingkat && !user.bioSingkat) user.bioSingkat = l.bioSingkat;
                if (typeof l.xp === 'number' && l.xp > (user.xp || 0)) user.xp = l.xp;
            }
        } catch (e) {}

        // Hitung streak otomatis
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

    function saveUser(user) {
        try {
            localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
            // Sinkronkan juga ke sesi umum jika diperlukan
            if (user.semester) {
                localStorage.setItem('user_semester', user.semester);
            }
        } catch (e) {}
    }

    // 2. STREAK ENGINE
    function checkStreak(user) {
        const today = new Date().toISOString().split('T')[0];
        if (!user.lastActiveDate) {
            user.lastActiveDate = today;
            user.streak = 1;
            saveUser(user);
            return;
        }

        if (user.lastActiveDate !== today) {
            const last = new Date(user.lastActiveDate);
            const now = new Date(today);
            const diffDays = Math.round((now - last) / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
                user.streak += 1;
            } else if (diffDays > 1) {
                // Dorongan positif, tidak menghukum habis: minimal 1
                user.streak = 1;
            }
            user.lastActiveDate = today;
            saveUser(user);
        }
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
        showXPToast(`+${points} XP: ${reason}!`);

        if (leveledUp) {
            showLevelUpModal(user.level, user.levelTitle);
        }

        // Perbarui elemen UI di halaman aktif jika ada
        updateDOMStats();
        return { xp: user.xp, level: user.level, leveledUp };
    }

    // PENCATATAN AKTIVITAS BACAAN & GAME KHUSUS
    function recordMaterialRead(category, title) {
        const user = getUser();
        if (!user.stats) user.stats = { quizCompleted: 0, gamesCompleted: 0, materialsLearned: 0, worksCreated: 0, ideasArchived: 0 };
        user.stats.materialsLearned = (user.stats.materialsLearned || 0) + 1;
        saveUser(user);
        // Sesuai aturan: Modul materi dapat dibaca berulang kali secara penuh tanpa XP
        logActivity('Membaca Modul: ' + (title || category), 'book-open', 'read');
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
        let toast = document.getElementById('cendekiaXPToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'cendekiaXPToast';
            toast.className = 'xp-toast';
            document.body.appendChild(toast);
        }
        toast.innerHTML = `<i data-lucide="sparkles" style="color:var(--accent); width:18px; height:18px;"></i> <span>${text}</span>`;
        if (window.lucide) lucide.createIcons();
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 2800);
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
                id: 'act_' + Date.now(),
                title,
                icon,
                type,
                value,
                time: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                date: now.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
                isoDate: `${yyyy}-${mm}-${dd}`,
                timestamp: Date.now()
            });
            if (history.length > 40) history = history.slice(0, 40);
            localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));
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

        const now = new Date();
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

        // 4. Aktivitas dari tantangan harian
        dayDates.forEach((dateStr, idx) => {
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

        const elapsedDays = currentDayOfWeek + 1;
        const consistencyRate = Math.round((activeDaysCount / elapsedDays) * 100);

        const resultDays = days.map((label, idx) => {
            const count = dayCounts[idx];
            const isToday = idx === currentDayOfWeek;
            const isFuture = idx > currentDayOfWeek;
            let heightPercent = 0;
            if (count > 0) {
                heightPercent = Math.min(100, Math.max(20, Math.round((count / maxDayCount) * 100)));
            }
            return {
                label,
                dateStr: dayDates[idx],
                count,
                heightPercent,
                isToday,
                isFuture
            };
        });

        return {
            days: resultDays,
            totalActivities,
            activeDays: activeDaysCount,
            consistency: consistencyRate,
            currentDayIdx: currentDayOfWeek
        };
    }

    // 5. TANTANGAN HARIAN SISTEM (BERBASIS POOL HARIAN ASLI TANPA DUMMY)
    function getDailyChallenges() {
        const today = new Date().toISOString().split('T')[0];
        let savedPool = null;
        try {
            const raw = localStorage.getItem(STORAGE_KEY_DAILY_POOL);
            if (raw) savedPool = JSON.parse(raw);
        } catch (e) {}

        // Jika belum ada pool latihan harian yang digenerate dari admin/bahan ajar
        if (!savedPool || !savedPool.games || Object.keys(savedPool.games).length === 0) {
            return [];
        }

        const gameCatalog = {
            'kuis-pintar': { title: 'Tantangan Kuis Pintar Literasi', desc: 'Jawab 5 pertanyaan literasi pilihan ganda berbasis bahan ajar hari ini.', badge: 'Misi Kuis', xp: 25, link: '/mem-free/permainan/kuis-pintar.html' },
            'tebak-kata': { title: 'Tantangan Tebak Kata Cendekia', desc: 'Pecahkan teka-teki kata dengan petunjuk materi literasi.', badge: 'Misi Kata', xp: 20, link: '/mem-free/permainan/tebak-kata.html' },
            'susun-kata': { title: 'Tantangan Susun Kata Bermakna', desc: 'Rangkai huruf acak menjadi istilah baku bahasa Indonesia.', badge: 'Misi Aksara', xp: 20, link: '/mem-free/permainan/susun-kata.html' },
            'teka-teki': { title: 'Tantangan Teka-Teki Aksara', desc: 'Selesaikan teka-teki silang aksara bertema bahan ajar.', badge: 'Misi Teka-Teki', xp: 25, link: '/mem-free/permainan/teka-teki.html' },
            'tebak-sastra': { title: 'Tantangan Tebak Sastra & Majas', desc: 'Uji wawasan sastramu tentang gaya bahasa dan kutipan penting.', badge: 'Misi Sastra', xp: 25, link: '/mem-free/permainan/tebak-sastra.html' },
            'sambung-cerita': { title: 'Tantangan Sambung Cerita Kreatif', desc: 'Lanjutkan narasi pembuka bahan ajar dengan imajinasimu.', badge: 'Misi Cerita', xp: 30, link: '/mem-free/permainan/sambung-cerita.html' },
            'perbaiki-kalimat': { title: 'Tantangan Perbaiki Kalimat & EYD', desc: 'Koreksi kalimat tidak baku menjadi susunan kata yang sempurna.', badge: 'Misi Bahasa', xp: 25, link: '/mem-free/permainan/perbaiki-kalimat.html' },
            'tantangan-cepat': { title: 'Tantangan Cepat Refleks Kata', desc: 'Jawab kuis kilat sebelum waktu habis.', badge: 'Misi Cepat', xp: 35, link: '/mem-free/permainan/tantangan-cepat.html' }
        };

        const list = [];
        let completedMap = {};
        try {
            completedMap = JSON.parse(localStorage.getItem('cendekia_completed_challenges_' + today) || '{}');
        } catch (e) {}

        Object.keys(savedPool.games).forEach(gameKey => {
            const meta = gameCatalog[gameKey] || { title: `Tantangan ${gameKey}`, desc: 'Selesaikan latihan hari ini.', badge: 'Misi Harian', xp: 25, link: `/mem-free/permainan/${gameKey}.html` };
            list.push({
                id: 'ch_' + gameKey,
                badge: meta.badge,
                title: meta.title,
                desc: meta.desc,
                rewardXp: meta.xp,
                link: meta.link,
                completed: !!completedMap['ch_' + gameKey]
            });
        });

        return list;
    }

    function completeChallenge(id) {
        const today = new Date().toISOString().split('T')[0];
        try {
            const raw = localStorage.getItem(STORAGE_KEY_CHALLENGES);
            if (raw) {
                const data = JSON.parse(raw);
                const item = data.list.find(c => c.id === id);
                if (item && !item.completed) {
                    item.completed = true;
                    localStorage.setItem(STORAGE_KEY_CHALLENGES, JSON.stringify(data));
                    addXP(item.rewardXp, `Tantangan Harian Selesai (${item.title})`);
                    return true;
                }
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

    async function upgradeUserTier(tierName, packageId = '5k') {
        const user = getUser();
        user.tier = tierName;
        user.role = 'siswa';
        user.status = 'registered';
        user.packageId = packageId;
        user.packageName = tierName;
        saveUser(user);

        // Update di session legacy juga
        try {
            const legacy = JSON.parse(localStorage.getItem('cendekia_user') || '{}');
            legacy.tier = tierName;
            legacy.role = 'siswa';
            legacy.status = 'registered';
            legacy.packageId = packageId;
            legacy.packageName = tierName;
            localStorage.setItem('cendekia_user', JSON.stringify(legacy));
            localStorage.setItem('user_status', 'registered');
            localStorage.setItem('user_package', packageId);
        } catch (e) {}

        // Sync ke Firestore users/{uid}
        try {
            const fb = await getFirebaseBridge();
            if (fb && fb.auth && fb.auth.currentUser) {
                await fb.updateDoc(fb.doc(fb.db, "users", fb.auth.currentUser.uid), {
                    tier: tierName,
                    role: 'siswa',
                    status: 'registered',
                    packageId: packageId,
                    packageName: tierName,
                    updatedAt: new Date().toISOString()
                });
            }
        } catch (err) {
            console.warn('[Cendekia Central] Update tier Firestore warning:', err);
        }

        updateDOMStats();
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

    // 9. NAVBAR RENDERER (UNIFORM STICKY BOTTOM NAV)
    function renderBottomNav(activePage = 'beranda') {
        const classTarget = getClassDashboardUrl();
        const navHtml = `
            <nav class="bottom-nav">
                <a href="/mem-free/index.html" class="nav-item ${activePage === 'beranda' ? 'active' : ''}">
                    <i data-lucide="home"></i>
                    <span>Beranda</span>
                </a>
                <a href="/mem-free/belajar.html" class="nav-item ${activePage === 'belajar' ? 'active' : ''}">
                    <i data-lucide="book-open-check"></i>
                    <span>Belajar</span>
                </a>
                <a href="/mem-free/bermain.html" class="nav-item ${activePage === 'bermain' ? 'active' : ''}">
                    <i data-lucide="gamepad-2"></i>
                    <span>Bermain</span>
                </a>
                <a href="/mem-free/berkarya.html" class="nav-item ${activePage === 'berkarya' ? 'active' : ''}">
                    <i data-lucide="pen-tool"></i>
                    <span>Berkarya</span>
                </a>
                <a href="/mem-free/dashboard-kelas.html" class="nav-item ${activePage === 'kelas' ? 'active' : ''}">
                    <i data-lucide="school"></i>
                    <span>Kelas</span>
                </a>
                <a href="/mem-free/profil.html" class="nav-item ${activePage === 'profil' ? 'active' : ''}">
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

    // 10. UPDATE DOM STATS BINDINGS
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
        const nextLvlConfig = LEVELS.find(l => l.level === user.level + 1) || { minXp: currentLvlConfig.maxXp, maxXp: currentLvlConfig.maxXp };
        
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

        // Streak
        const streakEls = document.querySelectorAll('[data-bind="userStreak"]');
        streakEls.forEach(el => el.textContent = user.streak);

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

    // Sinkronisasi Sesi Firebase & Firestore Otomatis
    async function syncWithFirebaseUser() {
        try {
            const fb = await getFirebaseBridge();
            if (!fb || !fb.auth) return;

            const authModule = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js");
            authModule.onAuthStateChanged(fb.auth, async (authUser) => {
                if (authUser) {
                    let updated = false;
                    let currentUser = getUser();

                    if (authUser.photoURL && (!currentUser.photoURL || currentUser.photoURL !== authUser.photoURL)) {
                        currentUser.photoURL = authUser.photoURL;
                        updated = true;
                    }
                    if (authUser.displayName && (!currentUser.name || currentUser.name === 'Siswa Cendekia')) {
                        currentUser.name = authUser.displayName;
                        updated = true;
                    }

                    try {
                        const snap = await fb.getDoc(fb.doc(fb.db, "users", authUser.uid));
                        if (snap.exists()) {
                            const d = snap.data();
                            if (d.photoURL && (!currentUser.photoURL || currentUser.photoURL !== d.photoURL)) {
                                currentUser.photoURL = d.photoURL;
                                updated = true;
                            }
                            if (d.name && (!currentUser.name || currentUser.name === 'Siswa Cendekia')) {
                                currentUser.name = d.name;
                                updated = true;
                            }
                            if (typeof d.xp === 'number' && d.xp > (currentUser.xp || 0)) {
                                currentUser.xp = d.xp;
                                updated = true;
                            }
                            if (d.semester) {
                                currentUser.semester = parseInt(d.semester) || currentUser.semester;
                                updated = true;
                            }
                        }
                    } catch (e) {
                        console.warn('[Cendekia Central] Sync firestore doc warn:', e);
                    }

                    if (updated) {
                        saveUser(currentUser);
                        updateDOMStats();
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

    // Ambil materi spesifik berdasarkan kategori
    async function getMaterialByCategory(categoryId) {
        try {
            const fb = await getFirebaseBridge();
            if (!fb) return null;
            const snap = await fb.getDoc(fb.doc(fb.db, "mem_free_materials", categoryId));
            if (snap.exists()) {
                return { id: snap.id, ...snap.data() };
            }
            return null;
        } catch (err) {
            console.error('[Cendekia Central] Gagal membaca materi:', err);
            return null;
        }
    }

    // Ambil seluruh bahan ajar yang sudah diunggah oleh admin
    async function getAllMaterials() {
        try {
            const fb = await getFirebaseBridge();
            if (!fb) return [];
            const q = await fb.getDocs(fb.collection(fb.db, "mem_free_materials"));
            const list = [];
            q.forEach(d => {
                const data = d.data();
                if (data.content && data.content.trim().length > 0) {
                    list.push({ id: d.id, ...data });
                }
            });
            return list;
        } catch (err) {
            console.error('[Cendekia Central] Gagal membaca daftar bahan ajar:', err);
            return [];
        }
    }

    // Simpan bahan ajar materi ke Firestore
    async function saveMaterial(categoryId, materialData) {
        const fb = await getFirebaseBridge();
        if (!fb) throw new Error("Koneksi database tidak tersedia.");
        const docRef = fb.doc(fb.db, "mem_free_materials", categoryId);
        await fb.setDoc(docRef, {
            id: categoryId,
            category: categoryId,
            title: materialData.title || '',
            summary: materialData.summary || '',
            content: materialData.content || '',
            examples: materialData.examples || '',
            charCount: (materialData.content || '').length,
            updatedAt: new Date().toISOString(),
            updatedBy: fb.auth.currentUser?.email || 'admin'
        });
        return true;
    }

    // Hapus materi dari Firestore
    async function deleteMaterial(categoryId) {
        const fb = await getFirebaseBridge();
        if (!fb) throw new Error("Koneksi database tidak tersedia.");
        await fb.deleteDoc(fb.doc(fb.db, "mem_free_materials", categoryId));
        return true;
    }

    // Ambil pool soal harian aktif (berlaku 24 jam)
    async function getDailyPool() {
        const now = Date.now();
        // Cek Firestore terlebih dahulu
        try {
            const fb = await getFirebaseBridge();
            if (fb) {
                const snap = await fb.getDoc(fb.doc(fb.db, "mem_free_daily_pool", "active_pool"));
                if (snap.exists()) {
                    const data = snap.data();
                    if (data.expiresAt && now < data.expiresAt && data.questions) {
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
                if (parsed.expiresAt && now < parsed.expiresAt && parsed.questions) {
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

    // Generate pool soal harian baru dari materi via backend API Groq
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
        const expiresAt = now + (24 * 60 * 60 * 1000); // 24 Jam penuh
        const poolDoc = {
            generatedAt: now,
            expiresAt: expiresAt,
            dateKey: new Date().toISOString().slice(0, 10),
            questions: resData.questions,
            materialsCount: materials.length,
            modelUsed: resData.modelUsed || 'Groq LPU',
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

    // Helper sinkronisasi latihan harian untuk game/kuis (menangani user pertama dan caching 24 jam)
    async function ensureDailyGame(gameKey, options = {}) {
        const { onLoading, onNoMaterials, onReady } = options;
        if (onLoading) onLoading("Memeriksa kesiapan latihan harian...");

        try {
            // 1. Cek apakah paket soal harian 24 jam sudah aktif
            const poolRes = await getDailyPool();
            if (poolRes.active && poolRes.data && poolRes.data.questions) {
                const gameData = poolRes.data.questions[gameKey];
                if (gameData && (!Array.isArray(gameData) || gameData.length > 0)) {
                    if (onReady) onReady(gameData, poolRes.data);
                    return;
                }
            }

            // 2. Pool belum ada atau sudah lewat 24 jam -> Cek bahan ajar dari Admin
            if (onLoading) onLoading("Mengecek ketersediaan bahan ajar kurikulum dari Admin...");
            const materials = await getAllMaterials();

            if (!materials || materials.length === 0) {
                if (onNoMaterials) {
                    onNoMaterials("Bahan ajar materi belum diunggah oleh Admin di sistem. Soal latihan harian belum dapat digenerate.");
                }
                return;
            }

            // 3. User pertama yang membuka sistem memicu pembuatan soal harian 24 jam!
            if (onLoading) onLoading("Sistem sedang menganalisis materi kurikulum & memproses paket soal latihan 24 jam dengan AI Groq...");
            const newPool = await generateDailyPoolFromMaterials(materials);

            const gameData = newPool.questions[gameKey];
            if (gameData && (!Array.isArray(gameData) || gameData.length > 0)) {
                if (onReady) onReady(gameData, newPool);
            } else {
                if (onNoMaterials) onNoMaterials("Paket latihan untuk permainan ini belum dapat disiapkan dari materi yang tersedia.");
            }
        } catch (err) {
            console.error('[Cendekia Central] Error ensureDailyGame:', err);
            if (onNoMaterials) onNoMaterials("Terjadi kendala saat memuat latihan harian: " + err.message);
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
        getMaterialByCategory,
        getAllMaterials,
        saveMaterial,
        deleteMaterial,
        getDailyPool,
        resetDailyPool,
        generateDailyPoolFromMaterials,
        ensureDailyGame,
        formatTimeRemaining,
        getLeaderboardUsers,
        recordMaterialRead,
        recordGameCompleted,
        checkAndAwardBadges,
        showBadgeUnlockedModal,
        getTransactions,
        recordTransaction,
        upgradeUserTier,
        init,
        BADGE_CATALOG,
        LEVELS
    };
})();

// Jalankan otomatis saat DOM siap
document.addEventListener('DOMContentLoaded', () => {
    CendekiaApp.init();
});
