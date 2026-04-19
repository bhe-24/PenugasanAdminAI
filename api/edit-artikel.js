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
        // Menerima parameter tambahan "instruction" dari frontend Admin
        const { text, title, category, instruction } = req.body;

        if (!text || text.trim() === '') {
            return res.status(400).json({ error: 'Teks artikel tidak boleh kosong.' });
        }

        // Susun instruksi dinamis: Jika ada instruksi khusus dari Admin, gunakan itu. 
        // Jika tidak ada, gunakan instruksi standar (merapikan ejaan).
        const customInstruction = instruction && instruction.trim() !== '' 
            ? `INSTRUKSI KHUSUS DARI REDAKTUR UTAMA:\n"${instruction}"\nPastikan Anda mengubah, memperpanjang, atau menyesuaikan naskah secara kreatif SESUAI DENGAN instruksi khusus ini!`
            : `INSTRUKSI UMUM:\nRapikan ejaan, tanda baca (sesuai PUEBI), dan susunan paragraf agar bahasanya lebih mengalir tanpa mengubah alur atau makna asli cerita.`;

        // 2. PROMPT UNTUK AI SEBAGAI KEPALA REDAKSI
        const promptText = `
Peranmu: Seorang Editor Senior, Penulis Berbakat, dan Proofreader untuk Mading Sekolah Cendekia Aksara.

Tugas Pokok: Sunting atau ubah draf naskah berikut sesuai dengan instruksi yang diberikan.

Data Naskah:
- Judul: ${title}
- Kategori: ${category}

${customInstruction}

TEKS ARTIKEL/NASKAH DARI SISWA (FORMAT HTML):
"""
${text}
"""

ATURAN KETAT (WAJIB DIPATUHI):
1. PERTAHANKAN ATAU GUNAKAN FORMAT HTML. Jangan kembalikan teks biasa. Gunakan tag <p> untuk paragraf, <b> untuk tebal, atau <i> untuk miring agar rapi saat dibaca di website.
2. JANGAN PERNAH MEMBERIKAN KOMENTAR, BASA-BASI, ATAU PENJELASAN (seperti "Berikut adalah hasilnya", "Saya telah menambahkan paragraf", atau "Ini dia revisinya").
3. Langsung keluarkan hasil teks HTML cerita/artikel yang sudah dirapikan atau diperpanjang. TITIK.
`;

        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash", 
            generationConfig: { 
                temperature: instruction ? 0.7 : 0.2, // Jika ada instruksi khusus, biarkan AI lebih kreatif (0.7). Jika hanya merapikan, buat kaku (0.2).
                maxOutputTokens: 5000 // Diperbesar agar muat cerita yang diperpanjang
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
        res.status(500).json({ error: "Gagal memproses teks. Sistem AI sedang sibuk." });
    }
}
