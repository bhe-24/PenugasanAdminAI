const { 
    GoogleGenerativeAI, 
    HarmCategory, 
    HarmBlockThreshold 
} = require('@google/generative-ai');

module.exports = async function handler(req, res) {
    // 1. ATUR CORS (Mengizinkan website Anda mengakses API ini)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    // Tangani preflight request dari browser
    if (req.method === 'OPTIONS') return res.status(200).end();
    
    // Tolak jika bukan metode POST
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        // PENTING: Inisialisasi diletakkan DI DALAM handler agar tidak menyebabkan error "Build Failed" di Vercel
        if (!process.env.GEMINI_API_KEY) {
            throw new Error("Kunci API Gemini belum dipasang di pengaturan Environment Variables Vercel.");
        }
        
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        let { eventName, karya, total } = req.body;

        if (!karya || total === 0) {
            return res.status(400).json({ error: 'Data karya tidak valid atau kosong.' });
        }

        // --- SUSUN PROMPT UTAMA JURI SASTRA ---
        // Kita minta AI mengembalikan output dalam format JSON berisi key "analisis_teks"
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
7. FORMAT TEKS: DILARANG KERAS menggunakan format Markdown seperti bintang ganda (**teks**) atau bintang tunggal (*teks*) untuk tebal/miring, karena hasil ini akan langsung dicetak ke dalam dokumen PDF. Cukup gunakan baris baru (enter/\\n) untuk memisahkan setiap poin dan paragraf agar rapi.
`;

        // --- KONFIGURASI KEAMANAN (Mencegah AI Crash saat membaca cerita Thriller/Dark) ---
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

        // Menggunakan model standar Gemini Flash 1.5
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: promptText }] }],
            generationConfig: { 
                temperature: 0.6, 
                maxOutputTokens: 2500,
                responseMimeType: "application/json" // Memaksa format JSON agar tidak error saat di-parse
            },
            safetySettings: safetySettings
        });

        const textResponse = result.response.text();
        
        // Memecah JSON dari AI
        const finalResult = JSON.parse(textResponse);

        // --- PROSES PEMBERSIHAN BACKUP ---
        // Menghapus karakter asterik (*) jika AI masih bandel menggunakan markdown
        let cleanFeedback = finalResult.analisis_teks.replace(/\*/g, "").trim();

        // Kirim hasil kembali ke website Admin
        res.status(200).json({
            analisis_teks: cleanFeedback
        });

    } catch (error) {
        console.error("AI Error (Ranking Karya):", error);
        res.status(500).json({ 
            error: error.message || "AksaBot sedang mengalami kendala server. Silakan coba klik analisis sekali lagi!" 
        });
    }
}
