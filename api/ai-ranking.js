const { 
    GoogleGenerativeAI, 
    HarmCategory, 
    HarmBlockThreshold 
} = require('@google/generative-ai');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error("Kunci API Gemini belum dipasang di pengaturan Environment Variables Vercel.");
        }
        
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const data = req.body;

        const action = data.action || 'ranking'; 

        const safetySettings = [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ];

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        // =====================================================================
        // FITUR 1: ANALISIS KARYA MINGGUAN (SEMUA KARYA)
        // =====================================================================
        if (action === 'ranking') {
            if (!data.karya || data.total === 0) {
                return res.status(400).json({ error: 'Data karya tidak valid atau kosong.' });
            }

            const promptText = `
Peran: Kamu adalah "Juri Sastra Eksekutif Cendekia Aksara", kritikus yang tajam, objektif, dan sangat menghargai keindahan diksi serta kedalaman makna.
Tugas: Menganalisis SEMUA karya dari event "${data.eventName}". Total ada ${data.total} karya yang masuk untuk dinilai.

Kriteria Penilaian:
1. Eksplorasi ide dan orisinalitas cerita/pesan.
2. Gaya bahasa, pemilihan diksi, dan penggunaan majas yang efektif.
3. Kedalaman emosi dan penyampaian pesan yang koheren.

Data Karya yang Masuk:
${data.karya}

Tolong berikan output HANYA dalam format JSON ARRAY murni yang valid, tanpa teks awalan atau akhiran apapun. Struktur JSON-nya harus seperti ini untuk SETIAP peserta:
[
  {
    "nama_penulis": "(Nama Peserta)",
    "judul_karya": "(Judul Karya)",
    "analisis": "(Analisis evaluasi tajam dan objektif sekitar 2-3 kalimat padat mengenai kelebihan dan kekurangan karya tersebut)"
  }
]

Ketentuan (SANGAT KETAT):
1. JANGAN ADA BASA-BASI. Jangan tulis \`\`\`json atau semacamnya, langsung mulai dengan tanda [.
2. Analisis harus mencakup semua (${data.total}) peserta yang ada di Data Karya.
3. Urutkan Array JSON dari karya yang menurutmu paling terbaik (peringkat 1 di atas) hingga yang terbawah.
`;
            const result = await model.generateContent({
                contents: [{ role: "user", parts: [{ text: promptText }] }],
                generationConfig: { temperature: 0.6, maxOutputTokens: 8192, responseMimeType: "application/json" },
                safetySettings: safetySettings
            });

            let textResponse = result.response.text();
            // Pembersihan jika AI masih mengirimkan format markdown ```json
            textResponse = textResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
            
            const finalResult = JSON.parse(textResponse);

            return res.status(200).json({ analisis_data: finalResult });
        }


        // =====================================================================
        // FITUR 2: KOREKSI TUGAS SISWA (Bawaan grade2.js)
        // =====================================================================
        else if (action === 'grading') {
            let { studentName, instruction, answer } = data;

            if (!answer || answer.trim() === '') return res.status(400).json({ error: 'Jawaban siswa kosong' });
            
            const sanitizeText = (text) => text ? text.replace(/<[^>]*>?/gm, '').trim() : '';
            answer = sanitizeText(answer);
            instruction = sanitizeText(instruction) || 'Kerjakan tugas dengan baik dan jujur.';
            studentName = studentName || 'Siswa';

            const promptText = `
Peran: Kamu adalah teman belajar yang pintar dan asik (bukan guru yang kaku).
Tugas: Nilai jawaban temanmu (siswa) berdasarkan instruksi penugasan.

Informasi Siswa: Nama: "${studentName}"
Instruksi Penugasan: "${instruction}"
Jawaban Siswa: "${answer}"

Tolong berikan output HANYA dalam format JSON valid berikut:
{
  "score": (angka bulat 0-100),
  "feedback": "(string HTML)"
}

Ketentuan Feedback:
1. Mulai dengan sapaan hangat "Halo, ${studentName}!"
2. Gunakan kata ganti "Aku" dan "Kamu". Santai tapi membangun.
3. Struktur: Beri tahu kesalahannya, berikan koreksi/jawaban benarnya, lalu berikan pujian usahanya (Jadikan 1 paragraf mengalir).
4. Format Teks: GUNAKAN tag HTML <b> untuk tebal, <i> untuk miring, dan <br> untuk enter. DILARANG MENGGUNAKAN MARKDOWN.
`;
            const result = await model.generateContent({
                contents: [{ role: "user", parts: [{ text: promptText }] }],
                generationConfig: { temperature: 0.4, responseMimeType: "application/json" },
                safetySettings: safetySettings
            });
            
            let textResponse = result.response.text();
            textResponse = textResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
            const finalResult = JSON.parse(textResponse);

            return res.status(200).json({
                score: finalResult.score,
                feedback: finalResult.feedback
            });
        }

        else {
            return res.status(400).json({ error: 'Action API tidak dikenali.' });
        }

    } catch (error) {
        console.error("AI Master Error:", error);
        res.status(500).json({ 
            error: error.message || "AksaBot sedang mengalami kendala server. Silakan coba lagi!" 
        });
    }
}
