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
            // DIKEMBALIKAN KE PROMPT ASLI YANG SANGAT KETAT UNTUK PARSING SISTEM
            promptText = `Anda adalah seorang guru ahli pembuat soal ujian tingkat nasional.
Tugas Anda adalah membuat ${jumlah} soal Pilihan Ganda (A, B, C, D) yang berkualitas berdasarkan materi referensi yang diberikan.

MATERI REFERENSI (Hanya untuk Anda pelajari, siswa TIDAK akan melihat teks ini):
"""
${safeMateri}
"""

ATURAN SANGAT KETAT (WAJIB DIPATUHI - JIKA MELANGGAR SOAL AKAN DITOLAK):
1. Soal harus bersifat MANDIRI (self-contained).
2. DILARANG KERAS menggunakan frasa yang merujuk pada teks gaib, seperti "Berdasarkan wacana di atas...", "Menurut teks tersebut...", "Cermati teks di bawah", dll.
3. JIKA Anda ingin menguji pemahaman membaca/studi kasus, Anda WAJIB MENULISKAN KEMBALI penggalan cerita/kasus tersebut ke dalam teks pertanyaan secara utuh.
4. Tulis pertanyaan di baris pertama tanpa menggunakan nomor (Jangan tulis "1.", "2.", dll).
5. Baris berikutnya adalah pilihan jawaban persis dengan huruf (A. B. C. D.).
6. Berikan tanda bintang (*) TEPAT di depan huruf pilihan jawaban yang BENAR.
7. Pisahkan setiap soal dengan Satu Baris Kosong (Enter 2x).
8. DILARANG memberikan kata pengantar, basa-basi, penjelasan jawaban, atau teks penutup apa pun. Keluarkan HANYA teks soal murni!

CONTOH OUTPUT YANG DIHARAPKAN:
Ibu kota negara Republik Indonesia adalah?
A. Bandung
*B. Jakarta
C. Surabaya
D. Medan

Andi menemukan sebuah dompet di jalan, lalu ia membawanya ke kantor polisi terdekat untuk dikembalikan. Tindakan yang dilakukan Andi mencerminkan penerapan nilai Pancasila sila ke?
A. Pertama
*B. Kedua
C. Ketiga
D. Keempat`;
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
            temperature: tipe_soal === 'kuis' ? 0.1 : 0.3, // Kuis suhunya rendah biar kaku & akurat, Tugas suhunya lebih tinggi biar kreatif
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
