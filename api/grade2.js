import { GoogleGenerativeAI } from '@google/generative-ai';

// Mengambil API KEY dari "Brankas" Vercel
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
    // 1. ATUR CORS (Agar frontend bisa menembak API ini)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    // Jika request OPTIONS (Preflight), langsung return OK
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Pastikan method-nya POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Mengambil data dari frontend admin/penilaian.html
        let { studentName, instruction, answer } = req.body;

        if (!answer || answer.trim() === '') {
            return res.status(400).json({ error: 'Jawaban siswa kosong' });
        }

        // --- SOLUSI BUG "UNDEFINED" ---
        // Jika dari frontend terkirim teks "undefined" atau kosong, kita timpa dengan kalimat default.
        if (!instruction || instruction === 'undefined' || instruction === 'null' || instruction.trim() === '') {
            instruction = 'Kerjakan tugas dengan baik, jujur, dan perhatikan kaidah penulisan.';
        }
        if (!studentName || studentName === 'undefined') {
            studentName = 'Teman';
        }

        // 2. SUSUN PROMPT (Gaya Teman Belajar Asik & Pintar)
        const promptText = `
Peran: Kamu adalah teman belajar yang pintar dan asik (bukan guru yang kaku).
Tugas: Nilai jawaban temanmu (siswa) berdasarkan instruksi penugasan.

Informasi Siswa:
Nama: "${studentName}"

Instruksi Penugasan:
"${instruksiTugas}"

Jawaban Siswa:
"${answer}"

Tolong berikan output HANYA dalam format JSON valid berikut:
{
  "score": (angka bulat 0-100),
  "feedback": "(string HTML)"
}

Ketentuan Feedback (Wajib diikuti):
1. Sapaan & Nama: Mulailah dengan sapaan hangat "Halo, ${studentName}!" atau "Selamat Pagi/Siang/Sore, ${studentName}!".
2. Gaya Bahasa: Gunakan bahasa yang santai, akrab, dan memotivasi. Gunakan kata ganti "Aku" (sebagai penilai) dan "Kamu" (untuk siswa). Jangan gunakan "Anda" atau "Saya". Hindari bahasa birokratis atau terlalu formal.
3. Struktur Isi:
   - Analisis Kesalahan: Jelaskan bagian mana yang kurang tepat atau salah dari jawaban siswa.
   - Koreksi: Berikan contoh jawaban yang benar atau cara memperbaikinya.
   - Pujian: Tetap apresiasi usaha mereka.
4. Format HTML: Gunakan tag HTML <b> untuk menebalkan poin penting, <i> untuk istilah asing, dan <br> untuk baris baru. Jangan gunakan markdown (**bold**), harus HTML tag.
`;

        // 3. PANGGIL GEMINI AI
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: promptText }] }],
            generationConfig: { temperature: 0.4 } // Dibuat sedikit kreatif agar bahasanya luwes tapi tetap fokus pada format
        });
        
        let textResponse = result.response.text();

        // 4. BERSIHKAN TEKS (Mencegah AI menambahkan markdown ```json)
        textResponse = textResponse.replace(/```json/gi, '').replace(/```/g, '').trim();

        // Parse ke bentuk JSON Javascript
        const finalResult = JSON.parse(textResponse);

        // 5. KIRIM HASIL KE FRONTEND
        res.status(200).json({
            score: finalResult.score,
            feedback: finalResult.feedback
        });

    } catch (error) {
        console.error("AI Error (Grade2):", error);
        res.status(500).json({ 
            score: 0, 
            feedback: "Aduh, sistem AI lagi agak sibuk nih. <br>Bisa tolong nilai manual dulu ya, Kak!" 
        });
    }
}
