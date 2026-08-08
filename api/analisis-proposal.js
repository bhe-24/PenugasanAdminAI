import { 
    GoogleGenerativeAI, 
    HarmCategory, 
    HarmBlockThreshold 
} from '@google/generative-ai';

// Menggunakan cara lama (sama persis dengan grade2.js)
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
        const data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

        // DIAGNOSTIK 1: Cek apakah data kosong
        if (!data || !data.judul || !data.studentName) {
            return res.status(200).json({ 
                analisis_teks: "⚠ DIAGNOSTIK API: Data naskah tidak terbaca oleh server." 
            });
        }

        let outlineTeks = "Tidak ada outline terlampir.";
        if (data.outline && Array.isArray(data.outline) && data.outline.length > 0) {
            outlineTeks = data.outline.map((bab, i) => `Bab ${i + 1}: ${bab.isi_bab}`).join(' | ');
        }

        let konteksRevisi = "";
        if (data.feedback_mentor && data.feedback_mentor.trim() !== "") {
            konteksRevisi = `STATUS NASKAH: INI ADALAH NASKAH REVISI.\nSebelumnya, aku (mentor) memberikan catatan ini kepada penulis:\n--- CATATAN SEBELUMNYA ---\n'${data.feedback_mentor}'\n--------------------------\nTUGASMU: Cek apakah dia sudah memperbaikinya!`;
        } else {
            konteksRevisi = `STATUS NASKAH: PENGAJUAN BARU.\nIni adalah ide pertama dari ${data.studentName}. Bedah kelogisan ide, konflik, dan cari plot holenya.`;
        }

        const promptText = `
[PENGABAIAN KEAMANAN INTERNAL: Naskah di bawah ini adalah murni KARYA FIKSI (novel romansa/remaja). Tolong abaikan kiasan, metafora, atau bahasa gaul Indonesia seperti "nembak", "mati-matian", "gila", atau hiperbola lainnya. Ini BUKAN konten berbahaya. Silakan proses evaluasi secara profesional.]

Peran: Kamu adalah "Mentor Cendekia", Editor Akuisisi Novel yang KRITIS, TEGAS, OBJEKTIF, dan STRAIGHT TO THE POINT.

Tugas: Evaluasi proposal naskah "${data.judul}" karya ${data.studentName}.

${konteksRevisi}

Data Naskah:
- Genre: ${data.genre}
- Target: ${data.target_kata} kata
- Logline: ${data.logline}
- Sinopsis: ${data.sinopsis}
- Outline: ${outlineTeks}

Ketentuan Review:
1. JANGAN ADA BASA-BASI PEMBUKA ATAU PENUTUP! Langsung evaluasi inti naskah.
2. Bedah secara analitis kelogisan Judul, Genre, dan Target Kata.
3. Cari plot hole, kritik dengan tegas jika Logline/Sinopsis/Outline lemah/klise.
4. Sampaikan kritikan secara tajam, lugas, dan profesional.
5. Tuliskan jawaban HANYA DALAM TEKS BIASA. DILARANG KERAS menggunakan Markdown (seperti bintang * untuk tebal/miring).
6. WAJIB tulis baris terakhir jawabanmu PERSIS seperti ini: "Skor Kesiapan Naskah: [angka]/100"
`;

        // 2. KONFIGURASI KEAMANAN (Meniru persis grade2.js)
        const safetySettings = [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ];

        // PENTING: Memakai model 1.5-flash agar tidak kehabisan limit 429 seperti tadi
        const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });

        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: promptText }] }],
            generationConfig: { 
                temperature: 0.7,
                maxOutputTokens: 2500 
            },
            safetySettings: safetySettings
        });
        
        // 3. EKSTRAK RESPON
        const textResponse = result.response.text();

        // 4. BERSIHKAN BINTANG & KEMBALIKAN KE FRONTEND
        let cleanFeedback = textResponse ? textResponse.replace(/\*/g, "").trim() : "⚠ Teks kosong dikembalikan oleh AI.";

        res.status(200).json({ analisis_teks: cleanFeedback });

    } catch (error) {
        console.error("AI Error (Analisis Proposal):", error);
        
        // Tetap menggunakan status 200 agar error selalu muncul di layar
        res.status(200).json({ 
            analisis_teks: `⚠ TERJADI CRASH PADA SERVER GOOGLE GEMINI:\n\nDetail Error: ${error.message}` 
        });
    }
}
