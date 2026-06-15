import { 
    GoogleGenerativeAI, 
    HarmCategory, 
    HarmBlockThreshold 
} from '@google/generative-ai';

// Inisialisasi di luar persis seperti grade2.js
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        let { eventName, karya, total } = req.body;

        if (!karya || total === 0) {
            return res.status(400).json({ error: 'Data karya tidak valid atau kosong.' });
        }

        // BACKEND YANG MENYUSUN PROMPT
        const promptText = `
Peran: Kamu adalah "Juri Sastra Eksekutif Cendekia Aksara", kritikus yang tajam, objektif, dan sangat menghargai keindahan diksi serta kedalaman makna.

Tugas: Menganalisis dan memberikan peringkat Top 1 hingga Top 3 untuk karya-karya dari event "${eventName}". Total ada ${total} karya yang masuk untuk dinilai.

Kriteria Penilaian:
1. Eksplorasi ide dan orisinalitas cerita/pesan.
2. Gaya bahasa, pemilihan diksi, dan penggunaan majas yang efektif.
3. Kedalaman emosi dan penyampaian pesan yang koheren.

Data Karya yang Masuk:
${karya}

Tolong berikan output HANYA dalam format JSON valid berikut:
{
  "analisis_teks": "(string teks hasil ulasan yang sudah diformat rapi dengan spasi/enter)"
}

Ketentuan Isi "analisis_teks" (SANGAT KETAT HARUS DIIKUTI):
1. JANGAN ADA BASA-BASI PEMBUKA ATAU PENUTUP SEPERTI "Halo", "Baik, saya akan analisis", atau "Semoga bermanfaat". Langsung berikan hasil.
2. Paragraf Pertama: Berikan ulasan singkat secara general mengenai kualitas rata-rata dari seluruh karya yang masuk pada event ini.
3. Buat peringkat Juara 1, Juara 2, dan Juara 3 (jika jumlah karya kurang dari 3, sesuaikan saja jumlahnya).
4. Format Peringkat: Sebutkan dengan jelas "JUARA [X]: [Judul Karya] oleh [Nama Peserta]".
5. Analisis Pemenang: Di bawah setiap juara, berikan satu paragraf analisis kritis mengapa karya tersebut layak menang (bedah plot, emosi, atau diksinya secara spesifik).
6. Paragraf Terakhir: Berikan apresiasi dan masukan umum (saran perbaikan) untuk peserta lain yang belum berhasil masuk peringkat.
7. FORMAT TEKS: DILARANG KERAS menggunakan format Markdown seperti bintang ganda (**teks**) atau bintang tunggal (*teks*) untuk tebal/miring. Cukup gunakan baris baru (enter/\\n) untuk memisahkan setiap poin dan paragraf agar rapi, karena ini akan dicetak ke PDF.
`;

        // Konfigurasi Filter Keamanan untuk melonggarkan pengecekan AI (agar aman baca fiksi)
        const safetySettings = [
            {
                category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold: HarmBlockThreshold.BLOCK_NONE,
            },
            {
                category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                threshold: HarmBlockThreshold.BLOCK_NONE,
            },
            {
                category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                threshold: HarmBlockThreshold.BLOCK_NONE,
            },
            {
                category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold: HarmBlockThreshold.BLOCK_NONE,
            },
        ];

        // Gunakan model Flash terbaru
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: promptText }] }],
            generationConfig: { 
                temperature: 0.6,
                responseMimeType: "application/json" // Memaksa AI mengembalikan format JSON murni
            },
            safetySettings: safetySettings
        });
        
        const textResponse = result.response.text();
        
        // Parsing JSON langsung (karena output dijamin JSON dari config di atas)
        const finalResult = JSON.parse(textResponse);

        // Hapus karakter bintang (*) jika AI masih memakai markdown
        let cleanFeedback = finalResult.analisis_teks ? finalResult.analisis_teks.replace(/\*/g, "").trim() : "Gagal memuat analisis.";

        res.status(200).json({
            analisis_teks: cleanFeedback
        });

    } catch (error) {
        console.error("AI Error (Ranking):", error);
        res.status(500).json({ 
            error: "Aduh, sistem AI lagi agak sibuk nih. Coba klik analisis sekali lagi ya!" 
        });
    }
}
