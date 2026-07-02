import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Urutan fallback: coba dari atas, kalau error lanjut ke bawah
const MODEL_CHAIN = [
    "gemini-2.5-flash",
    "gemini-3-flash",
    "gemma-3-27b-it",   // Gemma 4 26B (nama model di API Google)
    "gemma-3-12b-it",   // Gemma 4 12B sebagai safety net terakhir
];

// In-memory knowledge base cache (replace with DB query if using persistent storage)
let knowledgeCache = {};

// Keywords yang membatasi scope chatbot
const RESTRICTED_KEYWORDS = [
    'puisi',
    'tugas',
    'homework',
    'essay',
    'artikel',
    'berita',
    'cuaca',
    'ramalan',
    'prediksi',
    'jadwal tv',
    'olahraga luar',
    'di luar komunitas'
];

/**
 * Check apakah user input mengandung keyword yang membatasi
 */
function isInputRestricted(message) {
    if (!message) return false;
    const lowerMsg = message.toLowerCase().trim();
    return RESTRICTED_KEYWORDS.some(keyword => lowerMsg.includes(keyword));
}

/**
 * Normalize pertanyaan untuk lookup di knowledge base
 * Hapus tanda baca, convert ke lowercase, trim whitespace
 */
function normalizeQuestion(q) {
    return q
        .toLowerCase()
        .trim()
        .replace(/[?!.,;:]/g, '')
        .replace(/\s+/g, ' ');
}

/**
 * Cek apakah pertanyaan sudah pernah dijawab (dari in-memory cache)
 * Dalam production, ganti dengan query ke SQLite atau database
 */
function getFromKnowledgeBase(message) {
    const normalized = normalizeQuestion(message);
    
    // Cari matching pertanyaan dengan similarity (simple substring match)
    for (const [key, value] of Object.entries(knowledgeCache)) {
        if (key.includes(normalized) || normalized.includes(key)) {
            return value;
        }
    }
    
    return null;
}

/**
 * Simpan pertanyaan & jawaban baru ke knowledge base
 * Dalam production, ganti dengan INSERT ke SQLite atau database
 */
function saveToKnowledgeBase(message, reply) {
    const normalized = normalizeQuestion(message);
    knowledgeCache[normalized] = {
        question: message,
        answer: reply,
        savedAt: new Date().toISOString(),
    };
    
    console.log(`[KB] Saved: "${message}" => "${reply.substring(0, 50)}..."`);
    return true;
}

function buildPrompt(userName, knowledgeContext, history, message) {
    const historyText = history && history.length
        ? history.map(h => `${h.role === 'user' ? 'User' : 'AksaBot'}: ${h.content}`).join('\n')
        : '';

    return `Kamu adalah AksaBot, asisten virtual Cendekia Aksara. Kamu ramah, singkat, dan to the point.

IDENTITAS PENGGUNA: ${userName || 'Teman'}

ATURAN WAJIB:
1. Jawab SINGKAT — maksimal 3 kalimat untuk pertanyaan umum, maksimal 5 kalimat untuk pertanyaan tentang Cendekia Aksara.
2. JANGAN buat list panjang atau banyak paragraf. Satu paragraf padat lebih baik.
3. Kalau ada data di [REFERENSI], gunakan itu. Kalau tidak ada, jawab dari pengetahuan umum secara ringkas.
4. Gunakan <b>teks</b> untuk menebalkan, <br> untuk enter baru. JANGAN pakai ** atau markdown.
5. Emoji boleh, tapi jangan lebih dari 2 per pesan.
6. Ingat konteks percakapan sebelumnya dan jawab sesuai konteks itu.

[REFERENSI CENDEKIA AKSARA]:
${knowledgeContext || 'Belum ada data spesifik.'}

${historyText ? `[RIWAYAT PERCAKAPAN]:\n${historyText}\n` : ''}
User: ${message}
AksaBot:`;
}

/**
 * Middleware: Validasi input user
 * Return object dengan { allowed: boolean, errorMessage?: string }
 */
function validateInput(message) {
    if (!message || message.trim().length === 0) {
        return {
            allowed: false,
            errorMessage: 'Pesan kosong'
        };
    }

    // Check restricted keywords
    if (isInputRestricted(message)) {
        return {
            allowed: false,
            errorMessage: 'Maaf, saya hanya bisa membantu seputar komunitas Cendekia Aksara. Pertanyaan kamu termasuk di luar scope saya. 🤖'
        };
    }

    return { allowed: true };
}

/**
 * Sleep function untuk simulasi "human-like" response time
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate random delay antara min dan max ms
 */
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
        const { message, knowledgeContext, userName, history } = req.body;

        // ── STEP 1: Validasi input dengan middleware ──
        const validation = validateInput(message);
        if (!validation.allowed) {
            return res.status(400).json({
                error: true,
                message: validation.errorMessage
            });
        }

        // ── STEP 2: Cek Knowledge Base ("Database Otak") ──
        const cachedReply = getFromKnowledgeBase(message);
        if (cachedReply) {
            console.log(`[KB HIT] Returning cached reply for: "${message}"`);
            
            // Simulasi human-like response time (500-1200ms untuk cached)
            await sleep(randomDelay(500, 1200));
            
            return res.status(200).json({
                reply: cachedReply.answer,
                model: 'knowledge-base-cache',
                fromCache: true
            });
        }

        // ── STEP 3: Query AI jika belum ada di knowledge base ──
        const prompt = buildPrompt(userName, knowledgeContext, history, message);
        let lastError = null;

        for (const modelName of MODEL_CHAIN) {
            try {
                const model = genAI.getGenerativeModel({
                    model: modelName,
                    generationConfig: {
                        maxOutputTokens: 300,   // Batasi output agar tetap ringkas
                        temperature: 0.7,
                        topP: 0.9,
                    }
                });

                const result = await model.generateContent(prompt);
                let text = result.response.text().trim();

                // Bersihkan sisa markdown kalau ada
                text = text
                    .replace(/```[\w]*\n?/g, '')
                    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
                    .replace(/\*(.*?)\*/g, '<i>$1</i>')
                    .trim();

                // ── STEP 4: Simpan ke Knowledge Base ("Pembelajaran") ──
                saveToKnowledgeBase(message, text);

                // ── STEP 5: Simulasi human-like response time (800-1500ms) ──
                // Biasanya orang perlu waktu untuk mengetik & berpikir
                await sleep(randomDelay(800, 1500));

                return res.status(200).json({
                    reply: text,
                    model: modelName,
                    fromCache: false
                });

            } catch (err) {
                console.warn(`Model ${modelName} gagal:`, err.message);
                lastError = err;
                // Lanjut ke model berikutnya
            }
        }

        // Semua model gagal
        console.error("Semua model gagal:", lastError);
        
        // Tetap apply delay meski error
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
