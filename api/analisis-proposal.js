import { GoogleGenerativeAI } from '@google/generative-ai';

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
        const data = req.body;

        // Ekstrak outline jadi teks
        let outlineTeks = "Tidak ada outline terlampir.";
        if (data.outline && data.outline.length > 0) {
            outlineTeks = data.outline.map((bab, i) => `Bab ${i + 1}: ${bab.isi_bab}`).join(' | ');
        }

        // --- LOGIKA KECERDASAN MULTI-TURN (KONTEKS REVISI) ---
        let konteksRevisi = "";
        
        if (data.feedback_mentor && data.feedback_mentor.trim() !== "") {
            konteksRevisi = `
STATUS NASKAH: INI ADALAH NASKAH REVISI.
Sebelumnya, aku (mentor) sudah memberikan catatan revisi berikut kepada ${data.studentName}:
--- CATATAN SEBELUMNYA ---
'${data.feedback_mentor}'
--------------------------
TUGASMU SEKARANG: Cek apakah dia sudah memperbaiki logline/sinopsis/outlinenya sesuai catatanku di atas! Langsung tegur kalau dia ngeyel/belum diperbaiki, atau kasih apresiasi singkat kalau sudah benar, lalu lanjut bedah celah lainnya.
`;
        } else {
            konteksRevisi = `
STATUS NASKAH: PENGAJUAN BARU.
Ini adalah ide pertama dari ${data.studentName}. Langsung bedah kelogisan ide, konflik, dan cari plot holenya.
`;
        }

        // --- SUSUN PROMPT UTAMA (HANYA MINTA TEKS BIASA) ---
        const promptText = `
Peran: Kamu adalah "Mentor Cendekia", Editor Akuisisi Novel yang kritis dan gaul. 
Gunakan bahasa "Aku" dan "Kamu", santai tapi tajam.

Tugas: Evaluasi proposal naskah "${data.judul}" karya "${data.studentName}".

${konteksRevisi}

Data Naskah:
- Genre: ${data.genre}
- Target: ${data.target_kata} kata
- Logline: ${data.logline}
- Sinopsis: ${data.sinopsis}
- Outline: ${outlineTeks}

Ketentuan Review (SANGAT KETAT):
1. JANGAN ADA BASA-BASI PEMBUKA ATAU PENUTUP! Dilarang keras memakai kata seperti "Halo", "Terima kasih sudah submit", "Tentu, mari kita bedah", atau "Semoga sukses". LANGSUNG TEMBAK KE INTINYA (misal: "Hal pertama yang harus kamu revisi adalah...", atau "Ide ini cukup menarik, tapi...").
2. Bedah kelogisan Judul, Genre, dan Target Kata.
3. Berikan KRITIKAN TAJAM pada Logline/Sinopsis/Outline. Cari celah plot hole atau klise.
4. Gunakan baris baru (enter) antar paragraf agar enak dipandang.
5. DILARANG KERAS menggunakan Markdown seperti bintang-bintang untuk tebal/miring (**teks** atau *teks*). Gunakan HURUF KAPITAL saja untuk memberikan penekanan jika perlu.
`;

        const model = genAI.getGenerativeModel({ 
            model: "gemini-3-flash-preview", // Menggunakan versi stabil
            generationConfig: { 
                // Tidak lagi menggunakan responseMimeType: "application/json"
                temperature: 0.7, 
                maxOutputTokens: 2500 
            }
        });

        const result = await model.generateContent(promptText);
        let textResponse = result.response.text();

        // --- PROSES PEMBERSIHAN ---
        // Hapus karakter bintang (*) yang sering dipakai AI untuk bold/italic/list
        let cleanFeedback = textResponse.replace(/\*/g, "").trim();

        // Backend langsung membungkus teks bersih ke dalam JSON
        res.status(200).json({
            analisis_teks: cleanFeedback
        });

    } catch (error) {
        console.error("AI Error (Analisis Pitching):", error);
        res.status(500).json({ 
            analisis_teks: "Aduh, AksaBot lagi pusing bacanya. Coba klik analisis sekali lagi ya!" 
        });
    }
}
