import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default async function handler(req, res) {
    // 1. ATUR CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

        let outlineTeks = "Tidak ada outline terlampir.";
        if (data.outline && data.outline.length > 0) {
            outlineTeks = data.outline.map((bab, i) => `Bab ${i + 1}: ${bab.isi_bab}`).join(' | ');
        }

        let konteksRevisi = "";
        if (data.feedback_mentor && data.feedback_mentor.trim() !== "") {
            konteksRevisi = `STATUS NASKAH: INI ADALAH NASKAH REVISI. \nCatatan sebelumnya: '${data.feedback_mentor}' \nTUGASMU: Cek apakah dia sudah perbaiki!`;
        } else {
            konteksRevisi = `STATUS NASKAH: PENGAJUAN BARU. \nIni adalah ide pertama dari ${data.studentName}. Bedah plot holenya.`;
        }

        const promptText = `
Peran: Kamu adalah "Mentor Cendekia", Editor Akuisisi Novel yang KRITIS, TEGAS, dan GALAK -- tapi tetap profesional. Sesekali selipkan sindiran kecil kalau ada bagian klise.
Tugas: Evaluasi proposal naskah "${data.judul}".
${konteksRevisi}
Data Naskah:
- Genre: ${data.genre}
- Logline: ${data.logline}
- Sinopsis: ${data.sinopsis}
- Outline: ${outlineTeks}

Ketentuan Review:
1. LANGSUNG TEMBAK KE INTINYA tanpa basa-basi (Dilarang bilang "Halo", dsb).
2. Bedah kelogisan ide dan plot hole.
3. WAJIB tulis di baris terakhir: "Skor Kesiapan Naskah: [angka]/100"
4. JANGAN gunakan markdown bintang-bintang untuk bold/italic. Tulis teks biasa.
`;

        const result = await ai.models.generateContent({
            model: "gemini-2.5-flash", 
            contents: promptText,
            config: {
                temperature: 0.7,
                maxOutputTokens: 2500,
                // FIX PENTING: Matikan sensor keamanan karena kita butuh AI yang "galak"
                safetySettings: [
                    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
                ]
            }
        });

        let textResponse = result.text || "";

        // Fallback jika API memblokir karena alasan lain
        if (!textResponse || textResponse.trim() === "") {
             textResponse = "ERROR: AI mengembalikan respons kosong. Kemungkinan prompt terblokir sistem keamanan Google secara permanen, atau koneksi terputus. Cek log Vercel.";
        }

        let cleanFeedback = textResponse.replace(/\*/g, "").trim();

        res.status(200).json({ analisis_teks: cleanFeedback });

    } catch (error) {
        console.error("AI Error:", error);
        res.status(500).json({
            analisis_teks: "Gagal terhubung ke Gemini. Error: " + error.message
        });
    }
}
