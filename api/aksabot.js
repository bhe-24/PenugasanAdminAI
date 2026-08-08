import OpenAI from 'openai';
import { initializeApp } from 'firebase/app';
import {
    getFirestore, collection, getDocs, query, orderBy,
    addDoc, doc, serverTimestamp
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

let authReadyPromise = null;
function ensureAuth() {
    if (!authReadyPromise) {
        authReadyPromise = signInAnonymously(auth).catch(err => {
            console.warn('[AUTH] Sign-in anonim gagal:', err.message);
        });
    }
    return authReadyPromise;
}

// INISIALISASI GROQ
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const groq = GROQ_API_KEY ? new OpenAI({
    apiKey: GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1"
}) : null;

const knowledgeCol = collection(db, 'aksabot_knowledge');
const questionsCol = collection(db, 'aksabot_questions');
const restrictionsCol = collection(db, 'aksabot_restrictions');

let knowledgeCache = {};
let restrictionsCache = [];
let lastKnowledgeUpdate = 0;
let lastRestrictionsUpdate = 0;
const CACHE_TTL = 5 * 60 * 1000;

const DEFAULT_RESTRICTIONS = [
    'buatkan puisi', 'buatkan pantun', 'kerjakan tugas', 'kerjakan pr',
    'kerjakan homework', 'buatkan essay', 'tulis artikel', 'tuliskan artikel',
    'berita hari ini', 'berita terbaru', 'ramalan cuaca', 'prediksi cuaca',
    'jadwal tv', 'jadwal acara tv', 'hasil pertandingan', 'skor pertandingan',
    'di luar komunitas'
];

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
            knowledgeCache[d.id] = { content: d.data().content, createdAt: d.data().createdAt };
        });
        lastKnowledgeUpdate = now;
        return Object.values(knowledgeCache).map(kb => kb.content).join('\n\n');
    } catch (err) {
        return 'Belum ada data spesifik.';
    }
}

async function loadRestrictions() {
    const now = Date.now();
    if (restrictionsCache.length > 0 && now - lastRestrictionsUpdate < CACHE_TTL) return restrictionsCache;
    try {
        const snap = await getDocs(restrictionsCol);
        const fromDb = [];
        snap.forEach(d => fromDb.push(d.data().keyword));
        restrictionsCache = fromDb.length > 0 ? fromDb : DEFAULT_RESTRICTIONS;
        lastRestrictionsUpdate = now;
        return restrictionsCache;
    } catch (err) {
        return DEFAULT_RESTRICTIONS;
    }
}

