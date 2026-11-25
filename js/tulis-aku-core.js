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
        const wib = new Date(now + WIB_OFFSET_MS);

        // Next 12:00 WIB
        const next12WibAsUtc = Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate(), 12, 0, 0) - WIB_OFFSET_MS;
        const target12 = now < next12WibAsUtc ? next12WibAsUtc : next12WibAsUtc + 86400000;
        const el12 = document.getElementById('taCountdown12Wib');
        if (el12) el12.textContent = formatCountdownMs(target12 - now);

        // Next 00:00 WIB (beruang kembali tidur)
        const next00WibAsUtc = Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate() + 1, 0, 0, 0) - WIB_OFFSET_MS;
        const el00 = document.getElementById('taCountdown00Wib');
        if (el00) el00.textContent = formatCountdownMs(next00WibAsUtc - now);

        // If midnight crossed while playing, reset bear gracefully!
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

        // Update elapsed play timer if actively waking bear
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
    return `tulis_aku_pool_${slot}_${mode}`;
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

async function fetchFreshQuestionsFromAI(excludeList = [], reserveOnly = false) {
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
        throw new Error('Gagal menerima daftar soal dari AI.');
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

    // 1. Cek pool cache di slot 12.00 WIB saat ini (Firestore bersama / localStorage)
    try {
        const cachedRaw = localStorage.getItem(getPoolStorageKey());
        if (cachedRaw) {
            const parsed = JSON.parse(cachedRaw);
            if (Array.isArray(parsed.questions)) poolQuestions = parsed.questions;
        }
    } catch (_) {}

    if (poolQuestions.length === 0) {
        try {
            const poolSnap = await getDoc(doc(db, 'tulis_aku_daily_pool', `${state.slot12Key}_${state.mode}`));
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
        // Pertahankan soal stage yang belum selesai hari ini kalau tidak ganti slot 12 WIB
        const existingLocal = !forceNewSlot ? state.stageQuestions.find((q) => Number(q.stage) === s) : null;
        if (existingLocal && (s <= state.stage || !seenSet.has(String(existingLocal.fingerprint || '').toLowerCase()))) {
            continue;
        }
        const fromPool = unseenPool.find((q) => !q.isReserve && Number(q.stage) === s);
        if (!fromPool) missingStages.push(s);
    }

    // Jika pool slot ini belum ada atau ada soal yang sudah pernah dikerjakan (duplikat bank soal), minta soal baru ke AI
    if (missingStages.length > 0 || poolQuestions.length === 0 || forceNewSlot) {
        try {
            const excludeAll = [
                ...state.seenFingerprints,
                ...poolQuestions.map((q) => q.fingerprint).filter(Boolean)
            ];
            const aiQuestions = await fetchFreshQuestionsFromAI(excludeAll, false);
            poolQuestions = aiQuestions;
            try {
                localStorage.setItem(getPoolStorageKey(), JSON.stringify({
                    slotKey: state.slot12Key,
                    mode: state.mode,
                    questions: aiQuestions,
                    savedAt: Date.now()
                }));
            } catch (_) {}
            setDoc(doc(db, 'tulis_aku_daily_pool', `${state.slot12Key}_${state.mode}`), {
                slotKey: state.slot12Key,
                mode: state.mode,
                questions: aiQuestions,
                createdAt: new Date().toISOString()
            }, { merge: true }).catch(() => {});
        } catch (err) {
            console.warn('AI pool fallback error:', err);
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
                <p style="font-size:0.78rem; color:#475569; margin-bottom:10px;">Soal cadangan di sesi ini sudah habis terjawab! Tekan tombol di bawah untuk mengambil soal baru dari AI.</p>
                <button type="button" id="taBtnLoadMoreReserve" class="ta-btn-submit">Ambil Soal Cadangan Baru (AI)</button>
            </div>
        `;
        const btnMore = document.getElementById('taBtnLoadMoreReserve');
        if (btnMore) btnMore.addEventListener('click', loadExtraReserveBatch);
        return;
    }

    const reqWords = Array.isArray(ch.requiredWords) ? ch.requiredWords : [];
    const forbidden = Array.isArray(ch.forbiddenWords) ? ch.forbiddenWords : [];
    const targetStageLabel = state.playReserveMode
        ? `Soal Cadangan #${state.activeReserveIdx + 1}`
        : `Tantangan Bangunkan Tahap ${Math.min(8, state.stage + 1)} / 8`;

    const modeInfoText = state.mode === 'tantangan'
        ? 'Mode Tantangan (Ketat & Bonus Kecepatan Maksimal)'
        : (state.mode === 'acak' ? 'Mode Acak (Bentuk Tulisan Berganti Dinamis)' : 'Mode Santai (Mengalir & Ramah Pemula)');

    area.innerHTML = `
        <div class="ta-challenge-card">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:6px; margin-bottom:5px;">
                <span style="font-size:0.66rem; font-weight:800; color:#003366; text-transform:uppercase;">
                    ${escapeHtml(targetStageLabel)}
                </span>
                <span class="ta-pill is-gold">+${Number(ch.xpReward || 20)} XP</span>
            </div>

            <div style="font-size:0.9rem; font-weight:800; color:#0f172a;">
                ${escapeHtml(ch.title || 'Tantangan Menulis')}
                <span style="font-size:0.65rem; font-weight:700; color:#2563eb; background:#eff6ff; padding:2px 7px; border-radius:999px; margin-left:4px;">
                    ${escapeHtml(ch.formatLabel || 'Menulis Kreatif')}
                </span>
            </div>

            <div class="ta-prompt-box">${escapeHtml(ch.prompt)}</div>

            <div class="ta-req-chips">
                ${reqWords.map((w) => `<span class="ta-req-chip">Kata wajib: "${escapeHtml(w)}"</span>`).join('')}
                ${ch.requiredTheme ? `<span class="ta-req-chip is-theme">Unsur wajib: ${escapeHtml(ch.requiredTheme)}</span>` : ''}
                ${forbidden.map((fw) => `<span class="ta-req-chip" style="background:#fee2e2;color:#b91c1c;border-color:#fecaca;">Dilarang: "${escapeHtml(fw)}"</span>`).join('')}
            </div>

            <div style="font-size:0.64rem; color:#64748b; margin-bottom:7px;">
                <b>Ketentuan:</b> ${escapeHtml(modeInfoText)} &bull; Min. ${ch.minWords || 10} kata${ch.minLines > 1 ? ` &bull; Min. ${ch.minLines} baris` : ''}.
            </div>

            <textarea id="taAnswerInput" class="ta-textarea" placeholder="Tulis karyamu di sini secara utuh sesuai instruksi..."></textarea>

            <div class="ta-editor-meta">
                <span><b id="taLiveWordCount">0</b> kata &bull; <b id="taLiveLineCount">0</b> baris</span>
                <span>Evaluasi cepat via <b>Groq AI</b></span>
            </div>

            <button type="button" id="taBtnSubmitAnswer" class="ta-btn-submit">
                Kirim ke Si Beruang &amp; Periksa (Groq AI)
            </button>

            <div id="taEvalFeedbackSlot"></div>
        </div>
    `;

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
        const fresh = await fetchFreshQuestionsFromAI(excludeAll, true);
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
        { label: 'Unsur & Kata Wajib', obj: c.unsurWajib },
        { label: 'Bentuk & Ketentuan', obj: c.kesesuaianBentuk },
        { label: 'Daya Hidup Cerita', obj: c.kedalamanKreatif }
    ];

    slot.innerHTML = `
        <div class="ta-eval-box ${passed ? 'is-pass' : 'is-fail'}">
            <div style="display:flex; justify-content:space-between; align-items:center; font-weight:800; margin-bottom:4px; color:${passed ? '#15803d' : '#b91c1c'};">
                <span>${passed ? '✅ Si Beruang Bangun & Bertumbuh!' : '💤 Jawaban Ditolak — Beruang Tidur Lagi!'}</span>
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

    const userAnswer = inputEl.value.trim();
    if (!userAnswer) {
        alert('Tuliskan karyamu terlebih dahulu sebelum membangunkan Si Beruang!');
        return;
    }

    if (!state.startedAtMs) state.startedAtMs = Date.now();
    state.isEvaluating = true;
    if (btnEl) {
        btnEl.disabled = true;
        btnEl.textContent = 'Groq AI Sedang Memeriksa Karyamu...';
    }

    updateBearView('thinking', 'Hmm... Si Beruang sedang membaca tulisanmu dengan teliti bersama Groq AI...');

    try {
        const resp = await fetch('/api/central', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'evaluate-tulis-aku-answer',
                mode: state.mode,
                stage: ch.stage || state.stage + 1,
                challenge: ch,
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
            updateBearView('sad_sleep', evalRes.bearReaction || 'Yah... unsur tantangannya belum terasa pas, Si Beruang tidur lagi!');
            renderEvalFeedback(evalRes, false, dropMsg);
            return;
        }

        // LULUS! Simpan ke bank soal anti-duplikasi agar tidak muncul lagi
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
            setTimeout(() => {
                renderChallengeArea();
                updateBearView();
            }, 1900);
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

        setTimeout(() => {
            renderChallengeArea();
            updateBearView();
        }, 2000);
    } catch (err) {
        console.error('Error evaluasi Tulis Aku:', err);
        updateBearView(state.stage === 0 ? 'sleeping' : 'idle', 'Koneksi sedikit terganggu, coba kirim lagi tulisanmu!');
        const slot = document.getElementById('taEvalFeedbackSlot');
        if (slot) {
            slot.innerHTML = `<div class="ta-eval-box is-fail">Gagal menghubungi AI: ${escapeHtml(err.message)}</div>`;
        }
    } finally {
        state.isEvaluating = false;
        if (btnEl) {
            btnEl.disabled = false;
            btnEl.textContent = 'Kirim ke Si Beruang & Periksa (Groq AI)';
        }
    }
}

function renderFullArena() {
    const xpBadge = document.getElementById('taXpBadge');
    if (xpBadge) xpBadge.textContent = `+${state.xpEarnedToday} XP`;

    document.querySelectorAll('.ta-mode-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.mode === state.mode);
    });

    updateBearView();
    renderChallengeArea();
}

async function loadGameSession() {
    state.wibDayKey = getWibDayKey();
    state.slot12Key = get12WibSlotKey();
    state.playReserveMode = false;

    // 1. Muat bank soal yang sudah pernah dikerjakan agar tidak muncul ulang
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

    // 2. Cek progres hari ini (reset otomatis setiap 00:00 WIB karena key mengandung wibDayKey!)
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
    }

    const slotChanged = saved && saved.slot12Key && saved.slot12Key !== state.slot12Key;
    await ensureQuestionsForCurrentSlot(Boolean(slotChanged));
}

function initUiControls() {
    document.querySelectorAll('.ta-mode-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const nextMode = btn.dataset.mode;
            if (!nextMode || nextMode === state.mode) return;
            state.mode = nextMode;
            try { localStorage.setItem('cendekia_active_game_mode', nextMode); } catch (_) {}
            loadGameSession();
        });
    });

    const btnBack = document.getElementById('taBackLink');
    if (btnBack && cfg.backUrl) btnBack.href = cfg.backUrl;
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
