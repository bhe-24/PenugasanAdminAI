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
        // LOGIKA PERCABANGAN (KUIS PILGAN VS TUGAS ESAI PRAKTIK)
        // -------------------------------------------------------------
        if (tipe_soal === 'kuis') {
            promptText = `Kamu adalah guru pembuat soal. Buat ${jumlah} soal Pilihan Ganda (A, B, C, D) dari materi referensi berikut.
MATERI REFERENSI: """${safeMateri}"""

ATURAN SANGAT KETAT:
1. Tulis pertanyaan di baris pertama.
2. Baris berikutnya adalah pilihan jawaban (A. B. C. D.).
3. Berikan tanda bintang (*) TEPAT di depan huruf pilihan jawaban yang BENAR.
4. Pisahkan setiap soal dengan Satu Baris Kosong (Enter 2x).
5. JANGAN berikan teks pengantar, penutup, atau blok kode. Keluarkan HANYA teks soal murni!`;
        } 
        else if (tipe_soal === 'tugas') {
            promptText = `Kamu adalah Mentor Menulis yang asyik dan kreatif. Buatkan ${jumlah} soal TUGAS PRAKTIK MENULIS untuk anak SMP dan SMA berdasarkan materi referensi berikut.
MATERI REFERENSI: """${safeMateri}"""

ATURAN SANGAT KETAT:
1. Gunakan gaya bahasa yang santai, memotivasi, dan mudah dipahami. Gunakan sapaan "Kamu". DILARANG KERAS menggunakan kata "Anda", "Saya", atau bahasa kaku ala buku diktat.
2. Soal TIDAK BOLEH sekadar hafalan teori (misal jangan buat soal "Apa pengertian dari plot?").
3. Soal WAJIB berupa INSTRUKSI PRAKTIK yang merangsang imajinasi sesuai materi. 
   - Contoh: Jika materi membahas teknik "Bagaimana Jika (What If)", minta siswa membuat 3 ide "Bagaimana Jika" versi mereka sendiri yang paling liar, lalu kembangkan salah satunya menjadi 1 premis cerita utuh.
   - Contoh lain: Jika materi tentang penokohan, suruh mereka membuat satu profil karakter lengkap dengan kelemahan dan ketakutannya.
4. JANGAN berikan kunci jawaban. Cukup berikan instruksi/langkah pengerjaan tugas yang seru untuk siswa.
5. OUTPUT WAJIB BERFORMAT HTML DASAR! Gunakan tag <p> untuk paragraf pengantar/instruksi, <ol> dan <li> untuk memecah langkah-langkah tugas agar mudah dibaca, dan <strong> untuk menebalkan intruksi penting.
6. JANGAN bungkus respons dengan format blok kode markdown (seperti \`\`\`html). Keluarkan tag HTML murninya saja secara langsung!`;
        } 
        else {
            return res.status(400).json({ error: 'Tipe soal tidak valid.' });
        }

        // Panggil Groq Llama 3.3 70B
        const completion = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: "user", content: promptText }],
            temperature: 0.3, // Dinaikkan sedikit jadi 0.3 agar instruksi tugasnya lebih luwes dan kreatif
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
