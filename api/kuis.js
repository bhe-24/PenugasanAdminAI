import { GoogleGenerativeAI } from '@google/generative-ai';

// Inisialisasi Gemini AI
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
        const { materi, jumlahSoal } = req.body;

        if (!materi || materi.trim() === '') {
            return res.status(400).json({ error: 'Materi tidak boleh kosong' });
        }

        const jumlah = jumlahSoal || 5; // Default 5 soal

        // 2. SUSUN PROMPT UNTUK GENERATOR KUIS (DIPERBAIKI)
        const promptText = `
Anda adalah seorang guru ahli pembuat soal ujian tingkat nasional.
Tugas Anda adalah membuat ${jumlah} soal Pilihan Ganda (A, B, C, D) yang berkualitas berdasarkan materi referensi yang diberikan.

MATERI REFERENSI (Hanya untuk Anda pelajari, siswa TIDAK akan melihat teks ini):
"""
${materi}
"""

ATURAN SANGAT KETAT (WAJIB DIPATUHI - JIKA MELANGGAR SOAL AKAN DITOLAK):
1. Soal harus bersifat MANDIRI (self-contained).
2. DILARANG KERAS menggunakan frasa yang merujuk pada teks gaib, seperti "Berdasarkan wacana di atas...", "Menurut teks tersebut...", "Cermati teks di bawah", dll.
3. JIKA Anda ingin menguji pemahaman membaca/studi kasus, Anda WAJIB MENULISKAN KEMBALI penggalan cerita/kasus tersebut ke dalam teks pertanyaan secara utuh.
4. Tulis pertanyaan di baris pertama tanpa menggunakan nomor (Jangan tulis "1.", "2.", dll).
5. Baris berikutnya adalah pilihan jawaban persis dengan huruf (A. B. C. D.).
6. Berikan tanda bintang (*) TEPAT di depan huruf pilihan jawaban yang BENAR.
7. Pisahkan setiap soal dengan Satu Baris Kosong (Enter 2x).
8. DILARANG memberikan kata pengantar, basa-basi, penjelasan jawaban, atau teks penutup apa pun. Keluarkan hanya teks soal saja.

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
D. Keempat
`;

        // 3. PANGGIL GEMINI AI
        // Menggunakan model yang diatur di env atau flash yang cepat
        const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" }); // Bisa disesuaikan dengan versi modelmu
        
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: promptText }] }],
            generationConfig: { 
                temperature: 0.2, // Sengaja di-set sangat rendah agar AI fokus mematuhi instruksi format dan tidak berhalusinasi
                topP: 0.8
            } 
        });
        
        let textResponse = result.response.text();
        
        // 4. PEMBERSIHAN STRING (CLEANUP)
        // Membersihkan markdown formatting (```text atau ```) jika AI membandel
        textResponse = textResponse.replace(/```[a-zA-Z]*\n/gi, '').replace(/```/g, '').trim();

        // Menghapus baris yang mungkin berisi "Berikut adalah soalnya:" dll
        const lines = textResponse.split('\n');
        const cleanLines = lines.filter(line => {
            const lower = line.toLowerCase();
            return !lower.includes('berikut adalah') && 
                   !lower.includes('ini adalah soal') &&
                   !lower.includes('selamat mengerjakan');
        });
        
        textResponse = cleanLines.join('\n').trim();

        // 5. KIRIM HASIL KE FRONTEND
        res.status(200).json({ result: textResponse });

    } catch (error) {
        console.error("AI Error (Kuis Generator):", error);
        res.status(500).json({ error: "Gagal membuat soal dengan AI. Coba lagi nanti." });
    }
}
