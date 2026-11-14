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

    // LEVEL DEFINITIONS
    const LEVELS = [
        { level: 1, title: 'Penulis Pemula 🌱', minXp: 0, maxXp: 100 },
        { level: 2, title: 'Pena Muda ✍️', minXp: 100, maxXp: 250 },
        { level: 3, title: 'Penjelajah Aksara 📖', minXp: 250, maxXp: 500 },
        { level: 4, title: 'Pujangga Berbakat 🌟', minXp: 500, maxXp: 1000 },
        { level: 5, title: 'Mahaguru Literasi 👑', minXp: 1000, maxXp: 2500 }
    ];

    // DEFAULT USER
    const defaultUser = {
        uid: 'guest_' + Math.random().toString(36).substring(2, 9),
        name: 'Siswa Cendekia',
        username: 'cendekia_muda',
        email: 'member@cendekia.id',
        role: 'siswa',
        semester: 1,
        tier: 'Member Free',
        photoURL: '',
        noHp: '',
        tanggalLahir: '',
        alamat: '',
        bioSingkat: '',
        xp: 45,
        level: 1,
        levelTitle: 'Penulis Pemula 🌱',
        streak: 3,
        lastActiveDate: new Date().toISOString().split('T')[0],
        privacyRank: true, // true: tampil nama asli, false: anonim
        badges: ['badge_first_step', 'badge_reading_lover'],
        stats: {
            quizCompleted: 4,
            gamesCompleted: 6,
            materialsLearned: 5,
            worksCreated: 2,
            ideasArchived: 3
        }
    };

    // BADGES DATABASE
    const BADGE_CATALOG = {
        'badge_first_step': { id: 'badge_first_step', name: 'Langkah Pertama', icon: 'footprints', desc: 'Membuka portal literasi Member Free.' },
        'badge_reading_lover': { id: 'badge_reading_lover', name: 'Pencinta Pustaka', icon: 'book-heart', desc: 'Membaca modul sastra mandiri.' },
        'badge_word_master': { id: 'badge_word_master', name: 'Pengrajin Kata', icon: 'pen-tool', desc: 'Menyusun karya sastra pertama di ruang menulis.' },
        'badge_quiz_champ': { id: 'badge_quiz_champ', name: 'Juara Kuis', icon: 'trophy', desc: 'Menyelesaikan 5 kuis dengan nilai sempurna.' },
        'badge_streak_7': { id: 'badge_streak_7', name: 'Api Konsisten', icon: 'flame', desc: 'Aktif belajar literasi 7 hari berturut-turut.' },
        'badge_idea_spark': { id: 'badge_idea_spark', name: 'Pemantik Kreatif', icon: 'sparkles', desc: 'Menyimpan 5 ide cerita di laboratorium kreasi.' }
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
            // Ambil dari sesi login Firebase/login.html jika ada
            try {
                const legacy = localStorage.getItem('cendekia_user');
                if (legacy) {
                    const l = JSON.parse(legacy);
                    defaultUser.name = l.name || defaultUser.name;
                    defaultUser.email = l.email || defaultUser.email;
                    defaultUser.semester = parseInt(l.semester) || defaultUser.semester;
                    defaultUser.photoURL = l.photoURL || defaultUser.photoURL;
                    defaultUser.noHp = l.noHp || defaultUser.noHp;
                    defaultUser.tanggalLahir = l.tanggalLahir || defaultUser.tanggalLahir;
                    defaultUser.alamat = l.alamat || defaultUser.alamat;
                    defaultUser.bioSingkat = l.bioSingkat || defaultUser.bioSingkat;
                }
            } catch (e) {}
            user = defaultUser;
            saveUser(user);
        }

        // Hitung streak otomatis
        checkStreak(user);
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

        // Catat Riwayat Aktivitas
        logActivity(reason, 'award', 'xp', points);

        // Tampilkan Notifikasi Toast
        showXPToast(`+${points} XP: ${reason}!`);

        if (leveledUp) {
            showLevelUpModal(user.level, user.levelTitle);
        }

        // Perbarui elemen UI di halaman aktif jika ada
        updateDOMStats();
        return { xp: user.xp, level: user.level, leveledUp };
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
            history.unshift({
                id: 'act_' + Date.now(),
                title,
                icon,
                type,
                value,
                time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                date: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
            });
            if (history.length > 20) history = history.slice(0, 20);
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

    // 5. TANTANGAN HARIAN SISTEM
    function getDailyChallenges() {
        const today = new Date().toISOString().split('T')[0];
        let saved = null;
        try {
            const raw = localStorage.getItem(STORAGE_KEY_CHALLENGES);
            if (raw) saved = JSON.parse(raw);
        } catch (e) {}

        if (!saved || saved.date !== today) {
            // Generate Tantangan Harian Baru
            saved = {
                date: today,
                list: [
                    {
                        id: 'tc_1',
                        type: 'pengetahuan',
                        badge: 'Misi Pengetahuan',
                        title: 'Jelajahi Diksi Bahasa Indonesia Baku',
                        desc: 'Pelajari 1 materi ejaan & kosakata di bagian Pengetahuan Umum.',
                        rewardXp: 20,
                        link: '/mem-free/pengetahuan-umum.html',
                        completed: false
                    },
                    {
                        id: 'tc_2',
                        type: 'permainan',
                        badge: 'Misi Permainan',
                        title: 'Tantangan Tebak Kata Cendekia',
                        desc: 'Selesaikan 1 ronde permainan Tebak Kata atau Susun Kata dengan tuntas.',
                        rewardXp: 25,
                        link: '/mem-free/permainan/tebak-kata.html',
                        completed: false
                    },
                    {
                        id: 'tc_3',
                        type: 'berkarya',
                        badge: 'Misi Kreatif',
                        title: 'Goreskan Paragraf Pertama',
                        desc: 'Tuliskan minimal 50 kata di Ruang Menulis atau Eksperimen Puisi.',
                        rewardXp: 30,
                        link: '/mem-free/berkarya/ruang-menulis.html',
                        completed: false
                    }
                ]
            };
            try {
                localStorage.setItem(STORAGE_KEY_CHALLENGES, JSON.stringify(saved));
            } catch (e) {}
        }
        return saved.list;
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

    // 7. TELAAH KURASI SISTEM CENDEKIA (SISTEM CERDAS BERKARYA TANPA KATA TERLARANG)
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
        const percent = Math.min(100, Math.max(10, Math.round((xpInCurrentLevel / totalXpInLevel) * 100)));
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
            if (img.parentElement) {
                const icon = img.parentElement.querySelector('.default-avatar-icon');
                if (icon) icon.style.display = 'none';
            }
        });
    }

    // 11. INIT ENGINE
    function init() {
        getUser();
        updateDOMStats();
        if (window.lucide) {
            lucide.createIcons();
        }
    }

    return {
        getUser,
        saveUser,
        addXP,
        logActivity,
        getHistory,
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
        init,
        BADGE_CATALOG,
        LEVELS
    };
})();

// Jalankan otomatis saat DOM siap
document.addEventListener('DOMContentLoaded', () => {
    CendekiaApp.init();
});
