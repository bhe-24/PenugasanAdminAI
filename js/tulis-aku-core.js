import { auth, db } from '/js/firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import {
    doc, getDoc, setDoc, increment
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

const cfg = window.TULIS_AKU_CONFIG || {
    tier: '5k',
    tierLabel: 'Member 5K',
    backUrl: '/mem-5k/bermain.html',
    upgradeUrl: '/mem-5k/langganan.html',
    locked: false
};

const WIB_OFFSET_MS = 7 * 3600 * 1000;
const TWELVE_H_MS = 12 * 3600 * 1000;

let state = {
    uid: '',
    user: null,
    mode: 'santai',
    wibDayKey: '',
    slot12Key: '',
    stage: 0,           // 0 = tidur awal, 1..8 = tahap pertumbuhan beruang
    sleepLock: true,    // true = beruang sedang tertidur (awal hari atau gagal)
    completedToday: false,
    startedAtMs: 0,
    elapsedSeconds: 0,
    bonusAwarded: 0,
    xpEarnedToday: 0,
    stageQuestions: [], // 8 soal utama (stage 1..8)
    reserveQuestions: [], // soal cadangan setelah beruang bangun penuh
    activeReserveIdx: -1,
    seenFingerprints: [],
    completedLogs: [],
    solvedStep1Map: {},   // { [challengeId]: { words: [...], note: '...' } }
    guessAttemptsMap: {}, // { [challengeId]: number }
    isEvaluating: false,
    playReserveMode: false
};

