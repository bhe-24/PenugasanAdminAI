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
1. WAJIB menggunakan cetak tebal Markdown (**teks**) untuk menegaskan poin atau kalimat penting.
2. WAJIB MENGGUNAKAN TABEL untuk bagian Timeline/Jadwal. (Gunakan format Markdown | Tanggal | Kegiatan |).
3. WAJIB MENGGUNAKAN POIN/LIST untuk bagian Syarat, Ketentuan, Kriteria. Gunakan awalan "a. ", "b. " atau "- ".
4. SUPER PENTING: Berikan JARAK 1 BARIS KOSONG (ENTER 2 KALI / "\\n\\n") sebelum dan sesudah membuat Tabel atau List Poin agar tidak menempel dengan paragraf sebelumnya!
5. OUTPUT WAJIB 100% JSON ARRAY MURNI!

FORMAT JSON YANG DIWAJIBKAN:
[
  { "bab": "1. Pendahuluan", "isi": "Teks paragraf pertama...\\n\\nTeks paragraf kedua..." },
  { "bab": "2. Syarat & Ketentuan", "isi": "Berikut adalah syaratnya:\\n\\na. Syarat pertama\\nb. Syarat kedua" },
  { "bab": "3. Timeline", "isi": "Jadwal acara:\\n\\n| Tanggal | Kegiatan |\\n|---|---|\\n| 10 Ags | Daftar |" }
]`;

        const completion = await groq.chat.completions.create({
            model: 'openai/gpt-oss-120b',
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
