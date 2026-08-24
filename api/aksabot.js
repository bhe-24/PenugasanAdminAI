import OpenAI from 'openai';

// Inisialisasi API Groq Resmi
const groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1'
});

// Daftar Model Langsung dari Console Groq (Sesuai List Kamu)
// Sistem akan otomatis loncat ke model bawahnya jika model pertama error/limit
const GROQ_MODELS = [
    'groq/compound',               // Prioritas 1: Utama
    'groq/compound-mini',          // Prioritas 2: Cadangan ringan
    'qwen/qwen3.6-27b',            // Prioritas 3: Qwen di LPU Groq
    'openai/gpt-oss-120b'          // Prioritas 4: Cadangan terakhir
];

export default async function handler(req, res) {
    // 1. ATUR CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: true, reply: 'Method not allowed' });

    try {
        const { message, userName, history, knowledgeContext } = req.body || {};

        if (!message || message.trim().length === 0) {
            return res.status(400).json({ error: true, reply: 'Pesan tidak boleh kosong.' });
        }

        // Susun System Prompt (Super Ketat & Dinamis)
        const systemPrompt = `Kamu adalah AksaBot, asisten virtual resmi komunitas Cendekia Aksara. Sikapmu ramah, antusias, dan helpful layaknya seorang teman belajar.

IDENTITAS PENGGUNA YANG MENYAPA: ${userName || 'Teman'}

ATURAN WAJIB (HARUS DIIKUTI 100%):
1. BERADAPTASI DENGAN GAYA BAHASA PENGGUNA (MIRRORING). Jika pengguna menyapa santai/gaul (misal: "helow broo", "lagi ngapain"), balaslah dengan bahasa gaul dan santai ("heloow juga bro!", "lagi *standby* nih"). Jika pengguna memakai bahasa baku/formal, balaslah dengan sopan dan formal.
2. PANJANG JAWABAN DINAMIS. Jika pertanyaan sederhana, santai, basa-basi, atau sapaan biasa, balas dengan SANGAT SINGKAT dan PADAT (cukup 1-2 paragraf pendek). JANGAN bertele-tele. Namun, JIKA pertanyaan kompleks (minta penjelasan materi, bedah karya), berikan penjelasan yang komprehensif dan detail.
3. Gunakan [REFERENSI PENGKAYAAN] di bawah ini sebagai pedoman utama jika relevan dengan pertanyaan.
4. JANGAN memakai markdown bintang ganda (**teks**). Gunakan maksimal 2 emoji per pesan.
5. Jangan pernah menyebutkan nama perusahaan AI atau model pembuatmu. Kamu murni "AksaBot".

[REFERENSI PENGKAYAAN]:
${knowledgeContext || 'Tidak ada data spesifik. Jawablah secara natural berdasarkan pengetahuan umum seputar Cendekia Aksara, literasi, dan kepenulisan.'}`;

        const formattedMessages = [
            { role: 'system', content: systemPrompt }
        ];

        // Histori maksimal 4 chat terakhir agar API tidak berat
        if (history && Array.isArray(history)) {
            const recentHistory = history.slice(-4);
            recentHistory.forEach(h => {
                formattedMessages.push({
                    role: h.role === 'user' ? 'user' : 'assistant',
                    content: h.content
                });
            });
        }

        // Masukkan pesan baru
        formattedMessages.push({ role: 'user', content: message });

        let textResponse = "";
        let modelUsed = "";
        let lastError = null;

        // Loop Fallback Model Groq (Anti-Mogok)
        for (const model of GROQ_MODELS) {
            try {
                const completion = await groq.chat.completions.create({
                    model: model,
                    messages: formattedMessages,
                    temperature: 0.7,
                    max_tokens: 1024
                });

                textResponse = completion.choices[0]?.message?.content || "";
                if (textResponse.trim()) {
                    modelUsed = model;
                    break; // Berhenti kalau sukses dapet jawaban
                }
            } catch (err) {
                console.warn(`[AksaBot] Gagal menggunakan model Groq ${model}:`, err.message);
                lastError = err;
            }
        }

        if (!textResponse && lastError) {
            throw new Error(`Semua model Groq sedang sibuk. Detail: ${lastError.message}`);
        }

        // Bersihkan hasil (jika AI bandel ngasih bintang atau code block)
        let finalAnswer = textResponse.replace(/```[\w]*\n?/g, '').replace(/\*\*/g, '').trim();

        return res.status(200).json({
            reply: finalAnswer,
            model: modelUsed, // Buat ngecek di console model mana yang kepake
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[AksaBot] Fatal error:', error?.message || error);
        return res.status(500).json({
            error: true,
            reply: 'Waduh, AksaBot lagi pusing nih (Server Groq Penuh). Coba sapa aku lagi beberapa detik lagi ya! 🙏'
        });
    }
}
