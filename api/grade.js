import { GoogleGenerativeAI } from '@google/generative-ai';

// Inisialisasi Gemini API menggunakan key dari Environment Variable Vercel
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
    // 1. ATUR CORS (Agar web HTML kamu bisa nembak ke API ini tanpa diblokir)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); // Bisa diganti domain web kamu
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    // Jika request OPTIONS (Preflight dari browser), langsung return OK
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Pastikan method-nya POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { instruction, rubric, answer } = req.body;

        if (!answer) {
            return res.status(400).json({ error: 'Jawaban siswa kosong' });
        }

        // 2. SUSUN PROMPT UNTUK AI (Berperan sebagai Guru Sastra)
        const prompt = `
Anda adalah seorang Guru Penulisan Kreatif dan Editor Fiksi yang sangat teliti, objektif, dan suportif.
Tugas Anda adalah menilai karya tulisan siswa berdasarkan instruksi dan rubrik berikut.

INSTRUKSI TUGAS:
"${instruction || 'Buatlah karya tulisan fiksi/esai yang baik dan benar sesuai kaidah.'}"

RUBRIK & UNSUR PENILAIAN:
"${rubric || 'Nilai rentang 0-100 dengan mempertimbangkan 4 unsur utama: 
1. Gagasan/Premis: Kejelasan ide dan orisinalitas.
2. Struktur & Logika Narasi: Alur cerita, pacing (tempo), dan konsistensi POV.
3. Estetika & Karakter: Penggunaan panca indera (Show, Don\'t Tell) dan kehidupanan karakter.
4. Teknis & PUEBI: Tata bahasa, efektivitas kalimat, tanda baca, dan aturan dialog tag.'}"

JAWABAN/KARYA SISWA:
"${answer}"

TUGAS ANDA:
1. Berikan nilai akhir berupa angka bulat dari 0 hingga 100.
2. Berikan feedback/catatan evaluasi yang komprehensif (wajib 3 paragraf) dengan struktur berikut:
   - Paragraf 1 (Apresiasi & Kekuatan Karya): Sebutkan apa yang sudah berhasil dilakukan siswa dengan baik (misal: ide yang unik, deskripsi yang hidup, atau dialog yang natural).
   - Paragraf 2 (Evaluasi Terfokus & Koreksi Teknis): Berikan kritik membangun terkait kelemahan karya (misal: kesalahan PUEBI, logika alur yang melompat, atau kalimat pemborosan). Berikan masukan spesifik.
   - Paragraf 3 (Saran Tindakan & Motivasi): Berikan arahan jelas apa yang harus direvisi selanjutnya dan tutup dengan kalimat penyemangat. Bertindaklah layaknya mentor manusia yang peduli (jangan sebut diri Anda AI atau Sistem).

PENTING:
Kembalikan respon Anda HANYA DALAM FORMAT JSON murni (tanpa awalan ```json dan akhiran ```), tanpa teks pengantar atau penutup apa pun. Struktur JSON harus persis seperti contoh berikut:
{
  "score": 85,
  "feedback": "[Paragraf 1: Apresiasi]\n\n[Paragraf 2: Evaluasi]\n\n[Paragraf 3: Motivasi]"
}

        // 3. PANGGIL GEMINI AI
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent(prompt);
        let textResponse = result.response.text();

        // 4. BERSIHKAN TEKS (Mencegah AI menambahkan markdown ```json)
        textResponse = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();

        // Parse ke bentuk JSON
        const finalResult = JSON.parse(textResponse);

        // Kirim hasil ke Frontend HTML kamu
        res.status(200).json({
            score: finalResult.score,
            feedback: finalResult.feedback
        });

    } catch (error) {
        console.error("AI Error:", error);
        res.status(500).json({ 
            score: 0, 
            feedback: "Mohon maaf, terjadi gangguan pada sistem saat meninjau karya Anda. Admin akan meninjau karya ini secara manual." 
        });
    }
}