function normalizeText(text) {
    return text.toLowerCase().trim().replace(/[?!.,;:\s]+/g, ' ').trim();
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isInputRestricted(message, restrictions) {
    const lowerMsg = message.toLowerCase();
    return restrictions.some(rawKeyword => {
        const keyword = (rawKeyword || '').toLowerCase().trim();
        if (!keyword) return false;
        if (keyword.includes(' ')) return lowerMsg.includes(keyword);
        const regex = new RegExp(`\\b${escapeRegex(keyword)}\\b`, 'i');
        return regex.test(lowerMsg);
    });
}

function findSimilarInKnowledge(message) {
    const msgWords = normalizeText(message).split(' ');
    let bestMatch = null;
    let bestScore = 0;

    for (const kb of Object.values(knowledgeCache)) {
        const kbWords = normalizeText(kb.content).split(' ');
        let matchCount = 0;
        for (const word of msgWords) {
            if (word.length > 2 && kbWords.includes(word)) matchCount++;
        }
        const score = msgWords.length > 0 ? matchCount / msgWords.length : 0;
        if (score > bestScore && score > 0.5) {
            bestScore = score;
            bestMatch = kb.content;
        }
    }
    return bestMatch;
}

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
        return docRef.id;
    } catch (err) {
        return null;
    }
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function randomDelay(minMs, maxMs) { return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs; }

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: true, reply: 'Method not allowed' });

    if (!groq) {
        return res.status(500).json({ error: true, reply: 'Konfigurasi server belum lengkap (GROQ_API_KEY belum diset).' });
    }

    try {
        await ensureAuth();
        const { message, userName, history } = req.body || {};

        if (!message || message.trim().length === 0) {
            return res.status(400).json({ error: true, reply: 'Pesan tidak boleh kosong.' });
        }

        const restrictions = await loadRestrictions();
        if (isInputRestricted(message, restrictions)) {
            const restrictedReply = 'Maaf, aku hanya bisa membantu seputar komunitas Cendekia Aksara. Pertanyaan kamu sepertinya di luar kemampuanku saat ini. 🤖';
            await saveQuestion(message, userName, true, restrictedReply);
            return res.status(200).json({ restricted: true, reply: restrictedReply, timestamp: new Date().toISOString() });
        }

        // AMBIL PENGETAHUAN
        let knowledgeContext = await loadKnowledgeBase();
        const similarAnswer = findSimilarInKnowledge(message);

        // --- FIX PENTING: SABUK PENGAMAN TOKEN ---
        // Jika database terlalu besar (lebih dari 7.000 karakter), kita potong agar tidak overlimit!
        if (knowledgeContext.length > 7000) {
            knowledgeContext = knowledgeContext.substring(0, 7000) + "... [Data Lainnya Dipotong Karena Batas Memori]";
        }

        // Kalau ada jawaban yang spesifik mirip dengan pertanyaan (similarAnswer), prioritaskan itu!
        const finalContext = similarAnswer ? similarAnswer : knowledgeContext;

        const systemPrompt = `Kamu adalah AksaBot, asisten virtual resmi komunitas Cendekia Aksara. Sikapmu ramah, antusias, dan helpful layaknya seorang teman belajar.

IDENTITAS PENGGUNA YANG MENYAPA: ${userName || 'Teman'}

ATURAN WAJIB (HARUS DIIKUTI 100%):
1. Berikan jawaban yang LENGKAP dan DETAIL.
2. Gunakan [REFERENSI] di bawah ini sebagai sumber kebenaran utama. Jika ada info relevan, WAJIB sertakan.
3. JANGAN memakai markdown bintang ganda (**teks**). 
4. Gunakan maksimal 2 emoji per pesan.
5. Jika pengguna hanya menyapa (misal: "hai"), sapa balik dengan ramah, sebut namanya, dan tawarkan bantuan.

[REFERENSI CENDEKIA AKSARA]:
${finalContext && finalContext.trim().length > 0 ? finalContext : 'Jawab berdasarkan pengetahuan umum seputar Cendekia Aksara.'}`;

        const formattedMessages = [
            { role: 'system', content: systemPrompt }
        ];

        // --- FIX PENTING 2: BATASI MEMORI CHAT ---
        // Jangan kirim seluruh histori panjang. Ambil 4 chat terakhir saja!
        if (history && Array.isArray(history)) {
            const recentHistory = history.slice(-4);
            recentHistory.forEach(h => {
                formattedMessages.push({
                    role: h.role === 'user' ? 'user' : 'assistant',
                    content: h.content
                });
            });
        }

        formattedMessages.push({ role: 'user', content: message });

        // PANGGIL GROQ
        const completion = await groq.chat.completions.create({
            model: 'llama-3.1-8b-instant',
            messages: formattedMessages,
            temperature: 0.7,
            max_tokens: 1024 // Dikecilkan sedikit agar aman di limit TPM
        });

        let finalAnswer = completion.choices[0]?.message?.content || "";
        finalAnswer = finalAnswer.replace(/```[\w]*\n?/g, '').trim();

        if (!finalAnswer) throw new Error('Groq mengembalikan jawaban kosong');

        const questionId = await saveQuestion(message, userName, true, finalAnswer);
        await sleep(randomDelay(500, 1000));

        return res.status(200).json({
            reply: finalAnswer,
            model: 'llama-3.1-8b-instant',
            questionId: questionId,
            fromKnowledge: !!similarAnswer,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[AksaBot] Fatal error:', error?.message || error);

        if (req.body?.message) {
            await saveQuestion(req.body.message, req.body.userName || 'Anonymous', false, null);
        }
        return res.status(500).json({
            error: true,
            reply: 'Waduh, AksaBot lagi pusing nih (Server Penuh). Coba sapa aku lagi beberapa menit lagi ya! 🙏'
        });
    }
}
