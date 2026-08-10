import OpenAI from 'openai';

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const groq = GROQ_API_KEY ? new OpenAI({
    apiKey: GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1'
}) : null;

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    if (!groq) return res.status(500).json({ error: 'Server belum dikonfigurasi.' });

    try {
        const { text, title, instruction } = req.body;

        if (!text || text.trim() === '') {
            return res.status(400).json({ error: 'Teks artikel tidak boleh kosong.' });
        }

        const customInstruction = instruction && instruction.trim() !== '' 
            ? `INSTRUKSI KHUSUS DARI REDAKTUR UTAMA:\n"${instruction}"\nPastikan Anda mengubah, memperpanjang, atau menyesuaikan naskah secara kreatif SESUAI DENGAN instruksi khusus ini!`
            : `INSTRUKSI UMUM (AUTO-PROOFREADING):\nRapikan ejaan, perbaiki typo, tambahkan spasi/enter yang hilang agar menjadi paragraf yang nyaman dibaca, dan perbaiki tanda baca (sesuai PUEBI). JANGAN MENGUBAH ALUR ATAU MAKNA ASLI CERITA SAMA SEKALI.`;

        const promptText = `Peranmu: Editor Senior dan Proofreader untuk Mading Sekolah Cendekia Aksara.
Tugas Pokok: Sunting atau ubah draf naskah berikut sesuai dengan instruksi yang diberikan.

Data Naskah:
- Judul: ${title || 'Tanpa Judul'}

${customInstruction}

TEKS ARTIKEL/NASKAH DARI SISWA:
"""
${text}
"""

ATURAN KETAT (WAJIB DIPATUHI):
1. WAJIB keluarkan dalam format HTML dasar. Gunakan tag <p> untuk setiap paragraf.
2. JANGAN PERNAH MEMBERIKAN KOMENTAR ATAU BASA-BASI (seperti "Ini dia hasilnya" atau "Saya telah memperbaiki ejaannya").
3. Langsung keluarkan MURNI teks hasil suntinganmu. TITIK.`;

        const completion = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: "user", content: promptText }],
            temperature: instruction ? 0.7 : 0.1, // 0.1 agar AI kaku dan fokus merapikan ejaan saja tanpa berimajinasi
        });
        
        let textResponse = completion.choices[0]?.message?.content || "";
        textResponse = textResponse.replace(/```html\n?/gi, '').replace(/```\n?/g, '').trim();

        res.status(200).json({ result: textResponse });

    } catch (error) {
        console.error("AI Edit Error:", error);
        res.status(500).json({ error: "Gagal memproses teks. Sistem AI sedang sibuk." });
    }
}
