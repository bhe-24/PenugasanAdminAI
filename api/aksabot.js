import OpenAI from 'openai';

// Inisialisasi OpenRouter API (Fallback Anti-Mati)
const openrouter = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
        'HTTP-Referer': 'https://edu-cendekia.my.id',
        'X-Title': 'Cendekia Aksara Bot'
    }
});

// Daftar Model Gratis AksaBot (Pilih yang cepat untuk chat)
const FREE_MODELS = [
    'google/gemini-2.0-flash-exp:free',          // Super cepat untuk chat
    'meta-llama/llama-3.3-70b-instruct:free',   // Sangat cerdas
    'deepseek/deepseek-chat:free',              // Logika bagus
    'nvidia/nemotron-3.5-lightning:free'        // Cepat & ringan
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

        // Susun System Prompt
        const systemPrompt = `Kamu adalah AksaBot, asisten virtual resmi komunitas Cendekia Aksara. Sikapmu ramah, antusias, dan helpful layaknya seorang teman belajar.

IDENTITAS PENGGUNA YANG MENYAPA: ${userName || 'Teman'}

ATURAN WAJIB (HARUS DIIKUTI 100%):
1. Berikan jawaban yang LENGKAP dan DETAIL.
2. Gunakan [REFERENSI PENGKAYAAN] di bawah ini sebagai pedoman utama jika relevan.
3. JANGAN memakai markdown bintang ganda (**teks**). 
4. Gunakan maksimal 2 emoji per pesan.
5. Jika pengguna hanya menyapa (misal: "hai"), sapa balik dengan ramah, sebut namanya, dan tawarkan bantuan.

[REFERENSI PENGKAYAAN]:
${knowledgeContext || 'Jawablah berdasarkan pengetahuan umum seputar Cendekia Aksara, literasi, dan kepenulisan.'}`;

        const formattedMessages = [
            { role: 'system', content: systemPrompt }
        ];

        // Masukkan histori maksimal 4 chat terakhir
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

        // Loop Fallback Model
        for (const model of FREE_MODELS) {
            try {
                const completion = await openrouter.chat.completions.create({
                    model: model,
                    messages: formattedMessages,
                    temperature: 0.7,
                    max_tokens: 1024
                });

                textResponse = completion.choices[0]?.message?.content || "";
                if (textResponse.trim()) {
                    modelUsed = model;
                    break;
                }
            } catch (err) {
                console.warn(`[AksaBot] Gagal model ${model}:`, err.message);
                lastError = err;
            }
        }

        if (!textResponse && lastError) {
            throw new Error(`Semua model AI sibuk. ${lastError.message}`);
        }

        // Bersihkan hasil
        let finalAnswer = textResponse.replace(/```[\w]*\n?/g, '').trim();

        return res.status(200).json({
            reply: finalAnswer,
            model: modelUsed,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[AksaBot] Fatal error:', error?.message || error);
        return res.status(500).json({
            error: true,
            reply: 'Waduh, AksaBot lagi pusing nih (Server Penuh). Coba sapa aku lagi beberapa menit lagi ya! 🙏'
        });
    }
}
