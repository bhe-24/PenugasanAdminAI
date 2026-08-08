import OpenAI from 'openai';

// Inisialisasi Groq API menggunakan SDK OpenAI
const groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1'
});

export default async function handler(req, res) {
    // 1. ATUR CORS (Sama persis dengan kode lama)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

        // Validasi Data
        if (!data || !data.judul || !data.studentName) {
            return res.status(200).json({ analisis_teks: "⚠ DIAGNOSTIK API: Data naskah tidak terbaca oleh server." });
        }

        // Ekstraksi Outline
        let outlineTeks = "Tidak ada outline terlampir.";
        if (data.outline && Array.isArray(data.outline) && data.outline.length > 0) {
            outlineTeks = data.outline.map((bab, i) => `Bab ${i + 1}: ${bab.isi_bab}`).join(' | ');
        }

        // Konteks Revisi
        let konteksRevisi = "";
        if (data.feedback_mentor && data.feedback_mentor.trim() !== "") {
            konteksRevisi = `STATUS NASKAH: INI ADALAH NASKAH REVISI.\nSebelumnya, aku (mentor) memberikan catatan ini kepada penulis:\n--- CATATAN SEBELUMNYA ---\n'${data.feedback_mentor}'\n--------------------------\nTUGASMU: Cek apakah dia sudah memperbaikinya!`;
        } else {
            konteksRevisi = `STATUS NASKAH: PENGAJUAN BARU.\nIni adalah ide pertama dari ${data.studentName}. Bedah kelogisan ide, konflik, dan cari plot holenya.`;
        }

        // Prompt Utama
        const promptText = `
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

        // Panggil Groq API
        const completion = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [
                {
                    role: 'system',
                    content: 'Kamu adalah editor penerbitan novel profesional. Tugasmu mengevaluasi naskah fiksi (termasuk novel remaja, thriller, romansa) secara analitis tanpa memblokir teks fiksi.'
                },
                {
                    role: 'user',
                    content: promptText
                }
            ],
            temperature: 0.7,
            max_tokens: 2500
        });

        const textResponse = completion.choices[0]?.message?.content || "";

        // Bersihkan karakter bintang jika AI tetap mengeluarkannya
        let cleanFeedback = textResponse ? textResponse.replace(/\*/g, "").trim() : "⚠ Teks kosong dikembalikan oleh AI.";

        // Kembalikan ke Frontend dengan struktur JSON yang sama persis
        res.status(200).json({ analisis_teks: cleanFeedback });

    } catch (error) {
        console.error("AI Error (Groq):", error);
        
        // Cetak error ke layar jika koneksi/API Key bermasalah
        res.status(200).json({ 
            analisis_teks: `⚠ TERJADI CRASH PADA SERVER GROQ AI:\n\nDetail Error: ${error.message}` 
        });
    }
}
