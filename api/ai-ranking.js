const { 
    GoogleGenerativeAI, 
    HarmCategory, 
    HarmBlockThreshold 
} = require('@google/generative-ai');

// Inisialisasi API Key persis seperti di grade2.js
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

module.exports = async function handler(req, res) {
    // 1. ATUR CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    // Tangani preflight request dari browser
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const data = req.body;
        let { eventName, karya, total } = data;

        if (!karya || total === 0) {
            return res.status(400).json({ error: 'Data karya tidak valid atau kosong.' });
        }

        // --- BACKEND YANG MENYUSUN PROMPT ---
        const promptText = `
Peran: Kamu adalah "Juri Sastra Eksekutif Cendekia Aksara", kritikus yang tajam, objektif, dan sangat menghargai keindahan diksi serta kedalaman makna.
Tugas: Menganalisis SEMUA karya dari event "${eventName}". Total ada ${total} karya yang masuk untuk dinilai.

Kriteria Penilaian:
1. Eksplorasi ide dan orisinalitas cerita/pesan.
2. Gaya bahasa, pemilihan diksi, dan penggunaan majas yang efektif.
3. Kedalaman emosi dan penyampaian pesan yang koheren.

Data Karya yang Masuk:
${karya}

Tolong berikan output HANYA dalam format JSON ARRAY murni yang valid. Struktur JSON-nya harus persis seperti ini untuk SETIAP peserta (Urutkan dari karya yang paling terbaik / Juara 1 di atas hingga yang terbawah):
[
  {
    "peringkat": "(Contoh: Juara 1 / Juara 2 / Juara 3 / Peserta)",
    "nama_penulis": "(Nama Peserta)",
    "judul_karya": "(Judul Karya)",
    "analisis": "(Analisis tajam dan objektif sekitar 2-3 kalimat padat mengenai kelebihan dan kekurangan karya tersebut)"
  }
]

Ketentuan Output (SANGAT KETAT):
1. JANGAN ADA BASA-BASI. Langsung berikan format JSON Array dimulai dari tanda [.
2. Analisis HARUS mencakup SEMUA (${total}) peserta yang ada di Data Karya. Jangan ada yang terlewat.
3. Wajib berikan predikat Juara 1, Juara 2, dan Juara 3 untuk 3 karya teratas. Sisanya berikan predikat "Peserta".
`;

        // Konfigurasi Filter Keamanan untuk melonggarkan pengecekan AI
        const safetySettings = [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ];

        // Menggunakan model Gemini Flash 1.5
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: promptText }] }],
            generationConfig: { 
                temperature: 0.6,
                maxOutputTokens: 8192,
                responseMimeType: "application/json" // Memaksa AI mengembalikan format JSON murni
            },
            safetySettings: safetySettings
        });
        
        let textResponse = result.response.text();
        
        // Parsing JSON (Pembersihan jika AI membandel memberi backtick)
        textResponse = textResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
        const finalResult = JSON.parse(textResponse);

        // Mengembalikan data JSON ke frontend admin
        res.status(200).json({
            analisis_data: finalResult
        });

    } catch (error) {
        console.error("AI Error (Ranking Karya):", error);
        res.status(500).json({ 
            error: error.message || "AksaBot sedang mengalami kendala server. Silakan coba lagi!" 
        });
    }
}
