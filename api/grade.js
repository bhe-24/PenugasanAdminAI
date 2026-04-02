import { GoogleGenerativeAI } from '@google/generative-ai';

// Inisialisasi Gemini API menggunakan key dari Environment Variable Vercel
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
    // 1. ATUR CORS (Agar web HTML kamu bisa nembak ke API ini tanpa diblokir)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); 
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
        // PERBAIKAN: Menambahkan tangkapan 'studentName' dari body
        const { instruction, rubric, answer, studentName } = req.body;

        if (!answer) {
            return res.status(400).json({ error: 'Jawaban siswa kosong' });
        }

        // 2. SUSUN PROMPT UNTUK AI (Berperan sebagai Mentor Menulis / Editor yang asyik)
        const prompt = `
Anda adalah seorang Mentor Penulisan Kreatif dan Editor Fiksi yang ramah, asyik, objektif, dan suportif.
Tugas Anda adalah mengoreksi karya siswa dengan gaya bahasa yang ringan, kasual, dan mudah dipahami (menggunakan sapaan aku-kamu).

NAMA SISWA: "${studentName || 'Teman-teman'}"

INSTRUKSI TUGAS:
"${instruction || 'Buatlah karya tulisan fiksi/esai yang baik dan benar sesuai kaidah.'}"

RUBRIK & UNSUR PENILAIAN:
"${rubric || 'Nilai rentang 0-100 dengan mempertimbangkan: Gagasan, Struktur, Tanda Baca, Diksi, Typo, dan Gaya Penulisan.'}"

JAWABAN/KARYA SISWA:
"${answer}"

TUGAS ANDA:
1. Berikan nilai akhir berupa angka bulat dari 0 hingga 100.
2. Berikan feedback/ulasan yang komprehensif, rinci, dan terstruktur dengan alur berikut:
   - Sapaan & Apresiasi: Sapa nama siswa (contoh: "Halo [Nama Siswa]!", puji kelebihan karyanya secara spesifik (ide, deskripsi, atau emosi yang tersampaikan).
   - Analisis Gaya Bahasa & Struktur: Jelaskan arah gaya penulisan ini (apakah formal, semi-formal, atau kasual) dan nilai apakah konsistensinya sudah terjaga.
   - Temuan & Koreksi Detail: Berikan kritik spesifik. Kutip kalimat/paragraf dari karya siswa yang dirasa kurang pas (karena typo, PUEBI salah, dialog tag berantakan, atau kalimat tidak efektif).
   - Contoh Perbaikan: Susun ulang dan berikan contoh dari kutipan yang salah tadi menjadi kalimat yang baik, benar, dan lebih enak dibaca sesuai standar penulisan.
   - Penutup & Motivasi: Berikan arahan apa yang harus dilatih lagi ke depannya, tutup dengan kalimat penyemangat.

PENTING:
Kembalikan respon Anda HANYA DALAM FORMAT JSON murni (tanpa awalan \`\`\`json dan akhiran \`\`\`), tanpa teks pengantar atau penutup apa pun. Gunakan \\n\\n untuk paragraf baru.

Struktur JSON harus persis seperti contoh berikut:
{
  "score": 85,
  "feedback": "Halo Bayu! Aku udah baca nih cerpen kamu. Memang aku setuju banget dengan gaya kamu menyampaikan emosinya, kerasa banget di hati.\\n\\nSecara keseluruhan, arah tulisan kamu ini semi-formal, cocok untuk novel remaja. Diksi yang dipakai juga udah cukup variatif.\\n\\nTapiii, ada satu nih yang perlu dibahas, yaitu soal penulisan dialog tag dan typo. Misalnya pada kalimat yang kamu tulis:\\n'Aku tidak mau pergi kerumah itu!' Teriak Andi mematung.\\n\\nContoh perbaikannya yang sesuai PUEBI:\\n\\"Aku tidak mau pergi ke rumah itu!\\" teriak Andi.\\n*(Catatan: kata 'ke rumah' dipisah, dan setelah tanda kutip tutup, huruf awal dialog tag menggunakan huruf kecil karena masih satu rangkaian kalimat).*\\n\\nTerus semangat menulis dan perbanyak baca referensi ya. Karyamu punya potensi besar!"
}`;

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