function escapeHtml(str) {
    if (!str && str !== 0) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getWibDayKey(ms = Date.now()) {
    const d = new Date(ms + WIB_OFFSET_MS);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function get12WibSlotKey(ms = Date.now()) {
    const shifted = new Date(ms + WIB_OFFSET_MS - TWELVE_H_MS);
    const y = shifted.getUTCFullYear();
    const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
    const day = String(shifted.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}_12WIB`;
}

function formatCountdownMs(diffMs) {
    const s = Math.max(0, Math.floor(diffMs / 1000));
    const hh = String(Math.floor(s / 3600)).padStart(2, '0');
    const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
}

function startCountdowns() {
    const tick = () => {
        const now = Date.now();

        // Jika melewati tengah malam 00:00 WIB atau slot 12:00 WIB saat bermain, perbarui sesi otomatis
        const liveDay = getWibDayKey(now);
        const liveSlot = get12WibSlotKey(now);
        if (state.wibDayKey && liveDay !== state.wibDayKey) {
            state.wibDayKey = liveDay;
            state.slot12Key = liveSlot;
            loadGameSession();
        } else if (state.slot12Key && liveSlot !== state.slot12Key) {
            state.slot12Key = liveSlot;
            ensureQuestionsForCurrentSlot(true);
        }

        // Perbarui waktu berjalan yang aktif
        if (!state.completedToday && state.startedAtMs > 0) {
            const sec = Math.max(0, Math.floor((now - state.startedAtMs) / 1000));
            const minTxt = String(Math.floor(sec / 60)).padStart(2, '0');
            const secTxt = String(sec % 60).padStart(2, '0');
            const timerEl = document.getElementById('taElapsedClock');
            if (timerEl) timerEl.textContent = `${minTxt}:${secTxt}`;
        }
    };
    tick();
    setInterval(tick, 1000);
}

function getStorageUserId() {
    if (state.uid) return state.uid;
    try {
        const u = window.CendekiaApp?.getUser?.() || JSON.parse(localStorage.getItem('cendekia_user') || localStorage.getItem('cendekia_free_user') || '{}');
        return u.uid || u.id || u.email || 'guest';
    } catch (_) {
        return 'guest';
    }
}

function getBankStorageKey() {
    return `tulis_aku_bank_v1_${getStorageUserId()}`;
}

function getProgressStorageKey(mode = state.mode) {
    return `tulis_aku_prog_${state.wibDayKey}_${mode}_${getStorageUserId()}`;
}

function getPoolStorageKey(slot = state.slot12Key, mode = state.mode) {
    return `tulis_aku_pool_v2_${slot}_${mode}`;
}

function loadLocalSeenBank() {
    try {
        const parsed = JSON.parse(localStorage.getItem(getBankStorageKey()) || '{}');
        return Array.isArray(parsed.seenFingerprints) ? parsed.seenFingerprints : [];
    } catch (_) {
        return [];
    }
}

function saveSeenQuestionToBank(question, evalResult) {
    if (!question) return;
    const fp = String(question.fingerprint || question.id || '').toLowerCase();
    if (fp && !state.seenFingerprints.includes(fp)) {
        state.seenFingerprints.push(fp);
    }

    const logItem = {
        id: question.id,
        fingerprint: fp,
        title: question.title,
        prompt: question.prompt,
        stage: question.stage,
        mode: state.mode,
        score: evalResult?.score || 100,
        completedAt: new Date().toISOString()
    };
    state.completedLogs.unshift(logItem);
    if (state.completedLogs.length > 40) state.completedLogs = state.completedLogs.slice(0, 40);

    try {
        localStorage.setItem(getBankStorageKey(), JSON.stringify({
            seenFingerprints: state.seenFingerprints.slice(-150),
            updatedAt: Date.now()
        }));
    } catch (_) {}

    if (state.uid) {
        setDoc(doc(db, 'users', state.uid, 'tulis_aku_meta', 'bank'), {
            seenFingerprints: state.seenFingerprints.slice(-150),
            recentLogs: state.completedLogs.slice(0, 20),
            updatedAt: new Date().toISOString()
        }, { merge: true }).catch(() => {});
    }
}

function saveDailyProgress() {
    const payload = {
        mode: state.mode,
        wibDayKey: state.wibDayKey,
        slot12Key: state.slot12Key,
        stage: state.stage,
        sleepLock: state.sleepLock,
        completedToday: state.completedToday,
        startedAtMs: state.startedAtMs,
        elapsedSeconds: state.elapsedSeconds,
        bonusAwarded: state.bonusAwarded,
        xpEarnedToday: state.xpEarnedToday,
        stageQuestions: state.stageQuestions,
        reserveQuestions: state.reserveQuestions,
        activeReserveIdx: state.activeReserveIdx,
        completedLogs: state.completedLogs.slice(0, 25),
        solvedStep1Map: state.solvedStep1Map,
        guessAttemptsMap: state.guessAttemptsMap,
        playReserveMode: state.playReserveMode,
        updatedAt: Date.now()
    };

    try {
        localStorage.setItem(getProgressStorageKey(), JSON.stringify(payload));
        if (state.completedToday || state.stage >= 8) {
            localStorage.setItem('cendekia_tulis_aku_awake_date', state.wibDayKey);
        }
        // Simpan status draft untuk pengingat di halaman bermain.html (khusus tier ber-central.js)
        if (window.CendekiaApp?.saveGameDraft && !state.completedToday) {
            window.CendekiaApp.saveGameDraft('tulis_aku', {
                currentIndex: state.stage,
                score: state.xpEarnedToday,
                mode: state.mode
            });
        }
    } catch (_) {}

    if (state.uid) {
        setDoc(doc(db, 'users', state.uid, 'tulis_aku_daily', `${state.wibDayKey}_${state.mode}`), payload, { merge: true }).catch(() => {});
    }
}

async function fetchFreshQuestionsFromServer(excludeList = [], reserveOnly = false) {
    const res = await fetch('/api/central', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'generate-tulis-aku-questions',
            mode: state.mode,
            count: reserveOnly ? 4 : 12,
            reserveOnly,
            excludeFingerprints: excludeList.slice(-60),
            slotKey: state.slot12Key
        })
    });
    const data = await res.json();
    if (!data || !Array.isArray(data.questions)) {
        throw new Error('Gagal menyiapkan daftar tantangan baru.');
    }
    return data.questions;
}

async function ensureQuestionsForCurrentSlot(forceNewSlot = false) {
    const loadingBox = document.getElementById('taLoadingBox');
    const arenaBox = document.getElementById('taArenaBox');
    if (loadingBox) loadingBox.style.display = 'block';
    if (arenaBox) arenaBox.style.display = 'none';

    const seenSet = new Set(state.seenFingerprints.map((x) => String(x).toLowerCase()));
    let poolQuestions = [];

    // 1. Cek pool cache di slot 12.00 WIB saat ini (v2 critical-thinking format)
    try {
        const cachedRaw = localStorage.getItem(getPoolStorageKey());
        if (cachedRaw) {
            const parsed = JSON.parse(cachedRaw);
            if (Array.isArray(parsed.questions)) poolQuestions = parsed.questions;
        }
    } catch (_) {}

    if (poolQuestions.length === 0) {
        try {
            const poolSnap = await getDoc(doc(db, 'tulis_aku_daily_pool', `${state.slot12Key}_${state.mode}_v2`));
            if (poolSnap.exists() && Array.isArray(poolSnap.data().questions)) {
                poolQuestions = poolSnap.data().questions;
            }
        } catch (_) {}
    }

    // 2. Saring agar soal yang PERNAH ditampilkan / selesai di bank soal TIDAK tampil lagi!
    const unseenPool = poolQuestions.filter((q) => {
        const fp = String(q.fingerprint || q.id || '').toLowerCase();
        return fp && !seenSet.has(fp);
    });

    const missingStages = [];
    for (let s = 1; s <= 8; s++) {
        const existingLocal = !forceNewSlot ? state.stageQuestions.find((q) => Number(q.stage) === s) : null;
        if (existingLocal && (s <= state.stage || (existingLocal.examplePattern && !seenSet.has(String(existingLocal.fingerprint || '').toLowerCase())))) {
            continue;
        }
        const fromPool = unseenPool.find((q) => !q.isReserve && Number(q.stage) === s);
        if (!fromPool) missingStages.push(s);
    }

    // Jika pool slot ini belum ada atau ada soal yang sudah pernah dikerjakan (duplikat bank soal), ambil soal baru
    if (missingStages.length > 0 || poolQuestions.length === 0 || forceNewSlot) {
        try {
            const excludeAll = [
                ...state.seenFingerprints,
                ...poolQuestions.map((q) => q.fingerprint).filter(Boolean)
            ];
            const freshQuestions = await fetchFreshQuestionsFromServer(excludeAll, false);
            poolQuestions = freshQuestions;
            try {
                localStorage.setItem(getPoolStorageKey(), JSON.stringify({
                    slotKey: state.slot12Key,
                    mode: state.mode,
                    questions: freshQuestions,
                    savedAt: Date.now()
                }));
            } catch (_) {}
            setDoc(doc(db, 'tulis_aku_daily_pool', `${state.slot12Key}_${state.mode}_v2`), {
                slotKey: state.slot12Key,
                mode: state.mode,
                questions: freshQuestions,
                createdAt: new Date().toISOString()
            }, { merge: true }).catch(() => {});
        } catch (err) {
            console.warn('Pool fallback error:', err);
        }
    }

    // Susun tepat 8 soal tahap (1..8) + soal cadangan
    const nextMain = [];
    for (let s = 1; s <= 8; s++) {
        const keepDone = !forceNewSlot ? state.stageQuestions.find((q) => Number(q.stage) === s) : null;
        if (keepDone && s <= state.stage) {
            nextMain.push(keepDone);
            continue;
        }
        const candUnseen = poolQuestions.find((q) => !q.isReserve && Number(q.stage) === s && !seenSet.has(String(q.fingerprint || '').toLowerCase()));
        const candFallback = poolQuestions.find((q) => Number(q.stage) === s) || poolQuestions[s - 1];
        if (candUnseen) nextMain.push({ ...candUnseen, stage: s });
        else if (candFallback) nextMain.push({ ...candFallback, stage: s });
    }

    const reserves = poolQuestions.filter((q) => q.isReserve && !seenSet.has(String(q.fingerprint || '').toLowerCase()));
    state.stageQuestions = nextMain;
    if (reserves.length > 0) {
        state.reserveQuestions = reserves;
    }

    saveDailyProgress();

    if (loadingBox) loadingBox.style.display = 'none';
    if (arenaBox) arenaBox.style.display = 'block';
    renderFullArena();
}

function getCurrentTargetChallenge() {
    if (state.playReserveMode) {
        if (state.activeReserveIdx < 0) state.activeReserveIdx = 0;
        return state.reserveQuestions[state.activeReserveIdx] || null;
    }
    const nextStage = Math.min(8, Math.max(1, state.stage + 1));
    return state.stageQuestions.find((q) => Number(q.stage) === nextStage) || state.stageQuestions[nextStage - 1] || null;
}

function updateBearView(moodOverride = null, captionOverride = null) {
    const stageCard = document.getElementById('taStageCard');
    const viewport = document.getElementById('taBearViewport');
    const badgeEl = document.getElementById('taStageBadge');
    const captionEl = document.getElementById('taCaptionBubble');
    const stepsEl = document.getElementById('taStepsTrack');

    const STAGE_META = window.TulisAkuBear?.STAGE_META || [];
    const currentMeta = STAGE_META[state.stage] || STAGE_META[0] || { title: 'Tertidur', sub: '' };

    const isSleepingMood = moodOverride === 'sleeping' || moodOverride === 'sad_sleep' || (state.sleepLock && !moodOverride && state.stage === 0);
    const visualMood = moodOverride || (state.sleepLock && state.stage === 0 ? 'sleeping' : (state.completedToday ? 'celebrating' : 'idle'));

    if (stageCard) {
        stageCard.classList.toggle('is-sleeping', isSleepingMood || moodOverride === 'sad_sleep');
        stageCard.classList.toggle('is-celebrating', visualMood === 'celebrating');
    }

    if (badgeEl) {
        badgeEl.textContent = state.stage === 0
            ? '💤 Sedang Tertidur (0/8)'
            : `${currentMeta.icon || '🐻'} Tahap ${state.stage}/8 • ${currentMeta.title}`;
    }

    if (captionEl) {
        let cap = captionOverride;
        if (!cap) {
            if (state.completedToday) {
                cap = `Hore! Si Beruang sudah tumbuh penuh hingga Tahap 8 (Tua Bijaksana) hari ini! Kamu masih bisa bermain di Soal Cadangan.`;
            } else if (state.stage === 0 || state.sleepLock) {
                cap = `Beruang masih tidur nih! Ayo bantu dia bangun & bertumbuh ke Tahap ${Math.min(8, state.stage + 1)} dengan menyelesaikan tantangan di bawah.`;
            } else {
                cap = `Asyik! Si Beruang kini di Tahap ${state.stage} (${currentMeta.title} — ${currentMeta.sub}). Selesaikan tantangan berikutnya agar makin besar!`;
            }
        }
        captionEl.textContent = cap;
    }

    if (viewport && window.TulisAkuBear) {
        window.TulisAkuBear.renderBearStage(viewport, {
            stage: state.stage,
            mood: visualMood
        });
    }

    if (stepsEl) {
        const shortLabels = ['Bayi', 'Balita', 'Anak', 'R.Awal', 'Remaja', 'D.Muda', 'Dewasa', 'Tua'];
        stepsEl.innerHTML = shortLabels.map((lbl, idx) => {
            const stNum = idx + 1;
            const cls = stNum <= state.stage ? 'done' : (stNum === state.stage + 1 && !state.completedToday ? 'current' : '');
            return `
                <div class="ta-step-dot">
                    <div class="ta-step-num ${cls}">${stNum <= state.stage ? '✓' : stNum}</div>
                    <div class="ta-step-lbl">${lbl}</div>
                </div>
            `;
        }).join('');
    }
}

function scrubSecretsClient(text, secrets = []) {
    let out = String(text || '');
    (secrets || []).forEach((kw, idx) => {
        const clean = String(kw || '').trim();
        if (clean.length < 3) return;
        const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`["']?\\b${escaped}\\b["']?`, 'gi');
        out = out.replace(re, `[Kata ${idx + 1}]`);
    });
    return out;
}

function renderChallengeArea() {
    const area = document.getElementById('taChallengeArea');
    const winBox = document.getElementById('taVictoryPanel');
    if (!area || !winBox) return;

    if (state.completedToday && !state.playReserveMode) {
        area.style.display = 'none';
        winBox.style.display = 'block';
        renderVictoryPanel();
        return;
    }

    winBox.style.display = 'none';
    area.style.display = 'block';

    const ch = getCurrentTargetChallenge();
    if (!ch) {
        area.innerHTML = `
            <div class="ta-challenge-card" style="text-align:center;">
                <p style="font-size:0.78rem; color:#475569; margin-bottom:10px;">Soal cadangan di sesi ini sudah habis terjawab! Tekan tombol di bawah untuk mengambil tantangan baru.</p>
                <button type="button" id="taBtnLoadMoreReserve" class="ta-btn-submit">Muat Soal Cadangan Baru</button>
            </div>
        `;
        const btnMore = document.getElementById('taBtnLoadMoreReserve');
        if (btnMore) btnMore.addEventListener('click', loadExtraReserveBatch);
        return;
    }

    const reqWords = Array.isArray(ch.requiredWords) ? ch.requiredWords.filter(Boolean) : [];
    const forbidden = Array.isArray(ch.forbiddenWords) ? ch.forbiddenWords : [];
    const targetStageLabel = state.playReserveMode
        ? `Soal Cadangan #${state.activeReserveIdx + 1}`
        : `Tantangan Bangunkan Tahap ${Math.min(8, state.stage + 1)} / 8`;

    const modeInfoText = state.mode === 'tantangan'
        ? 'Mode Tantangan (Ketat & Logis)'
        : (state.mode === 'acak' ? 'Mode Acak (Bentuk Dinamis)' : 'Mode Santai (Terarah & Mengalir)');

    const solvedInfo = state.solvedStep1Map[ch.id] || null;
    const step1Unlocked = reqWords.length === 0 || Boolean(solvedInfo);
    const attempts = Number(state.guessAttemptsMap[ch.id] || 0);

    const themeText = ch.themeSummary || ch.requiredTheme || ch.title || 'Kreativitas Bahasa';
    const patternText = ch.examplePattern || scrubSecretsClient(ch.prompt, reqWords);
    const writePromptText = scrubSecretsClient(ch.prompt, reqWords);

    const forbiddenChips = forbidden.map((fw) =>
        `<span class="ta-req-chip" style="background:#fee2e2;color:#b91c1c;border-color:#fecaca;">⛔ Dilarang: "${escapeHtml(fw)}"</span>`
    ).join('');

    const step1Html = step1Unlocked
        ? `
            <div class="ta-step-solved">
                <div style="font-size:0.72rem; font-weight:800; color:#15803d; margin-bottom:3px;">
                    ✅ Langkah 1 Terpecahkan! Kata Kunci: ${(solvedInfo?.words || reqWords).map((w) => `<span class="ta-kw-badge">${escapeHtml(w)}</span>`).join(' ')}
                </div>
                ${solvedInfo?.note ? `<div style="font-size:0.68rem; color:#166534; line-height:1.4;">${escapeHtml(solvedInfo.note)}</div>` : ''}
            </div>
        `
        : `
            <div class="ta-step1-box" id="taStep1Box">
                <div style="font-size:0.73rem; font-weight:800; color:#92400e; margin-bottom:4px;">
                    🔍 Langkah 1 (Asah Logika): Tebak ${reqWords.length} Kata Kunci Rahasia
                </div>
                <p style="font-size:0.68rem; color:#78350f; line-height:1.45; margin-bottom:8px;">
                    Cermati <b>Tema</b> dan <b>Pola Contoh Soal</b> di atas, lalu temukan kata kunci untuk mengisi bagian <b>[Kata 1]</b>${reqWords.length > 1 ? ' dan <b>[Kata 2]</b>' : ''} sebelum mulai menulis!
                </p>
                <div class="ta-guess-grid">
                    ${reqWords.map((_, idx) => `
                        <input type="text" id="taGuessInput_${idx}" class="ta-guess-input" placeholder="Tebak Kata ${idx + 1}..." autocomplete="off">
                    `).join('')}
                </div>
                <div id="taGuessFeedbackSlot"></div>
                <button type="button" id="taBtnCheckGuess" class="ta-btn-guess">
                    🧩 Cek Tebakan ke Si Beruang
                </button>
                ${attempts >= 2 ? `
                    <button type="button" id="taBtnLogicHint" class="ta-btn-hint">
                        💡 Minta Petunjuk Logika Tambahan
                    </button>
                ` : ''}
            </div>
        `;

    area.innerHTML = `
        <div class="ta-challenge-card">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:6px; margin-bottom:5px;">
                <span style="font-size:0.66rem; font-weight:800; color:#003366; text-transform:uppercase;">
                    ${escapeHtml(targetStageLabel)}
                </span>
                <span class="ta-pill is-gold">+${Number(ch.xpReward || 20)} XP</span>
            </div>

            <div style="font-size:0.9rem; font-weight:800; color:#0f172a; margin-bottom:7px;">
                ${escapeHtml(ch.title || 'Tantangan Menulis')}
                <span style="font-size:0.65rem; font-weight:700; color:#2563eb; background:#eff6ff; padding:2px 7px; border-radius:999px; margin-left:4px;">
                    ${escapeHtml(ch.formatLabel || 'Menulis Kreatif')}
                </span>
            </div>

            <div class="ta-theme-box">
                <span style="font-weight:800; color:#1e3a8a;">📌 Tema:</span> ${escapeHtml(themeText)}
            </div>

            <div class="ta-prompt-box">${escapeHtml(patternText)}</div>

            ${forbiddenChips ? `<div class="ta-req-chips">${forbiddenChips}</div>` : ''}

            ${step1Html}

            <div class="ta-step2-box ${step1Unlocked ? '' : 'is-locked'}" id="taStep2Box">
                <div style="font-size:0.73rem; font-weight:800; color:#001f3f; margin-bottom:4px;">
                    ✍️ Langkah 2: Tulis Karyamu Secara Logis
                </div>
                <div style="font-size:0.69rem; color:#334155; line-height:1.45; margin-bottom:6px;">
                    ${escapeHtml(writePromptText)}
                </div>
                <div style="font-size:0.63rem; color:#64748b; margin-bottom:7px;">
                    <b>Ketentuan:</b> ${escapeHtml(modeInfoText)} &bull; Min. ${ch.minWords || 10} kata${ch.minLines > 1 ? ` &bull; Min. ${ch.minLines} baris` : ''}.
                </div>

                <textarea id="taAnswerInput" class="ta-textarea" ${step1Unlocked ? '' : 'disabled'} placeholder="${step1Unlocked ? 'Rangkai tulisanmu dengan alur sebab-akibat yang logis menggunakan kata kunci hasil tebakanmu...' : '🔒 Tebak kata kunci di Langkah 1 terlebih dahulu untuk membuka kotak menulis...'}"></textarea>

                <div class="ta-editor-meta">
                    <span><b id="taLiveWordCount">0</b> kata &bull; <b id="taLiveLineCount">0</b> baris</span>
                    <span>🐻 Kirim ke Si Beruang untuk dibaca</span>
                </div>

                <div id="taEvalFeedbackSlot"></div>

                <button type="button" id="taBtnSubmitAnswer" class="ta-btn-submit" ${step1Unlocked ? '' : 'disabled'}>
                    🐻 Kirim ke Si Beruang
                </button>
            </div>
        </div>
    `;

    // Bind Step 1 Events
    const btnCheckGuess = document.getElementById('taBtnCheckGuess');
    if (btnCheckGuess) btnCheckGuess.addEventListener('click', checkKeywordGuess);
    reqWords.forEach((_, idx) => {
        const gInp = document.getElementById(`taGuessInput_${idx}`);
        if (gInp) {
            gInp.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    checkKeywordGuess();
                }
            });
        }
    });

    const btnHint = document.getElementById('taBtnLogicHint');
    if (btnHint) {
        btnHint.addEventListener('click', () => {
            const gSlot = document.getElementById('taGuessFeedbackSlot');
            if (gSlot) {
                gSlot.innerHTML = `<div class="ta-eval-box" style="background:#fffbeb; border-color:#fcd34d; color:#78350f; margin-bottom:7px;"><b>💡 Petunjuk Si Beruang:</b> ${escapeHtml(ch.logicHints || 'Pikirkan hubungan benda/peristiwa yang paling masuk akal pada tema tersebut.')}</div>`;
            }
        });
    }

    // Bind Step 2 Events
    const textarea = document.getElementById('taAnswerInput');
    if (textarea) {
        textarea.addEventListener('input', () => {
            const val = textarea.value.trim();
            const wCount = val ? val.split(/\s+/).filter(Boolean).length : 0;
            const lCount = val ? val.split(/\r?\n+/).map((l) => l.trim()).filter(Boolean).length : 0;
            document.getElementById('taLiveWordCount').textContent = wCount;
            document.getElementById('taLiveLineCount').textContent = lCount;
        });
    }

    const submitBtn = document.getElementById('taBtnSubmitAnswer');
    if (submitBtn) submitBtn.addEventListener('click', submitChallengeAnswer);
}

