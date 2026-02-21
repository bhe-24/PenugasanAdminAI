import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        // Menerima data mentah dari frontend
        let { studentName, instruction, answer } = req.body;

        if (!answer || answer.trim() === '') {
            return res.status(400).json({ error: 'Jawaban siswa kosong' });
        }

        // Memastikan tidak ada 'undefined'
        if (!instruction || instruction === 'undefined' || instruction === 'null') {
            instruction = 'Kerjakan tugas dengan baik, jujur, dan perhatikan kaidah penulisan.';
        }
        if (!studentName || studentName === 'undefined') {
            studentName = 'Siswa';
        }

        // BACKEND YANG MENYUSUN PROMPT
        const promptText = `
Peran: Kamu adalah teman belajar yang pintar dan asik (bukan guru yang kaku).
Tugas: Nilai jawaban temanmu (siswa) berdasarkan instruksi penugasan.

Informasi Siswa:
Nama: "${studentName}"

Instruksi Penugasan:
"${instruction}"

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
4. Format Teks: GUNAKAN tag HTML <b> untuk tebal, <i> untuk miring, dan <br> untuk enter/baris baru. DILARANG KERAS MENGGUNAKAN MARKDOWN (seperti **teks**). Langsung tuliskan tag HTML-nya di dalam string JSON.
`;

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: promptText }] }],
            generationConfig: { temperature: 0.4 } 
        });
        
        let textResponse = result.response.text();
        textResponse = textResponse.replace(/```json/gi, '').replace(/```/g, '').trim();

        const finalResult = JSON.parse(textResponse);

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
