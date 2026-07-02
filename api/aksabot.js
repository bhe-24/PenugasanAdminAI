import { GoogleGenerativeAI } from '@google/generative-ai';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getFirestore, collection, getDocs, query, orderBy } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

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
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Urutan fallback: coba dari atas, kalau error lanjut ke bawah
const MODEL_CHAIN = [
    "gemini-2.5-flash",
    "gemini-3-flash",
    "gemma-3-27b-it",
    "gemma-3-12b-it",
];

// In-memory knowledge base cache dengan TTL
let knowledgeCache = {};
let lastKnowledgeUpdate = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 menit

// Default restrictions (bisa di-update dari Firestore nanti)
const DEFAULT_RESTRICTIONS = [
    'puisi', 'tugas', 'homework', 'essay', 'artikel', 'berita',
    'cuaca', 'ramalan', 'prediksi', 'jadwal tv', 'olahraga luar',
    'di luar komunitas'
];

let RESTRICTED_KEYWORDS = [...DEFAULT_RESTRICTIONS];

/**
 * Load knowledge base dari Firestore (dengan cache)
 */
async function loadKnowledgeBase() {
    const now = Date.now();
    
    // Gunakan cache jika masih fresh
    if (Object.keys(knowledgeCache).length > 0 && now - lastKnowledgeUpdate < CACHE_TTL) {
        console.log('[KB] Using cached knowledge base');
        return Object.values(knowledgeCache).map(kb => kb.content).join('\n\n');
    }

    try {
        console.log('[KB] Fetching fresh knowledge base from Firestore...');
        const q = query(collection(db, 'aksabot_knowledge'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        
        knowledgeCache = {};
        snap.forEach(doc => {
            const data = doc.data();
            knowledgeCache[doc.id] = {
                content: data.content,
                createdAt: data.createdAt
            };
        });
        
        lastKnowledgeUpdate = now;
        const combined = Object.values(knowledgeCache).map(kb => kb.content).join('\n\n');
        console.log(`[KB] Loaded ${Object.keys(knowledgeCache).length} documents`);
        return combined;
    } catch (err) {
        console.error('[KB] Error loading from Firestore:', err.message);
        return 'Belum ada data spesifik.';
    }
}

/**
 * Check apakah user input mengandung keyword yang membatasi
 */
function isInputRestricted(message) {
    if (!message) return false;
    const lowerMsg = message.toLowerCase().trim();
    return RESTRICTED_KEYWORDS.some(keyword => lowerMsg.includes(keyword));
}

/**
 * Normalize pertanyaan untuk lookup di cache
 */
function normalizeQuestion(q) {
    return q
        .toLowerCase()
        .trim()
        .replace(/[?!.,;:]/g, '')
        .replace(/\s+/g, ' ');
}

/**
 * Cek apakah pertanyaan sudah pernah dijawab (dari cache)
 */
function getFromCache(message) {
    const normalized = normalizeQuestion(message);
    
    for (const [key, value] of Object.entries(knowledgeCache)) {
        const cacheKey = normalizeQuestion(value.content.substring(0, 100));
        if (normalized.includes(cacheKey) || cacheKey.includes(normalized)) {
            return true; // Pertanyaan related dengan knowledge base
        }
    }
    
    return false;
}

function buildPrompt(userName, knowledgeContext, history, message) {
    const historyText = history && history.length
        ? history.map(h => `${h.role === 'user' ? 'User' : 'AksaBot'}: ${h.content}`).join('\n')
        : '';

    return `Kamu adalah AksaBot, asisten virtual Cendekia Aksara. Kamu ramah, singkat, dan to the point.

IDENTITAS PENGGUNA: ${userName || 'Teman'}

ATURAN WAJIB:
1. Jawab SINGKAT tapi LENGKAP — maksimal 5-7 kalimat untuk semua pertanyaan.
2. Gunakan data dari [REFERENSI] SEBAIK MUNGKIN. Jika ada data relevan, WAJIB gunakan.
3. Kalau tidak ada data spesifik, jawab dari pengetahuan umum tapi TETAP relevan dengan Cendekia Aksara.
4. Gunakan <b>teks</b> untuk menebalkan, <br> untuk enter baru. JANGAN pakai ** atau markdown.
5. Emoji boleh, tapi jangan lebih dari 2 per pesan.
6. Ingat konteks percakapan sebelumnya dan jawab sesuai konteks itu.
7. PENTING: Jangan hanya bilang 'Halo' atau greeting sederhana. Berikan informasi yang useful!

[REFERENSI CENDEKIA AKSARA]:
${knowledgeContext && knowledgeContext.trim().length > 0 ? knowledgeContext : 'Belum ada data spesifik dalam basis pengetahuan. Jawab berdasarkan pengetahuan umum seputar Cendekia Aksara.'}

${historyText ? `[RIWAYAT PERCAKAPAN]:\n${historyText}\n` : ''}
User: ${message}
AksaBot:`;
}

/**
 * Middleware: Validasi input user
 */
function validateInput(message) {
    if (!message || message.trim().length === 0) {
        return {
            allowed: false,
            errorMessage: 'Pesan kosong'
        };
    }

    if (isInputRestricted(message)) {
        return {
            allowed: false,
            errorMessage: 'Maaf, saya hanya bisa membantu seputar komunitas Cendekia Aksara. Pertanyaan kamu termasuk di luar scope saya. 🤖'
        };
    }

    return { allowed: true };
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
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { message, userName, history } = req.body;

        // ── STEP 1: Validasi input dengan middleware ──
        const validation = validateInput(message);
        if (!validation.allowed) {
            return res.status(400).json({
                error: true,
                message: validation.errorMessage
            });
        }

        // ── STEP 2: Load Knowledge Base dari Firestore ──
        const knowledgeContext = await loadKnowledgeBase();

        // ── STEP 3: Query AI dengan fresh knowledge base ──
        const prompt = buildPrompt(userName, knowledgeContext, history, message);
        let lastError = null;

        for (const modelName of MODEL_CHAIN) {
            try {
                const model = genAI.getGenerativeModel({
                    model: modelName,
                    generationConfig: {
                        maxOutputTokens: 500,   // Tingkatkan untuk jawaban lebih lengkap
                        temperature: 0.7,
                        topP: 0.9,
                    }
                });

                const result = await model.generateContent(prompt);
                let text = result.response.text().trim();

                // Bersihkan sisa markdown
                text = text
                    .replace(/```[\w]*\n?/g, '')
                    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
                    .replace(/\*(.*?)\*/g, '<i>$1</i>')
                    .trim();

                // ── STEP 4: Simulasi human-like response time ──
                await sleep(randomDelay(800, 1500));

                return res.status(200).json({
                    reply: text,
                    model: modelName,
                    knowledgeUsed: knowledgeContext.trim().length > 0
                });

            } catch (err) {
                console.warn(`Model ${modelName} gagal:`, err.message);
                lastError = err;
            }
        }

        // Semua model gagal
        console.error("Semua model gagal:", lastError);
        await sleep(randomDelay(800, 1500));
        
        return res.status(500).json({
            error: true,
            reply: "Aduh, semua sistem lagi sibuk nih 💤. Coba lagi sebentar ya!"
        });

    } catch (error) {
        console.error("AksaBot handler error:", error);
        await sleep(randomDelay(500, 1000));
        
        return res.status(500).json({
            error: true,
            reply: "Terjadi kesalahan tak terduga. Coba lagi ya! 🙏"
        });
    }
}
