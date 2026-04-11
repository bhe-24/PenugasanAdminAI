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
4. Gunakan "\\n\\n" untuk enter (baris baru) antar paragraf agar enak dipandang.
5. DILARANG KERAS menggunakan Markdown seperti bintang-bintang (**teks**). Gunakan teks biasa saja.

PENTING: Jangan gunakan karakter newline asli (tombol enter) di dalam string JSON. Gunakan "\\n" sebagai ganti enter. Jangan gunakan tanda kutip ganda (") di dalam teks review, gunakan tanda kutip tunggal (') saja agar JSON tidak rusak.
`;

        const model = genAI.getGenerativeModel({ 
            model: "gemini-3-flash-preview", 
            generationConfig: { 
                responseMimeType: "application/json",
                temperature: 0.7, 
                maxOutputTokens: 2500 
            }
        });

        const result = await model.generateContent(promptText);
        let textResponse = result.response.text();

        // --- PROSES PEMBERSIHAN TOTAL ---
        textResponse = textResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
        let cleanText = textResponse.replace(/[\x00-\x1F\x7F-\x9F]/g, "");

        try {
            const finalResult = JSON.parse(cleanText);
            
            // Hapus karakter bintang (**) jika AI tetap mengirimkannya
            let cleanFeedback = finalResult.feedback.replace(/\*\*/g, "");
            
            res.status(200).json({
                analisis_teks: cleanFeedback
            });
        } catch (parseError) {
            console.error("Gagal Parse JSON, mencoba ekstraksi manual...");
            const match = textResponse.match(/"feedback"\s*:\s*"([\s\S]*)"/);
            if (match && match[1]) {
                let resultText = match[1]
                    .replace(/\\n/g, "\n")
                    .replace(/\\"/g, '"')
                    .replace(/\*\*/g, ""); // Hapus bintang di fallback
                res.status(200).json({ analisis_teks: resultText });
            } else {
                throw new Error("Format output AI tidak dapat dikenali.");
            }
        }

    } catch (error) {
        console.error("AI Error (Analisis Pitching):", error);
        res.status(500).json({ 
            analisis_teks: "Aduh, AksaBot lagi pusing bacanya. Coba klik analisis sekali lagi ya!" 
        });
    }
}