async function checkKeywordGuess() {
    const ch = getCurrentTargetChallenge();
    if (!ch || state.isEvaluating) return;
    const reqWords = Array.isArray(ch.requiredWords) ? ch.requiredWords.filter(Boolean) : [];
    const guessedWords = reqWords.map((_, idx) => (document.getElementById(`taGuessInput_${idx}`)?.value || '').trim());

    if (guessedWords.some((g) => !g)) {
        const gSlot = document.getElementById('taGuessFeedbackSlot');
        if (gSlot) {
            gSlot.innerHTML = `<div class="ta-eval-box is-fail" style="margin-bottom:7px;">Isi semua kotak kata kunci berdasarkan petunjuk tema &amp; pola dulu ya!</div>`;
        }
        return;
    }

    const btnGuess = document.getElementById('taBtnCheckGuess');
    state.isEvaluating = true;
    if (btnGuess) {
        btnGuess.disabled = true;
        btnGuess.textContent = '🐻 Si Beruang Memeriksa Tebakanmu...';
    }

    try {
        const resp = await fetch('/api/central', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'evaluate-tulis-aku-answer',
                phase: 'guess-keywords',
                mode: state.mode,
                stage: ch.stage || state.stage + 1,
                challenge: ch,
                guessedWords
            })
        });
        const res = await resp.json();

        if (res.guessPassed) {
            state.solvedStep1Map[ch.id] = {
                words: Array.isArray(res.acceptedWords) && res.acceptedWords.length ? res.acceptedWords : guessedWords,
                note: res.feedback || ''
            };
            saveDailyProgress();
            renderChallengeArea();
            const taEl = document.getElementById('taAnswerInput');
            if (taEl) taEl.focus();
            updateBearView(state.stage === 0 ? 'sleeping' : 'idle', 'Kata kunci terpecahkan! Sekarang susun tulisanmu secara logis ya!');
        } else {
            state.guessAttemptsMap[ch.id] = Number(state.guessAttemptsMap[ch.id] || 0) + 1;
            saveDailyProgress();
            const gSlot = document.getElementById('taGuessFeedbackSlot');
            if (gSlot) {
                gSlot.innerHTML = `<div class="ta-eval-box is-fail" style="margin-bottom:7px;">🤔 <b>Belum Pas:</b> ${escapeHtml(res.feedback || 'Coba telusuri ulang logika pola contohnya.')}</div>`;
            }
            if (state.guessAttemptsMap[ch.id] >= 2 && !document.getElementById('taBtnLogicHint')) {
                // Tampilkan tombol petunjuk tambahan setelah 2x salah menebak
                renderChallengeArea();
                reqWords.forEach((_, idx) => {
                    const el = document.getElementById(`taGuessInput_${idx}`);
                    if (el) el.value = guessedWords[idx] || '';
                });
                const gSlotAfter = document.getElementById('taGuessFeedbackSlot');
                if (gSlotAfter) {
                    gSlotAfter.innerHTML = `<div class="ta-eval-box is-fail" style="margin-bottom:7px;">🤔 <b>Belum Pas:</b> ${escapeHtml(res.feedback || 'Coba telusuri ulang logika pola contohnya.')}</div>`;
                }
            }
        }
    } catch (err) {
        const gSlot = document.getElementById('taGuessFeedbackSlot');
        if (gSlot) {
            gSlot.innerHTML = `<div class="ta-eval-box is-fail" style="margin-bottom:7px;">Koneksi terganggu, coba kirim ulang tebakanmu ya!</div>`;
        }
    } finally {
        state.isEvaluating = false;
        const b = document.getElementById('taBtnCheckGuess');
        if (b) {
            b.disabled = false;
            b.textContent = '🧩 Cek Tebakan ke Si Beruang';
        }
    }
}

