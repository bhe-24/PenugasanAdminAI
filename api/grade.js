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
Anda adalah seorang Guru Bahasa dan Sastra Indonesia yang sangat teliti, objektif, dan suportif.
Tugas Anda adalah menilai karya/esai siswa berdasarkan instruksi dan rubrik berikut.

INSTRUKSI TUGAS:
"${instruction || 'Buatlah karya tulisan yang baik dan benar.'}"

RUBRIK PENILAIAN:
"${rubric || 'Nilai 1-100 berdasarkan tata bahasa (PUEBI), struktur, dan kesesuaian tema.'}"

JAWABAN/KARYA SISWA:
"${answer}"

TUGAS ANDA:
1. Berikan nilai angka dari 0 hingga 100.
2. Berikan feedback/komentar (maksimal 3 paragraf). Beri pujian pada bagian yang bagus, dan saran perbaikan pada bagian yang kurang. Gunakan bahasa yang memotivasi siswa (jangan gunakan kata "Sistem" atau "AI", bertindaklah seolah-olah Anda adalah guru manusianya).

PENTING:
Kembalikan respon Anda HANYA DALAM FORMAT JSON murni (tanpa awalan \`\`\`json dan akhiran \`\`\`), dengan struktur persis seperti ini:
{
  "score": 85,
  "feedback": "Karya yang sangat bagus! Pemilihan diksinya..."
}
`;

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
