import OpenAI from 'openai';

// Inisialisasi Groq API
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const groq = GROQ_API_KEY ? new OpenAI({
    apiKey: GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1'
}) : null;

export default async function handler(req, res) {
    // 1. ATUR CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    if (!groq) return res.status(500).json({ error: 'Server belum dikonfigurasi (GROQ API KEY kosong).' });

    try {
        const { materi, jumlahSoal, tipe_soal } = req.body;

        if (!materi || materi.trim() === '') {
            return res.status(400).json({ error: 'Materi tidak boleh kosong' });
        }

        const jumlah = jumlahSoal || 5;

        // SABUK PENGAMAN TOKEN: Potong teks jika PDF terlalu panjang
        const safeMateri = materi.length > 20000 ? materi.substring(0, 20000) + "... [DIPOTONG]" : materi;

        let promptText = "";

        // -------------------------------------------------------------
        // LOGIKA PERCABANGAN (KUIS PILGAN VS TUGAS ESAI)
        // -------------------------------------------------------------
        if (tipe_soal === 'kuis') {
            promptText = `Anda adalah guru pembuat soal. Buat ${jumlah} soal Pilihan Ganda (A, B, C, D) dari materi referensi berikut.
MATERI REFERENSI: """${safeMateri}"""

ATURAN SANGAT KETAT:
1. Tulis pertanyaan di baris pertama.
2. Baris berikutnya adalah pilihan jawaban (A. B. C. D.).
3. Berikan tanda bintang (*) TEPAT di depan huruf pilihan jawaban yang BENAR.
4. Pisahkan setiap soal dengan Satu Baris Kosong (Enter 2x).
5. JANGAN berikan teks pengantar, penutup, atau blok kode. Keluarkan HANYA teks soal murni!`;
        } 
        else if (tipe_soal === 'tugas') {
            promptText = `Anda adalah dosen pembuat soal. Buat ${jumlah} soal TUGAS / ESAI ANALITIS (HOTS) tingkat lanjut berdasarkan materi referensi berikut.
MATERI REFERENSI: """${safeMateri}"""

ATURAN SANGAT KETAT:
1. Soal harus memancing daya nalar, analisis, dan studi kasus dari materi tersebut.
2. JANGAN berikan kunci jawaban. Hanya intruksi dan soal tugasnya saja.
3. OUTPUT WAJIB BERFORMAT HTML DASAR! Gunakan tag <p> untuk paragraf, <ol> dan <li> untuk daftar soal, dan <strong> untuk menebalkan kata penting.
4. JANGAN bungkus respons Anda dengan format blok kode markdown. Keluarkan tag HTML murninya saja secara langsung!`;
        } 
        else {
            return res.status(400).json({ error: 'Tipe soal tidak valid.' });
        }

        // Panggil Groq Llama 3.3 70B (Karena bikin soal butuh logika tinggi)
        const completion = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: "user", content: promptText }],
            temperature: 0.2, // Sengaja direndahkan agar output konsisten
        });
        
        let textResponse = completion.choices[0]?.message?.content || "";
        
        // Pembersihan karakter markdown jika AI membandel
        textResponse = textResponse.replace(/```[a-zA-Z]*\n/gi, '').replace(/```/g, '').trim();

        // 5. KIRIM HASIL KE FRONTEND
        res.status(200).json({ result: textResponse });

    } catch (error) {
        console.error("AI Error:", error);
        res.status(500).json({ error: "Gagal membuat soal dengan AI. Coba lagi nanti." });
    }
}
