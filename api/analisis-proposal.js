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
        const data = req.body;

        let outlineTeks = "Tidak ada outline terlampir.";
        if (data.outline && data.outline.length > 0) {
            outlineTeks = data.outline.map((bab, i) => `Bab ${i + 1}: ${bab.isi_bab}`).join(' | ');
        }

        const promptText = `
Peran: Kamu adalah "Mentor Cendekia", Editor Akuisisi Novel yang kritis dan gaul. 
Gunakan bahasa "Aku" dan "Kamu", santai tapi tajam.

Tugas: Evaluasi proposal naskah "${data.judul}" karya "${data.studentName}".

Data:
- Genre: ${data.genre}
- Target: ${data.target_kata} kata
- Logline: ${data.logline}
- Sinopsis: ${data.sinopsis}
- Outline: ${outlineTeks}

Wajib Berikan output dalam format JSON valid:
{
  "feedback": "ISI_REVIEW_DISINI"
}

Ketentuan Review:
1. Sapa ${data.studentName}, apresiasi idenya.
2. Bedah Judul, Genre, dan Target Kata.
3. Berikan KRITIKAN TAJAM pada Logline/Sinopsis/Outline. Cari celah plot hole atau bagian yang klise.
4. Gunakan "\\n\\n" untuk enter (baris baru).
5. Boleh pakai Markdown (**teks**) untuk penekanan.

PENTING: Jangan gunakan karakter newline (tombol enter) di dalam string JSON. Gunakan "\\n" sebagai ganti enter. Jangan gunakan tanda kutip ganda (") di dalam teks review, gunakan tanda kutip tunggal (') saja agar JSON tidak rusak.
`;

        const model = genAI.getGenerativeModel({ 
            model: "gemini-3-flash-preview",
            // Gunakan Response MIME Type JSON jika didukung oleh versi SDK-mu
            generationConfig: { 
                responseMimeType: "application/json",
                temperature: 0.7, 
                maxOutputTokens: 2500 
            }
        });

        const result = await model.generateContent(promptText);
        let textResponse = result.response.text();

        // --- PROSES PEMBERSIHAN EKSTRA (ANTI-ERROR) ---
        // 1. Bersihkan pembungkus markdown jika ada
        textResponse = textResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
        
        // 2. Escape karakter newline terlarang yang mungkin lolos
        // Ini sering jadi penyebab "Unterminated String"
        const sanitizedResponse = textResponse.replace(/\n/g, "\\n").replace(/\r/g, "\\r");

        try {
            const finalResult = JSON.parse(sanitizedResponse);
            res.status(200).json({
                analisis_teks: finalResult.feedback
            });
        } catch (parseError) {
            console.error("JSON Parse failed after sanitization:", textResponse);
            // Jika parsing gagal, kita kirim teks mentahnya saja tapi dibersihkan dari struktur JSON
            const fallbackText = textResponse.replace(/^{.*"feedback":\s*"/, '').replace(/"\s*}$/, '');
            res.status(200).json({ analisis_teks: fallbackText });
        }

    } catch (error) {
        console.error("AI Error (Analisis Pitching):", error);
        res.status(500).json({ 
            analisis_teks: "Aduh, AksaBot lagi pusing bacanya. Coba kirim ulang atau hubungi teknisi ya!" 
        });
    }
}
