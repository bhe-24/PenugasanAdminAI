import OpenAI from 'openai';

// Inisialisasi Groq API
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const groq = GROQ_API_KEY ? new OpenAI({
    apiKey: GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1'
}) : null;

export default async function handler(req, res) {
    // ATUR CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    if (!groq) return res.status(500).json({ error: 'Server belum dikonfigurasi (GROQ API KEY kosong).' });

    try {
        const { judul_event, info_mentah } = req.body;

        if (!info_mentah || info_mentah.trim() === '') {
            return res.status(400).json({ error: 'Informasi mentah tidak boleh kosong.' });
        }

        // PROMPT KHUSUS MIXTRAL (EVENT MANAGER)
        const promptText = `Kamu adalah Event Manager dan Editor profesional Cendekia Aksara.
Tugasmu: Kembangkan informasi mentah dari sebuah kegiatan/event menjadi Buku Panduan (Guidebook) yang sangat detail, profesional, dan komprehensif.

Nama Event: ${judul_event}
Informasi Mentah dari Panitia:
"""
${info_mentah}
"""

ATURAN PENGEMBANGAN:
1. Jika infonya sangat singkat, KAMU WAJIB MENGEMBANGKANNYA secara logis. Tambahkan narasi Latar Belakang yang bagus, Tujuan Kegiatan, Rincian Persyaratan, dan Tata Tertib yang relevan dengan event literasi/pendidikan.
2. Pecah informasi tersebut menjadi 4 sampai 6 Bab/Poin Utama.
3. Tiap Bab harus berisi teks penjelasan yang cukup panjang (1-2 paragraf padat).
4. OUTPUT WAJIB 100% JSON ARRAY MURNI! Tidak boleh ada teks pengantar atau penutup.

FORMAT JSON YANG DIWAJIBKAN:
[
  { "bab": "1. Pendahuluan & Latar Belakang", "isi": "Teks panjang pendahuluan..." },
  { "bab": "2. Syarat & Ketentuan", "isi": "Teks panjang syarat..." }
]`;

        // Menggunakan MIXTRAL untuk daya ingat & pemrosesan teks panjang
        const completion = await groq.chat.completions.create({
            model: 'mixtral-8x7b-32768',
            messages: [{ role: "user", content: promptText }],
            temperature: 0.4, // Cukup kreatif tapi tetap patuh pada format JSON
        });
        
        let textResponse = completion.choices[0]?.message?.content || "";
        
        // Pembersihan karakter markdown markdown JSON
        textResponse = textResponse.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();

        // Validasi JSON
        let parsedData;
        try {
            parsedData = JSON.parse(textResponse);
        } catch (parseError) {
            console.error("Gagal parse JSON:", textResponse);
            return res.status(500).json({ error: "AI gagal menghasilkan format data yang tepat. Coba lagi." });
        }

        res.status(200).json({ hasil: parsedData });

    } catch (error) {
        console.error("AI Error:", error);
        res.status(500).json({ error: "Gagal membuat buku panduan dengan AI. Coba lagi nanti." });
    }
}
