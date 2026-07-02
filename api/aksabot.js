import { GoogleGenerativeAI } from '@google/generative-ai';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getFirestore, collection, getDocs, query, orderBy, addDoc, updateDoc, doc, serverTimestamp, where } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

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

// Collections
const knowledgeCol = collection(db, 'aksabot_knowledge');
const questionsCol = collection(db, 'aksabot_questions');
const restrictionsCol = collection(db, 'aksabot_restrictions');

// Urutan fallback model
const MODEL_CHAIN = [
    "gemini-2.5-flash",
    "gemini-3-flash",
    "gemma-3-27b-it",
    "gemma-3-12b-it",
];

// In-memory cache
let knowledgeCache = {};
let restrictionsCache = [];
let lastKnowledgeUpdate = 0;
let lastRestrictionsUpdate = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 menit

const DEFAULT_RESTRICTIONS = [
    'puisi', 'tugas', 'homework', 'essay', 'artikel', 'berita',
    'cuaca', 'ramalan', 'prediksi', 'jadwal tv', 'olahraga luar',
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
        snap.forEach(doc => {
            knowledgeCache[doc.id] = {
                content: doc.data().content,
                createdAt: doc.data().createdAt
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
 * Load restrictions dari Firestore
 */
async function loadRestrictions() {
    const now = Date.now();
    if (restrictionsCache.length > 0 && now - lastRestrictionsUpdate < CACHE_TTL) {
        return restrictionsCache;
    }

    try {
        const snap = await getDocs(restrictionsCol);
        restrictionsCache = [];
        snap.forEach(doc => {
            restrictionsCache.push(doc.data().keyword);
        });
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

/**
 * Cek apakah input mengandung restricted keywords
 */
function isInputRestricted(message, restrictions) {
    const lowerMsg = message.toLowerCase();
    return restrictions.some(keyword => lowerMsg.includes(keyword.toLowerCase()));
}

/**
 * Cek apakah pertanyaan sudah ada di knowledge base
 */
function findSimilarInKnowledge(message) {
    const normalized = normalizeText(message);
    const msgWords = normalized.split(' ');
    
    let bestMatch = null;
    let bestScore = 0;

    for (const [id, kb] of Object.entries(knowledgeCache)) {
        const kbNormalized = normalizeText(kb.content);
        const kbWords = kbNormalized.split(' ');
        
        // Hitung similarity score
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

/**
 * Update question answer
 */
async function updateQuestionAnswer(questionId, answer) {
    try {
        await updateDoc(doc(db, 'aksabot_questions', questionId), {
            isAnswered: true,
            answer: answer,
            updatedAt: serverTimestamp()
        });
        console.log('[UPDATE] Question answered:', questionId);
        return true;
    } catch (err) {
        console.error('[UPDATE] Error:', err.message);
        return false;
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
4. Format: Gunakan <b>bold</b>, <br>new line</br>. JANGAN pakai markdown **.
5. Emoji OK tapi max 2 per pesan.
6. Ingat konteks percakapan & jawab sesuai.
7. KUNCI: Jangan singkat-singkat. Berikan nilai penuh untuk user!

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
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { message, userName, history } = req.body;

        // Validasi input
        if (!message || message.trim().length === 0) {
            return res.status(400).json({ error: true, message: 'Pesan kosong' });
        }

        // Load restrictions
        const restrictions = await loadRestrictions();

        // Check restricted keywords
        if (isInputRestricted(message, restrictions)) {
            // Save pertanyaan yang di-restrict
            await saveQuestion(message, userName, true, 'Pertanyaan di luar scope komunitas Cendekia Aksara');
            
            return res.status(400).json({
                error: true,
                message: 'Maaf, saya hanya bisa membantu seputar komunitas Cendekia Aksara. Pertanyaan kamu termasuk di luar scope saya. 🤖'
            });
        }

        // Load knowledge base
        const knowledgeContext = await loadKnowledgeBase();

        // Cek apakah sudah ada jawaban di knowledge base
        const similarAnswer = findSimilarInKnowledge(message);
        
        // Build prompt untuk AI
        const prompt = buildPrompt(userName, knowledgeContext, history, message);
        let lastError = null;
        let finalAnswer = null;
        let usedModel = null;

        // Try different models
        for (const modelName of MODEL_CHAIN) {
            try {
                const model = genAI.getGenerativeModel({
                    model: modelName,
                    generationConfig: {
                        maxOutputTokens: 600,
                        temperature: 0.7,
                        topP: 0.9,
                    }
                });

                const result = await model.generateContent(prompt);
                let text = result.response.text().trim();

                // Clean markdown
                text = text
                    .replace(/```[\w]*\n?/g, '')
                    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
                    .replace(/\*(.*?)\*/g, '<i>$1</i>')
                    .trim();

                finalAnswer = text;
                usedModel = modelName;
                break;

            } catch (err) {
                console.warn(`Model ${modelName} gagal:`, err.message);
                lastError = err;
            }
        }

        if (!finalAnswer) {
            throw lastError || new Error('Semua model gagal');
        }

        // ── PENTING: Save pertanyaan dengan jawaban langsung ──
        const questionId = await saveQuestion(message, userName, true, finalAnswer);

        // Simulate human typing
        await sleep(randomDelay(800, 1500));

        return res.status(200).json({
            reply: finalAnswer,
            model: usedModel,
            questionId: questionId,
            fromKnowledge: !!similarAnswer,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error("AksaBot error:", error);
        
        // Save pertanyaan yang error untuk admin follow-up
        if (req.body?.message) {
            await saveQuestion(req.body.message, req.body.userName || 'Anonymous', false, null);
        }

        await sleep(randomDelay(500, 1000));
        
        return res.status(500).json({
            error: true,
            reply: "Terjadi kesalahan. Admin sudah diberitahu untuk follow-up. 🙏"
        });
    }
}