function renderVictoryPanel() {
    const winBox = document.getElementById('taVictoryPanel');
    if (!winBox) return;

    const m = Math.floor(state.elapsedSeconds / 60);
    const s = state.elapsedSeconds % 60;
    const durationText = state.elapsedSeconds > 0 ? `${m} mnt ${s} dtk` : 'Selesai hari ini';

    winBox.innerHTML = `
        <div class="ta-challenge-card" style="text-align:center; border-color:#86efac; background:linear-gradient(180deg,#f0fdf4 0%,#ffffff 100%);">
            <div style="font-size:1.5rem; margin-bottom:4px;">🎉🐻🏆</div>
            <h3 style="font-size:0.98rem; font-weight:800; color:#15803d; margin-bottom:4px;">
                Si Beruang Sudah Bangun &amp; Tumbuh Penuh (Tahap 8)!
            </h3>
            <p style="font-size:0.72rem; color:#334155; line-height:1.45; margin-bottom:10px;">
                Luar biasa! Kamu membantu Si Beruang dari bayi tertidur hingga menjadi Beruang Tua Bijaksana dalam waktu <b>${durationText}</b>.
            </p>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:11px;">
                <div style="background:white; border:1px solid #bbf7d0; border-radius:10px; padding:8px;">
                    <div style="font-size:0.6rem; color:#64748b; font-weight:700;">BONUS KECEPATAN</div>
                    <div style="font-size:0.95rem; font-weight:800; color:#d97706;">+${state.bonusAwarded} XP</div>
                </div>
                <div style="background:white; border:1px solid #bbf7d0; border-radius:10px; padding:8px;">
                    <div style="font-size:0.6rem; color:#64748b; font-weight:700;">TOTAL XP MODE INI</div>
                    <div style="font-size:0.95rem; font-weight:800; color:#15803d;">+${state.xpEarnedToday} XP</div>
                </div>
            </div>
            <button type="button" id="taBtnPlayReserve" class="ta-btn-submit" style="background:linear-gradient(135deg,#d97706,#b45309);">
                Mainkan Soal Cadangan (${Math.max(0, state.reserveQuestions.length - Math.max(0, state.activeReserveIdx))} tersedia)
            </button>
            <div style="font-size:0.64rem; color:#64748b; margin-top:8px;">
                Beruang akan tidur lagi otomatis jam <b>00:00 WIB</b> &amp; pengingat pagi tiba jam <b>06:00 WIB</b>.
            </div>
        </div>
    `;

    const btnRes = document.getElementById('taBtnPlayReserve');
    if (btnRes) {
        btnRes.addEventListener('click', () => {
            state.playReserveMode = true;
            if (state.activeReserveIdx < 0) state.activeReserveIdx = 0;
            if (state.activeReserveIdx >= state.reserveQuestions.length) {
                loadExtraReserveBatch();
            } else {
                saveDailyProgress();
                renderChallengeArea();
            }
        });
    }
}

