import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Urutan fallback: coba dari atas, kalau error lanjut ke bawah
const MODEL_CHAIN = [
    "gemini-2.5-flash",
    "gemini-3-flash",
    "gemma-3-27b-it",   // Gemma 4 26B (nama model di API Google)
    "gemma-3-12b-it",   // Gemma 4 12B sebagai safety net terakhir
];

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

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { message, knowledgeContext, userName, history } = req.body;
        if (!message) return res.status(400).json({ error: 'Pesan kosong' });

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

                return res.status(200).json({ reply: text, model: modelName });

            } catch (err) {
                console.warn(`Model ${modelName} gagal:`, err.message);
                lastError = err;
                // Lanjut ke model berikutnya
            }
        }

        // Semua model gagal
        console.error("Semua model gagal:", lastError);
        return res.status(500).json({
            reply: "Aduh, semua sistem lagi sibuk nih 💤. Coba lagi sebentar ya!"
        });

    } catch (error) {
        console.error("AksaBot handler error:", error);
        return res.status(500).json({
            reply: "Terjadi kesalahan tak terduga. Coba lagi ya! 🙏"
        });
    }
}
