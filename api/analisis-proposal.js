import { GoogleGenerativeAI } from '@google/generative-ai';

// Inisialisasi Gemini menggunakan SDK Resmi
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
    // Pengaturan CORS (Sesuai standarmu)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const data = req.body;

        // Susun Outline Bab menjadi teks berurutan
        let outlineTeks = "Tidak ada outline terlampir.";
        if (data.outline && data.outline.length > 0) {
            outlineTeks = data.outline.map((bab, i) => `Bab ${i + 1} (${bab.judul_bab || 'Tanpa Judul'}): ${bab.isi_bab}`).join('\n');
        }

        // --- SUPER PROMPT INKUBASI ---
        const promptText = `
Peran: Kamu adalah "Mentor Cendekia", seorang Editor Akuisisi Novel di penerbitan mayor yang asyik, gaul, tapi sangat kritis dan tajam dalam membedah naskah. 
Gaya bahasamu kasual, empatik, menggunakan kata "Aku" dan "Kamu".

Tugas: Evaluasi proposal naskah siswa berikut dan berikan ulasan komprehensif.

Informasi Naskah:
- Nama Penulis: "${data.studentName}"
- Judul Naskah: "${data.judul}"
- Genre: "${data.genre}"
- Target Kata: "${data.target_kata} kata"
- Logline (Premis): "${data.logline}"
- Sinopsis Lengkap: "${data.sinopsis}"
- Outline Bab:
"${outlineTeks}"

Tolong berikan output HANYA dalam format JSON valid berikut:
{
  "feedback": "(String berisi teks ulasan lengkap)"
}

Ketentuan Isi Feedback (Wajib diikuti):
1. Sapaan & Kesan Awal: Buka dengan "Halo ${data.studentName}! Setelah aku baca apa yang kamu ajukan...". Beri apresiasi antusias.
2. Evaluasi Judul & Target: Bahas apakah judulnya menarik dan apakah target katanya logis untuk genre tersebut.
3. Bedah Logline & Sinopsis (KRITIKAN TAJAM): 
   - Apresiasi kekuatan ide.
   - Pembedahan Kritis: Cari dan sebutkan plot hole, motivasi karakter yang lemah, urgensi cerita yang kurang, atau alur klise.
   - Gunakan kalimat transisi seperti: "Tapi, ada beberapa poin kosong yang seru banget nih untuk kamu tambahkan..."
4. Evaluasi Outline: Cek pacing per bab. Adakah bab yang terasa lambat (dragging) atau terlalu terburu-buru (rushing)?
5. Kesimpulan & Rekomendasi: Berikan kesimpulan potensi naskah di pasaran, dan sarankan secara implisit apakah naskah ini (ACC / Revisi Minor / Revisi Mayor / Tolak).
6. Format Teks: Gunakan "\\n\\n" untuk memisahkan paragraf agar rapi. Kamu BISA menggunakan Markdown dasar seperti **teks tebal** atau *teks miring* untuk penekanan (jangan gunakan tag HTML seperti <b> atau <i> karena tidak akan terbaca di kolom teks). Dilarang menyertakan karakter markdown JSON \`\`\` di luar objek JSON.
`;

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: promptText }] }],
            generationConfig: { 
                temperature: 0.6, // Dibuat 0.6 agar seimbang antara kreatif dan analitis
                maxOutputTokens: 2048 // Kapasitas napas AI panjang untuk analisis utuh
            } 
        });
        
        let textResponse = result.response.text();
        
        // Membersihkan pembungkus markdown JSON dari Gemini
        textResponse = textResponse.replace(/```json/gi, '').replace(/```/g, '').trim();

        // Parsing hasil teks ke bentuk JSON Objek
        const finalResult = JSON.parse(textResponse);

        // Kirim response sukses ke Frontend Admin
        res.status(200).json({
            analisis_teks: finalResult.feedback
        });

    } catch (error) {
        console.error("AI Error (Analisis Pitching):", error);
        // Fallback jika API sedang gangguan atau JSON gagal diparsing
        res.status(500).json({ 
            analisis_teks: "Aduh, AksaBot lagi agak sibuk atau pusing baca naskahnya nih. \n\nBisa tolong Kak Admin nilai manual dulu ya!" 
        });
    }
}