async function loadExtraReserveBatch() {
    const area = document.getElementById('taChallengeArea');
    if (area) {
        area.innerHTML = `<div class="ta-challenge-card" style="text-align:center; padding:24px;">Mengambil soal cadangan baru yang belum pernah tampil...</div>`;
    }
    try {
        const excludeAll = [...state.seenFingerprints, ...state.reserveQuestions.map((q) => q.fingerprint)];
        const fresh = await fetchFreshQuestionsFromServer(excludeAll, true);
        state.reserveQuestions = fresh;
        state.activeReserveIdx = 0;
        saveDailyProgress();
        renderChallengeArea();
    } catch (err) {
        if (area) {
            area.innerHTML = `<div class="ta-challenge-card" style="text-align:center; color:#b91c1c;">Gagal mengambil soal cadangan: ${escapeHtml(err.message)}</div>`;
        }
    }
}

function renderEvalFeedback(res, passed, failedStageMsg = '') {
    const slot = document.getElementById('taEvalFeedbackSlot');
    if (!slot) return;

    const c = res.criteria || {};
    const rows = [
        { label: 'Kesesuaian Tema & Kata Kunci', obj: c.unsurWajib },
        { label: 'Bentuk & Ketentuan', obj: c.kesesuaianBentuk },
        { label: 'Alur Logika & Kekuatan Cerita', obj: c.kedalamanKreatif }
    ];

    slot.innerHTML = `
        <div class="ta-eval-box ${passed ? 'is-pass' : 'is-fail'}">
            <div style="display:flex; justify-content:space-between; align-items:center; font-weight:800; margin-bottom:4px; color:${passed ? '#15803d' : '#b91c1c'};">
                <span>${passed ? '✅ Si Beruang Bangun & Bertumbuh!' : '💤 Belum Tepat — Beruang Tidur Lagi!'}</span>
                <span>Skor ${res.score || 0}/100</span>
            </div>
            <div style="font-size:0.71rem; color:#1e293b; font-weight:600;">${escapeHtml(res.feedback || '')}</div>
            ${failedStageMsg ? `<div style="font-size:0.68rem; color:#991b1b; font-weight:700; margin-top:3px;">${escapeHtml(failedStageMsg)}</div>` : ''}
            <div class="ta-crit-list">
                ${rows.map((r) => {
                    const ok = r.obj ? r.obj.ok !== false : passed;
                    return `<div class="ta-crit-row"><span>${ok ? '✔️' : '❌'}</span><div><b>${r.label}:</b> ${escapeHtml(r.obj?.note || '-')}</div></div>`;
                }).join('')}
            </div>
        </div>
    `;
}

