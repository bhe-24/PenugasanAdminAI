import { GoogleGenerativeAI } from '@google/generative-ai';
// PENTING: sebelumnya file ini meng-import Firebase langsung dari URL
// (https://www.gstatic.com/...). Itu HANYA berjalan di browser (ES module
// dari URL) dan TIDAK didukung oleh runtime Node.js di Vercel — akibatnya
// fungsi ini crash setiap kali dipanggil ("ERR_UNSUPPORTED_ESM_URL_SCHEME"),
// bahkan sebelum kode di bawah sempat berjalan. Ini penyebab semua
// pertanyaan selalu berakhir "Koneksi bermasalah". Sekarang pakai package
// npm biasa — pastikan "firebase" ada di dependencies package.json.
import { initializeApp } from 'firebase/app';
import {
    getFirestore, collection, getDocs, query, orderBy,
    addDoc, updateDoc, doc, serverTimestamp
} from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

const firebaseConfig = {
    apiKey: "AIzaSyDpUWUIzPXIZN6rrNtsIqcL6VfOE2RLVl0",
    authDomain: "mading-cf676.firebaseapp.com",
    projectId: "mading-cf676",
    storageBucket: "mading-cf676.firebasestorage.app",
    messagingSenderId: "72175203671",
    appId: "1:72175203671:web:7a0676a55beb64bc96ba12"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Sign-in anonim di server, menyamai pola yang dipakai dashboard di client.
// Ini mencegah error "permission-denied" kalau Firestore Rules mensyaratkan
// request harus terautentikasi. Kalau Rules Anda memang sudah publik, baris
// ini tetap aman — cuma tidak berpengaruh apa-apa.
let authReadyPromise = null;
function ensureAuth() {
    if (!authReadyPromise) {
        authReadyPromise = signInAnonymously(auth).catch(err => {
            console.warn('[AUTH] Sign-in anonim gagal (lanjut, mungkin Rules sudah publik):', err.message);
        });
    }
    return authReadyPromise;
}

// ── PENTING: pastikan GEMINI_API_KEY ada di Environment Variables Vercel ──
// Tanpa ini SEMUA model akan gagal dan user akan selalu melihat pesan error.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// Collections
const knowledgeCol = collection(db, 'aksabot_knowledge');
const questionsCol = collection(db, 'aksabot_questions');
const restrictionsCol = collection(db, 'aksabot_restrictions');

// ── Urutan fallback model: GEMMA DIUTAMAKAN, Gemini hanya cadangan terakhir ──
const MODEL_CHAIN = [
    "gemma-3-27b-it",
    "gemma-3-12b-it",
    "gemma-3-4b-it",
    "gemini-2.5-flash", // fallback terakhir kalau semua model gemma gagal
];

// In-memory cache
let knowledgeCache = {};
let restrictionsCache = [];
let lastKnowledgeUpdate = 0;
let lastRestrictionsUpdate = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 menit

// Gunakan FRASA spesifik, bukan kata umum satu-kata, supaya tidak salah
// menandai pertanyaan wajar sebagai "di luar topik". Kata tunggal seperti
// "tugas" atau "berita" terlalu sering muncul di kalimat normal.
const DEFAULT_RESTRICTIONS = [
    'buatkan puisi', 'buatkan pantun', 'kerjakan tugas', 'kerjakan pr',
    'kerjakan homework', 'buatkan essay', 'tulis artikel', 'tuliskan artikel',
    'berita hari ini', 'berita terbaru', 'ramalan cuaca', 'prediksi cuaca',
    'jadwal tv', 'jadwal acara tv', 'hasil pertandingan', 'skor pertandingan',
    'di luar komunitas'
];

/**
 * Load knowledge base dari Firestore dengan cache
 */
async function loadKnowledgeBase() {
    const now = Date.now();
    if (Object.keys(knowledgeCache).length > 0 && now - lastKnowledgeUpdate < CACHE_TTL) {
        return Object.values(knowledgeCache).map(kb => kb.content).join('\n\n');
    }

    try {
        const q = query(knowledgeCol, orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);

        knowledgeCache = {};
        snap.forEach(d => {
            knowledgeCache[d.id] = {
                content: d.data().content,
                createdAt: d.data().createdAt
            };
        });

        lastKnowledgeUpdate = now;
        const combined = Object.values(knowledgeCache).map(kb => kb.content).join('\n\n');
        console.log(`[KB] Loaded ${Object.keys(knowledgeCache).length} documents`);
        return combined;
    } catch (err) {
        console.error('[KB] Error:', err.message);
        return 'Belum ada data spesifik.';
    }
}

/**
 * Load restrictions dari Firestore (fallback ke default jika kosong/gagal)
 */
async function loadRestrictions() {
    const now = Date.now();
    if (restrictionsCache.length > 0 && now - lastRestrictionsUpdate < CACHE_TTL) {
        return restrictionsCache;
    }

    try {
        const snap = await getDocs(restrictionsCol);
        const fromDb = [];
        snap.forEach(d => fromDb.push(d.data().keyword));

        // Kalau admin belum pernah menambah restriction sendiri, pakai default.
        restrictionsCache = fromDb.length > 0 ? fromDb : DEFAULT_RESTRICTIONS;
        lastRestrictionsUpdate = now;
        console.log(`[RESTRICT] Loaded ${restrictionsCache.length} restrictions`);
        return restrictionsCache;
    } catch (err) {
        console.error('[RESTRICT] Error:', err.message);
        return DEFAULT_RESTRICTIONS;
    }
}

/**
 * Normalize text untuk perbandingan
 */
function normalizeText(text) {
    return text
        .toLowerCase()
        .trim()
        .replace(/[?!.,;:\s]+/g, ' ')
        .trim();
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Cek apakah input mengandung restricted keywords.
 * - Frasa (mengandung spasi) dicocokkan sebagai substring apa adanya.
 * - Kata tunggal dicocokkan dengan batas kata (\b) supaya "tugas" tidak
 *   ikut ke-trigger oleh "petugas" / "bertugas", dll.
 */
function isInputRestricted(message, restrictions) {
    const lowerMsg = message.toLowerCase();
    return restrictions.some(rawKeyword => {
        const keyword = (rawKeyword || '').toLowerCase().trim();
        if (!keyword) return false;

        if (keyword.includes(' ')) {
            return lowerMsg.includes(keyword);
        }

        const regex = new RegExp(`\\b${escapeRegex(keyword)}\\b`, 'i');
        return regex.test(lowerMsg);
    });
}

/**
 * Cek apakah pertanyaan sudah ada di knowledge base
 */
function findSimilarInKnowledge(message) {
    const normalized = normalizeText(message);
    const msgWords = normalized.split(' ');

    let bestMatch = null;
    let bestScore = 0;

    for (const kb of Object.values(knowledgeCache)) {
        const kbNormalized = normalizeText(kb.content);
        const kbWords = kbNormalized.split(' ');

        let matchCount = 0;
        for (const word of msgWords) {
            if (word.length > 2 && kbWords.includes(word)) {
                matchCount++;
            }
        }

        const score = msgWords.length > 0 ? matchCount / msgWords.length : 0;

        if (score > bestScore && score > 0.5) {
            bestScore = score;
            bestMatch = kb.content;
        }
    }

    return bestMatch;
}

/**
 * Save question ke Firestore
 */
async function saveQuestion(message, userName, isAnswered = false, answer = null) {
    try {
        const docRef = await addDoc(questionsCol, {
            question: message,
            userName: userName || 'Anonymous',
            isAnswered: isAnswered,
            answer: answer || null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            source: 'dashboard'
        });
        console.log('[SAVE] Question saved:', docRef.id);
        return docRef.id;
    } catch (err) {
        console.error('[SAVE] Error saving question:', err.message);
        return null;
    }
}

function buildPrompt(userName, knowledgeContext, history, message) {
    const historyText = history && history.length
        ? history.map(h => `${h.role === 'user' ? 'User' : 'AksaBot'}: ${h.content}`).join('\n')
        : '';

    return `Kamu adalah AksaBot, asisten virtual Cendekia Aksara. Kamu ramah, detail, dan helpful.

IDENTITAS PENGGUNA: ${userName || 'Teman'}

ATURAN WAJIB:
1. Jawab LENGKAP dengan informasi detail — 5-10 kalimat adalah ideal.
2. Prioritas TINGGI pada [REFERENSI]. Gunakan sebanyak mungkin jika relevan.
3. Jika tidak ada referensi spesifik, jawab tetap berkualitas seputar Cendekia Aksara.
4. Format: Gunakan <b>bold</b>, gunakan \\n untuk baris baru. JANGAN pakai markdown **.
5. Emoji OK tapi max 2 per pesan.
6. Ingat konteks percakapan & jawab sesuai riwayat di bawah.
7. KUNCI: Jangan singkat-singkat, apalagi hanya menyapa nama user. Berikan jawaban penuh sesuai pertanyaan!

[REFERENSI CENDEKIA AKSARA]:
${knowledgeContext && knowledgeContext.trim().length > 0 ? knowledgeContext : 'Database pembelajaran. Jawab berdasarkan pengetahuan umum Cendekia Aksara.'}

${historyText ? `[RIWAYAT PERCAKAPAN]:\n${historyText}\n` : ''}
User: ${message}
AksaBot:`;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay(minMs, maxMs) {
    return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: true, reply: 'Method not allowed' });

    // ── Validasi konfigurasi lebih awal, supaya errornya jelas di log
    // dan tidak muncul sebagai "koneksi bermasalah" yang membingungkan. ──
    if (!genAI) {
        console.error('[CONFIG] GEMINI_API_KEY tidak ditemukan di environment variables!');
        return res.status(500).json({
            error: true,
            reply: 'Konfigurasi server belum lengkap (API key belum diset). Admin sudah diberitahu. 🙏'
        });
    }

    try {
        await ensureAuth();

        const { message, userName, history } = req.body || {};

        if (!message || message.trim().length === 0) {
            return res.status(400).json({ error: true, reply: 'Pesan tidak boleh kosong.' });
        }

        // Load restrictions
        const restrictions = await loadRestrictions();

        // Check restricted keywords
        if (isInputRestricted(message, restrictions)) {
            const restrictedReply = 'Maaf, saya hanya bisa membantu seputar komunitas Cendekia Aksara. Pertanyaan kamu termasuk di luar scope saya. 🤖';
            await saveQuestion(message, userName, true, restrictedReply);

            // Status 200 (bukan error) karena ini alur bisnis normal, bukan
            // kegagalan sistem — supaya client menampilkan pesan yang tepat,
            // bukan pesan generik "koneksi bermasalah".
            return res.status(200).json({
                restricted: true,
                reply: restrictedReply,
                timestamp: new Date().toISOString()
            });
        }

        // Load knowledge base (server = satu-satunya sumber kebenaran)
        const knowledgeContext = await loadKnowledgeBase();
        const similarAnswer = findSimilarInKnowledge(message);

        const prompt = buildPrompt(userName, knowledgeContext, history, message);
        let lastError = null;
        let finalAnswer = null;
        let usedModel = null;

        for (const modelName of MODEL_CHAIN) {
            try {
                const model = genAI.getGenerativeModel({
                    model: modelName,
                    generationConfig: {
                        maxOutputTokens: 1024,
                        temperature: 0.7,
                        topP: 0.9,
                    }
                });

                const result = await model.generateContent(prompt);
                let text = result.response.text().trim();

                text = text
                    .replace(/```[\w]*\n?/g, '')
                    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
                    .replace(/\*(.*?)\*/g, '<i>$1</i>')
                    .trim();

                if (!text) {
                    throw new Error(`Model ${modelName} mengembalikan jawaban kosong`);
                }

                finalAnswer = text;
                usedModel = modelName;
                break;

            } catch (err) {
                console.warn(`[MODEL] ${modelName} gagal:`, err?.message || err, err?.status ? `(status ${err.status})` : '');
                lastError = err;
            }
        }

        if (!finalAnswer) {
            throw lastError || new Error('Semua model pada MODEL_CHAIN gagal merespons');
        }

        const questionId = await saveQuestion(message, userName, true, finalAnswer);

        await sleep(randomDelay(800, 1500));

        return res.status(200).json({
            reply: finalAnswer,
            model: usedModel,
            questionId: questionId,
            fromKnowledge: !!similarAnswer,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[AksaBot] Fatal error:', error?.message || error);

        if (req.body?.message) {
            await saveQuestion(req.body.message, req.body.userName || 'Anonymous', false, null);
        }

        await sleep(randomDelay(500, 1000));

        return res.status(500).json({
            error: true,
            reply: 'Terjadi kesalahan di server. Admin sudah diberitahu untuk follow-up. 🙏'
        });
    }
}
