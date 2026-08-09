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
        const { judul_event, info_mentah } = req.body;
        if (!info_mentah || info_mentah.trim() === '') return res.status(400).json({ error: 'Informasi mentah tidak boleh kosong.' });

        const promptText = `Kamu adalah Event Manager dan Desainer Buku Panduan profesional Cendekia Aksara.
Tugasmu: Kembangkan informasi mentah berikut menjadi Buku Panduan (Guidebook) yang sangat detail, terstruktur, dan tidak membosankan.

Nama Event: ${judul_event}
Informasi Mentah:
"""
${info_mentah}
"""

ATURAN PENGEMBANGAN (WAJIB DIIKUTI 100%):
1. KAMU WAJIB mengembangkan informasi singkat menjadi narasi yang komprehensif, logis, dan menarik.
2. WAJIB MENGGUNAKAN TABEL: Jika ada informasi tentang Timeline, Jadwal, atau Waktu Kegiatan, kamu WAJIB membuatnya dalam format Tabel Markdown. Contoh:
| Tanggal | Kegiatan / Tahapan |
| --- | --- |
| 12 Agustus 2026 | Pendaftaran Dibuka |
3. WAJIB MENGGUNAKAN POIN: Untuk bagian Syarat, Ketentuan, Penilaian, dan Tata Tertib, WAJIB gunakan list (gunakan awalan "a. ", "b. ", "c. " atau "- ").
4. Pecah buku menjadi 4 atau 5 Bab Utama.
5. OUTPUT WAJIB 100% JSON ARRAY MURNI! Tanpa basa-basi.

FORMAT JSON YANG DIWAJIBKAN:
[
  { "bab": "1. Pendahuluan & Latar Belakang", "isi": "Teks panjang paragraf..." },
  { "bab": "2. Timeline Kegiatan", "isi": "Teks pengantar.\\n\\n| Tanggal | Kegiatan |\\n|---|---|\\n| 10 Ags | Daftar |" },
  { "bab": "3. Syarat & Ketentuan", "isi": "Berikut syaratnya:\\na. Syarat pertama\\nb. Syarat kedua" }
]`;

        const completion = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: "user", content: promptText }],
            temperature: 0.3, 
        });
        
        let textResponse = completion.choices[0]?.message?.content || "";
        textResponse = textResponse.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();

        let parsedData = JSON.parse(textResponse);
        res.status(200).json({ hasil: parsedData });

    } catch (error) {
        console.error("AI Error:", error);
        res.status(500).json({ error: "Gagal membuat buku panduan dengan AI. Coba lagi nanti." });
    }
}