function awardUserXp(amount, reason) {
    if (!amount || amount <= 0) return;
    if (window.CendekiaApp?.addXP) {
        window.CendekiaApp.addXP(amount, reason);
    } else if (state.uid) {
        setDoc(doc(db, 'users', state.uid), {
            xp: increment(amount),
            points: increment(amount)
        }, { merge: true }).catch(() => {});
    }
    const xpBadge = document.getElementById('taXpBadge');
    if (xpBadge) xpBadge.textContent = `+${state.xpEarnedToday} XP`;
}

function calculateSpeedBonus(elapsedSeconds, mode) {
    const mult = mode === 'tantangan' ? 1.5 : (mode === 'acak' ? 1.25 : 1.0);
    let base = 10;
    if (elapsedSeconds <= 180) base = 50;
    else if (elapsedSeconds <= 360) base = 38;
    else if (elapsedSeconds <= 600) base = 26;
    else if (elapsedSeconds <= 900) base = 16;
    return Math.round(base * mult);
}

async function submitChallengeAnswer() {
    if (state.isEvaluating) return;
    const ch = getCurrentTargetChallenge();
    const inputEl = document.getElementById('taAnswerInput');
    const btnEl = document.getElementById('taBtnSubmitAnswer');
    if (!ch || !inputEl) return;

    const reqWords = Array.isArray(ch.requiredWords) ? ch.requiredWords.filter(Boolean) : [];
    const solvedInfo = state.solvedStep1Map[ch.id];
    if (reqWords.length > 0 && !solvedInfo) {
        alert('Pecahkan dulu kata kunci rahasia pada Langkah 1 ya!');
        return;
    }

    const userAnswer = inputEl.value.trim();
    if (!userAnswer) {
        alert('Tuliskan karyamu terlebih dahulu sebelum membangunkan Si Beruang!');
        return;
    }

    if (!state.startedAtMs) state.startedAtMs = Date.now();
    state.isEvaluating = true;
    if (btnEl) {
        btnEl.disabled = true;
        btnEl.textContent = '🐻 Si Beruang Sedang Membaca Tulisanmu...';
    }

    updateBearView('thinking', 'Hmm... Si Beruang sedang membaca alur logika tulisanmu dengan teliti...');

    try {
        const resp = await fetch('/api/central', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'evaluate-tulis-aku-answer',
                phase: 'evaluate-writing',
                mode: state.mode,
                stage: ch.stage || state.stage + 1,
                challenge: ch,
                acceptedWords: solvedInfo?.words || reqWords,
                userAnswer
            })
        });
        const evalRes = await resp.json();

        if (!evalRes.passed) {
            state.sleepLock = true;
            let dropMsg = '';
            if (state.mode === 'tantangan' && state.stage > 0 && !state.playReserveMode) {
                state.stage = Math.max(0, state.stage - 1);
                dropMsg = `Karena ini Mode Tantangan, Si Beruang turun kembali ke Tahap ${state.stage} dan tertidur!`;
            }
            saveDailyProgress();
            updateBearView('sad_sleep', evalRes.bearReaction || 'Yah... alur logika atau unsurnya belum terasa pas, Si Beruang tidur lagi!');
            renderEvalFeedback(evalRes, false, dropMsg);
            if (btnEl) {
                state.isEvaluating = false;
                btnEl.disabled = false;
                btnEl.style.cssText = '';
                btnEl.innerHTML = '✍️ Perbaiki & Kirim ke Si Beruang';
                btnEl.onclick = () => { btnEl.onclick = null; submitChallengeAnswer(); };
            }
            return;
        }

        // LULUS! Kunci textarea agar jawaban + catatan terbaca tenang
        inputEl.disabled = true;

        saveSeenQuestionToBank(ch, evalRes);
        const earned = Number(ch.xpReward || 20);
        state.xpEarnedToday += earned;
        awardUserXp(earned, `Tulis Aku (${state.mode.toUpperCase()}) Tahap ${ch.stage}`);

        state.sleepLock = false;

        if (state.playReserveMode) {
            state.activeReserveIdx++;
            saveDailyProgress();
            updateBearView('celebrating', evalRes.bearReaction || 'Keren! Soal cadangan selesai dengan cemerlang!');
            renderEvalFeedback(evalRes, true);
            if (btnEl) {
                btnEl.disabled = false;
                btnEl.style.cssText = 'background:linear-gradient(135deg,#16a34a 0%,#15803d 100%);color:white;';
                btnEl.innerHTML = '✅ Lanjut ke Soal Berikutnya →';
                btnEl.onclick = () => {
                    btnEl.onclick = null;
                    btnEl.style.cssText = '';
                    renderChallengeArea();
                    updateBearView();
                    document.getElementById('taStageCard')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                };
            }
            return;
        }

        // Naik tahap pertumbuhan 1..8
        state.stage = Math.min(8, state.stage + 1);

        if (state.stage >= 8 && !state.completedToday) {
            state.completedToday = true;
            state.elapsedSeconds = state.startedAtMs ? Math.max(10, Math.floor((Date.now() - state.startedAtMs) / 1000)) : 300;
            const bonus = calculateSpeedBonus(state.elapsedSeconds, state.mode);
            state.bonusAwarded = bonus;
            state.xpEarnedToday += bonus;
            awardUserXp(bonus, `Bonus Kecepatan Bangunkan Beruang (${state.mode})`);

            if (window.CendekiaApp?.saveGameResult) {
                await window.CendekiaApp.saveGameResult('tulis_aku', {
                    score: evalRes.score || 100,
                    correctCount: 8,
                    totalCount: 8,
                    xpEarned: state.xpEarnedToday,
                    bonusKecepatan: bonus,
                    elapsedSeconds: state.elapsedSeconds,
                    mode: state.mode,
                    questions: state.completedLogs.slice(0, 8).map((l) => ({
                        q: l.title,
                        isCorrect: true,
                        selectedText: l.prompt,
                        correctText: `Skor ${l.score}/100`,
                        exp: 'Beruang bertumbuh hingga Tahap 8'
                    }))
                }, state.mode);
            }
        }

        saveDailyProgress();
        updateBearView('celebrating', evalRes.bearReaction || `Yeay! Si Beruang naik ke Tahap ${state.stage}!`);
        renderEvalFeedback(evalRes, true);

        // Tombol HIJAU — penjelasan berada DI ATAS tombol (kosong di bawah tombol); baru lanjut saat diklik
        if (btnEl) {
            btnEl.disabled = false;
            btnEl.style.cssText = 'background:linear-gradient(135deg,#16a34a 0%,#15803d 100%);color:white;';
            btnEl.innerHTML = state.completedToday ? '🎉 Lihat Hasil Akhir' : '✅ Lanjut ke Soal Berikutnya →';
            btnEl.onclick = () => {
                btnEl.onclick = null;
                btnEl.style.cssText = '';
                renderChallengeArea();
                updateBearView();
                document.getElementById('taStageCard')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            };
        }
    } catch (err) {
        console.error('Error evaluasi Tulis Aku:', err);
        updateBearView(state.stage === 0 ? 'sleeping' : 'idle', 'Koneksi sedikit terganggu, coba kirim lagi tulisanmu!');
        const slot = document.getElementById('taEvalFeedbackSlot');
        if (slot) {
            slot.innerHTML = `<div class="ta-eval-box is-fail">Gagal mengirim ke Si Beruang — coba lagi sebentar ya!</div>`;
        }
        state.isEvaluating = false;
        if (btnEl) {
            btnEl.disabled = false;
            btnEl.style.cssText = '';
            btnEl.innerHTML = '🐻 Kirim ke Si Beruang';
            btnEl.onclick = submitChallengeAnswer;
        }
    } finally {
        state.isEvaluating = false;
    }
}

