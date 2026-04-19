import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
    // 1. ATUR CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { text, title, category } = req.body;

        if (!text || text.trim() === '') {
            return res.status(400).json({ error: 'Teks artikel tidak boleh kosong.' });
        }

        // 2. PROMPT UNTUK AI SEBAGAI PROOFREADER (EDITOR)
        const promptText = `
Peranmu: Seorang Proofreader dan Copy Editor profesional untuk Mading Sekolah.

Tugas: Rapikan dan sunting artikel HTML berikut agar tata bahasanya lebih baik, ejaan sesuai PUEBI, paragraf terstruktur rapi, dan bahasanya mengalir.

Data Tambahan:
- Judul: ${title}
- Kategori: ${category}

TEKS ARTIKEL (FORMAT HTML):
"""
${text}
"""

ATURAN KETAT (WAJIB DIPATUHI):
1. JANGAN PERNAH MENGUBAH GAYA BAHASA ASLINYA. Jika tulisan siswa bergaya santai, biarkan santai. Jika formal, biarkan formal. Kamu hanya memperbaiki penempatan tanda baca, huruf kapital, dan salah ketik (typo).
2. PERTAHANKAN FORMAT HTML ASLINYA. Jika siswa menggunakan tag <b>, <i>, <ul>, <ol>, <li>, atau <p>, PASTIKAN TAG TERSEBUT TETAP ADA DAN TIDAK RUSAK.
3. JANGAN MEMBERIKAN KOMENTAR APA PUN (seperti "Berikut adalah hasilnya" atau "Ini dia revisinya").
4. Langsung keluarkan hasil teks HTML yang sudah dirapikan saja.
`;

        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash", // Menggunakan engine Gemini 1.5 Flash
            generationConfig: { 
                temperature: 0.2, // Temperature rendah agar AI tidak merombak cerita, hanya memoles.
                maxOutputTokens: 3000
            }
        });

        const result = await model.generateContent(promptText);
        let textResponse = result.response.text();

        // Bersihkan pembungkus Markdown HTML jika AI memberikannya
        textResponse = textResponse.replace(/```html/gi, '').replace(/```/g, '').trim();

        // 3. KIRIM HASIL KE FRONTEND
        res.status(200).json({ result: textResponse });

    } catch (error) {
        console.error("AI Edit Error:", error);
        res.status(500).json({ error: "Gagal merapikan teks. Sistem sedang sibuk." });
    }
}
