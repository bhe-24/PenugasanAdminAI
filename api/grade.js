import { 
    GoogleGenerativeAI, 
    HarmCategory, 
    HarmBlockThreshold 
} from '@google/generative-ai';

// Inisialisasi Gemini API menggunakan key dari Environment Variable Vercel
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
        let { instruction, rubric, answer, studentName } = req.body;

        if (!answer || answer.trim() === '') {
            return res.status(400).json({ error: 'Karya/Jawaban siswa kosong' });
        }

        // FUNGSI PEMBERSIH: Menghapus tag HTML bawaan copy-paste agar tidak error
        const sanitizeText = (text) => {
            if (!text) return '';
            return text.replace(/<[^>]*>?/gm, '').trim(); 
        };

        answer = sanitizeText(answer);
        instruction = sanitizeText(instruction);
        rubric = sanitizeText(rubric);

        // Fallback untuk variabel yang kosong
        if (!studentName || studentName === 'undefined') {
            studentName = 'Penulis'; // Diubah agar lebih terasa personal dibanding 'Teman-teman'
        }
        if (!instruction || instruction === 'undefined') {
            instruction = 'Buatlah karya tulisan fiksi/esai yang baik dan benar sesuai kaidah.';
        }
        if (!rubric || rubric === 'undefined') {
            rubric = 'Nilai rentang 0-100 dengan mempertimbangkan: Gagasan, Struktur, Tanda Baca, Diksi, Typo, dan Gaya Penulisan.';
        }

        // 2. SUSUN PROMPT UNTUK AI (Menggabungkan persona editor fiksi dengan aturan ketat HTML)
        const promptText = `
Peran: Anda adalah seorang Mentor Penulisan Kreatif dan Editor Fiksi yang ramah, asyik, objektif, dan suportif.
Tugas: Mengoreksi karya siswa dengan gaya bahasa yang ringan, kasual, dan sangat akrab.

Informasi Siswa:
Nama: "${studentName}"

Instruksi Tugas:
"${instruction}"

Rubrik & Unsur Penilaian:
"${rubric}"

Karya Siswa:
"${answer}"

Tolong berikan output HANYA dalam format JSON valid berikut:
{
  "score": (angka bulat 0-100),
  "feedback": "(string HTML)"
}

Ketentuan Feedback (Wajib diikuti):
1. Sapaan & Nama: Mulailah dengan sapaan hangat "Halo, ${studentName}!" lalu berikan apresiasi spesifik (ide, emosi, dll). JANGAN panggil dengan sebutan "Teman-teman".
2. Gaya Bahasa: Wajib gunakan kata ganti "Aku" (sebagai mentor) dan "Kamu" (untuk siswa). Jadilah mentor yang asyik.
3. Struktur Isi (Tulis mengalir dalam paragraf, jangan pakai poin-poin angka):
   - Analisis Gaya & Struktur: Jelaskan arah tulisan (formal/kasual) dan konsistensinya. Penjelasannya harus mendalam.
   - Temuan & Koreksi: Kutip kalimat siswa yang kurang pas (typo, PUEBI, dialog tag berantakan).
   - Contoh Perbaikan: Susun ulang kutipan tersebut menjadi kalimat yang benar sesuai standar.
   - Penutup & Motivasi: Berikan semangat di akhir.
4. Format Teks: GUNAKAN tag HTML <b> untuk tebal, <i> untuk miring, dan <br> untuk enter/baris baru. DILARANG KERAS MENGGUNAKAN MARKDOWN (seperti **teks**, *teks*, atau #). Langsung tuliskan tag HTML-nya di dalam string JSON.
`;

        // 3. Konfigurasi Filter Keamanan (Sama seperti kode 1)
        const safetySettings = [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ];

        // 4. PANGGIL GEMINI AI
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); // Boleh disesuaikan jika ingin pakai versi lain
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: promptText }] }],
            generationConfig: { 
                temperature: 0.5, // Sedikit dinaikkan agar ulasan mentor lebih luwes dan variatif
                responseMimeType: "application/json" // Memaksa AI mengembalikan JSON murni
            },
            safetySettings: safetySettings
        });
        
        const textResponse = result.response.text();
        
        // Parsing JSON langsung (tidak perlu replace ```json lagi karena sudah dipaksa lewat mimeType)
        const finalResult = JSON.parse(textResponse);

        // 5. Kirim hasil ke Frontend
        res.status(200).json({
            score: finalResult.score,
            feedback: finalResult.feedback
        });

    } catch (error) {
        console.error("AI Error (Editor):", error);
        res.status(500).json({ 
            score: 0, 
            feedback: "Aduh, sistem mentor AI lagi agak sibuk nih.<br>Bisa tolong review karyanya manual dulu ya!" 
        });
    }
}