function renderHeaderModePill() {
    const modePill = document.getElementById('taActiveModePill');
    if (!modePill) return;

    const modeMap = {
        santai: { icon: 'coffee', label: 'Santai', bg: '#ede9fe', color: '#6d28d9', border: '#ddd6fe' },
        tantangan: { icon: 'zap', label: 'Tantangan', bg: '#fef3c7', color: '#b45309', border: '#fde68a' },
        acak: { icon: 'shuffle', label: 'Acak', bg: '#e0e7ff', color: '#4338ca', border: '#c7d2fe' }
    };
    const m = modeMap[state.mode] || modeMap.santai;
    modePill.style.background = m.bg;
    modePill.style.color = m.color;
    modePill.style.borderColor = m.border;
    modePill.innerHTML = `<i data-lucide="${m.icon}" style="width:11px; height:11px; flex-shrink:0;"></i> ${m.label}`;
    if (window.lucide) window.lucide.createIcons();
}

function renderFullArena() {
    const xpBadge = document.getElementById('taXpBadge');
    if (xpBadge) xpBadge.textContent = `+${state.xpEarnedToday} XP`;

    renderHeaderModePill();
    updateBearView();
    renderChallengeArea();
}

async function loadGameSession() {
    state.wibDayKey = getWibDayKey();
    state.slot12Key = get12WibSlotKey();
    state.playReserveMode = false;

    state.seenFingerprints = loadLocalSeenBank();
    if (state.uid) {
        try {
            const bankSnap = await getDoc(doc(db, 'users', state.uid, 'tulis_aku_meta', 'bank'));
            if (bankSnap.exists()) {
                const cloudSeen = bankSnap.data().seenFingerprints || [];
                state.seenFingerprints = Array.from(new Set([...state.seenFingerprints, ...cloudSeen]));
            }
        } catch (_) {}
    }

    let saved = null;
    try {
        saved = JSON.parse(localStorage.getItem(getProgressStorageKey()) || 'null');
    } catch (_) {}

    if (!saved && state.uid) {
        try {
            const dailySnap = await getDoc(doc(db, 'users', state.uid, 'tulis_aku_daily', `${state.wibDayKey}_${state.mode}`));
            if (dailySnap.exists()) saved = dailySnap.data();
        } catch (_) {}
    }

    if (saved && saved.wibDayKey === state.wibDayKey && saved.mode === state.mode) {
        state.stage = Number(saved.stage) || 0;
        state.sleepLock = saved.sleepLock !== undefined ? Boolean(saved.sleepLock) : (state.stage === 0);
        state.completedToday = Boolean(saved.completedToday);
        state.startedAtMs = Number(saved.startedAtMs) || Date.now();
        state.elapsedSeconds = Number(saved.elapsedSeconds) || 0;
        state.bonusAwarded = Number(saved.bonusAwarded) || 0;
        state.xpEarnedToday = Number(saved.xpEarnedToday) || 0;
        state.stageQuestions = Array.isArray(saved.stageQuestions) ? saved.stageQuestions : [];
        state.reserveQuestions = Array.isArray(saved.reserveQuestions) ? saved.reserveQuestions : [];
        state.activeReserveIdx = saved.activeReserveIdx ?? -1;
        state.completedLogs = Array.isArray(saved.completedLogs) ? saved.completedLogs : [];
        state.solvedStep1Map = (saved.solvedStep1Map && typeof saved.solvedStep1Map === 'object') ? saved.solvedStep1Map : {};
        state.guessAttemptsMap = (saved.guessAttemptsMap && typeof saved.guessAttemptsMap === 'object') ? saved.guessAttemptsMap : {};
    } else {
        state.stage = 0;
        state.sleepLock = true;
        state.completedToday = false;
        state.startedAtMs = Date.now();
        state.elapsedSeconds = 0;
        state.bonusAwarded = 0;
        state.xpEarnedToday = 0;
        state.stageQuestions = [];
        state.reserveQuestions = [];
        state.activeReserveIdx = -1;
        state.completedLogs = [];
        state.solvedStep1Map = {};
        state.guessAttemptsMap = {};
    }

    const slotChanged = saved && saved.slot12Key && saved.slot12Key !== state.slot12Key;
    await ensureQuestionsForCurrentSlot(Boolean(slotChanged));
}

