// File: api/central.js
import OpenAI from 'openai';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

// 1. INISIALISASI GROQ AI
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const groq = GROQ_API_KEY ? new OpenAI({ apiKey: GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' }) : null;

// 2. INISIALISASI GEMINI AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Fungsi Pembersih Teks Universal
const sanitizeText = (text) => {
    if (!text) return '';
    return text.replace(/<[^>]*>?/gm, '').trim(); 
};

// Filter Keamanan Universal (Dilonggarkan untuk keperluan edukasi/koreksi fiksi)
const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

export default async function handler(req, res) {
    // ATUR CORS UNTUK SEMUA REQUEST
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        // TANGKAP PERINTAH 'action' (Bisa dari Body POST atau Query GET)
        const action = req.body?.action || req.query?.action;

        if (!action) {
            return res.status(400).json({ error: "Parameter 'action' tidak ditemukan." });
        }

        // ==========================================
        // SWITCH CASE: TERMINAL PUSAT API
        // ==========================================
        switch (action) {

            // ---------------------------------------------------------
            // [A] KOREKSI UJIAN (Asal file: api/grade.js)
            // ---------------------------------------------------------
            case 'grade-ujian': {
                let { instruction, rubric, answer, studentName } = req.body;
                if (!answer || answer.trim() === '') return res.status(400).json({ error: 'Karya/Jawaban siswa kosong' });

                answer = sanitizeText(answer);
                instruction = sanitizeText(instruction) || 'Buatlah karya tulisan fiksi/esai yang baik dan benar sesuai kaidah.';
                rubric = sanitizeText(rubric) || 'Nilai rentang 0-100 dengan mempertimbangkan: Gagasan, Struktur, Tanda Baca, Diksi, Typo, dan Gaya Penulisan.';
                studentName = studentName && studentName !== 'undefined' ? studentName : 'Penulis';

                const promptText = `
                Peran: Anda adalah seorang Mentor Penulisan Kreatif dan Editor Fiksi yang ramah, asyik, objektif, dan suportif.
                Tugas: Mengoreksi karya siswa dengan gaya bahasa yang ringan, kasual, dan sangat akrab.

                Informasi Siswa: Nama: "${studentName}"
                Instruksi Tugas: "${instruction}"
                Rubrik & Unsur Penilaian: "${rubric}"
                Karya Siswa: "${answer}"

                Tolong berikan output HANYA dalam format JSON valid: { "score": (angka bulat 0-100), "feedback": "(string HTML)" }
                Ketentuan Feedback:
                1. Mulailah dengan sapaan hangat "Halo, ${studentName}!" lalu apresiasi spesifik. JANGAN panggil "Teman-teman".
                2. Wajib gunakan "Aku" (mentor) dan "Kamu" (siswa).
                3. Tulis mengalir dalam paragraf (jangan pakai poin-poin angka): Analisis gaya, temuan typo/PUEBI, contoh perbaikan, dan motivasi penutup.
                4. GUNAKAN tag HTML <b>, <i>, dan <br>. DILARANG KERAS MENGGUNAKAN MARKDOWN.
                `;

                const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
                const result = await model.generateContent({
                    contents: [{ role: "user", parts: [{ text: promptText }] }],
                    generationConfig: { temperature: 0.5, responseMimeType: "application/json" },
                    safetySettings: safetySettings
                });

                const finalResult = JSON.parse(result.response.text());
                return res.status(200).json({ score: finalResult.score, feedback: finalResult.feedback });
            }

            // ---------------------------------------------------------
            // [B] KOREKSI PENUGASAN (Asal file: api/grade2.js)
            // ---------------------------------------------------------
            case 'grade-tugas': {
                let { studentName, instruction, answer } = req.body;
                if (!answer || answer.trim() === '') return res.status(400).json({ error: 'Jawaban siswa kosong' });

                answer = sanitizeText(answer);
                instruction = sanitizeText(instruction) || 'Kerjakan tugas dengan baik, jujur, dan perhatikan kaidah penulisan.';
                studentName = studentName && studentName !== 'undefined' ? studentName : 'Siswa';

                const promptText = `
                Peran: Kamu adalah teman belajar yang pintar dan asik (bukan guru yang kaku).
                Tugas: Nilai jawaban temanmu (siswa) berdasarkan instruksi penugasan.

                Informasi Siswa: Nama: "${studentName}"
                Instruksi Penugasan: "${instruction}"
                Jawaban Siswa: "${answer}"

                Tolong berikan output HANYA dalam format JSON valid: { "score": (angka bulat 0-100), "feedback": "(string HTML)" }
                Ketentuan Feedback:
                1. Sapaan hangat "Halo, ${studentName}!" atau "Selamat Pagi/Siang/Sore, ${studentName}!".
                2. Gunakan "Aku" dan "Kamu". Jangan "Anda" atau "Saya". Jangan kaku/birokratis.
                3. Tulis mengalir dalam paragraf (tanpa poin-poin): Analisis Kesalahan, Koreksi/Contoh benar, dan Pujian/Apresiasi.
                4. GUNAKAN tag HTML <b>, <i>, dan <br>. DILARANG KERAS MENGGUNAKAN MARKDOWN.
                `;

                const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
                const result = await model.generateContent({
                    contents: [{ role: "user", parts: [{ text: promptText }] }],
                    generationConfig: { temperature: 0.4, responseMimeType: "application/json" },
                    safetySettings: safetySettings
                });

                const finalResult = JSON.parse(result.response.text());
                return res.status(200).json({ score: finalResult.score, feedback: finalResult.feedback });
            }

            // ---------------------------------------------------------
            // [C] EDIT ARTIKEL / KARYA TULIS (Via Groq)
            // ---------------------------------------------------------
            case 'edit-artikel': {
                if (!groq) return res.status(500).json({ error: 'Groq API Key belum dikonfigurasi.' });
                
                const { text, title, instruction } = req.body;
                if (!text) return res.status(400).json({ error: 'Teks kosong.' });

                const customInstruction = instruction 
                    ? `INSTRUKSI KHUSUS:\n"${instruction}"`
                    : `INSTRUKSI UMUM: Rapikan ejaan, perbaiki typo, pastikan kalimat mengalir.`;

                const promptText = `Judul: ${title || 'Tanpa Judul'}\n\n${customInstruction}\n\nTEKS:\n"""\n${text}\n"""\nKeluarkan murni HTML.`;

                const completion = await groq.chat.completions.create({
                    model: 'llama-3.3-70b-versatile',
                    messages: [{ role: "user", content: promptText }],
                    temperature: instruction ? 0.7 : 0.1,
                });
                
                let textResponse = completion.choices[0]?.message?.content || "";
                textResponse = textResponse.replace(/```html\n?/gi, '').replace(/```\n?/g, '').trim();

                return res.status(200).json({ result: textResponse });
            }

            default:
                return res.status(404).json({ error: `Action '${action}' tidak dikenali oleh sistem API Central.` });
        }

    } catch (error) {
        console.error("API Central Error Breakdown:", error);
        return res.status(500).json({ 
            score: 0, 
            feedback: "Sistem server pusat mengalami gangguan internal. Silakan coba beberapa saat lagi.",
            error: error.message 
        });
    }
}