function initUiControls() {
    const btnBack = document.getElementById('taBackLink');
    if (btnBack && cfg.backUrl) btnBack.href = cfg.backUrl;
    renderHeaderModePill();
}

document.addEventListener('DOMContentLoaded', () => {
    if (window.CendekiaApp?.renderBottomNav) {
        window.CendekiaApp.renderBottomNav('bermain');
    }

    if (cfg.locked) {
        const vp = document.getElementById('taLockBearPreview');
        if (vp && window.TulisAkuBear) {
            window.TulisAkuBear.renderBearStage(vp, { stage: 0, mood: 'sleeping' });
        }
        return;
    }

    const params = new URLSearchParams(window.location.search);
    const paramMode = params.get('mode') || localStorage.getItem('cendekia_active_game_mode') || 'santai';
    state.mode = ['santai', 'tantangan', 'acak'].includes(paramMode) ? paramMode : 'santai';

    initUiControls();
    startCountdowns();

    let started = false;
    onAuthStateChanged(auth, (fbUser) => {
        state.uid = fbUser?.uid || getStorageUserId();
        state.user = fbUser || null;
        if (!started) {
            started = true;
            loadGameSession();
        }
    });

    setTimeout(() => {
        if (!started) {
            started = true;
            state.uid = getStorageUserId();
            loadGameSession();
        }
    }, 1200);
});
