import { GoogleGenerativeAI } from '@google/generative-ai';

// Inisialisasi API Key dari environment variables Vercel
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

        if (!data.karya || data.total === 0) {
            return res.status(400).json({ error: 'Data karya tidak valid.' });
        }

        // --- SUSUN PROMPT UTAMA JURI SASTRA ---
        const promptText = `
Peran: Kamu adalah "Juri Sastra Eksekutif Cendekia Aksara", kritikus yang tajam, objektif, dan sangat menghargai keindahan diksi serta kedalaman makna.

Tugas: Menganalisis dan memberikan peringkat Top 1 hingga Top 3 untuk karya-karya dari event "${data.eventName}". Total ada ${data.total} karya yang masuk untuk dinilai.

Kriteria Penilaian:
1. Eksplorasi ide dan orisinalitas cerita/pesan.
2. Gaya bahasa, pemilihan diksi, dan penggunaan majas yang efektif.
3. Kedalaman emosi dan penyampaian pesan yang koheren.

Data Karya yang Masuk:
${data.karya}

Ketentuan Output (SANGAT KETAT HARUS DIIKUTI):
1. JANGAN ADA BASA-BASI PEMBUKA ATAU PENUTUP SEPERTI "Halo", "Baik, saya akan analisis", atau "Semoga bermanfaat". Langsung berikan hasil.
2. Paragraf Pertama: Berikan ulasan singkat secara general mengenai kualitas rata-rata dari seluruh karya yang masuk pada event ini.
3. Buat peringkat Juara 1, Juara 2, dan Juara 3 (jika jumlah karya kurang dari 3, sesuaikan saja).
4. Format Peringkat: Sebutkan dengan jelas "JUARA [X]: [Judul Karya] oleh [Nama Peserta]".
5. Analisis Pemenang: Di bawah setiap juara, berikan satu paragraf analisis kritis mengapa karya tersebut layak menang (bedah plot, emosi, atau diksinya secara spesifik).
6. Paragraf Terakhir: Berikan apresiasi dan masukan umum (saran perbaikan) untuk peserta lain yang belum berhasil masuk peringkat.
7. FORMAT TEKS: Tuliskan jawaban dalam format teks biasa (plain text). DILARANG KERAS menggunakan format Markdown seperti bintang ganda (**teks**) atau bintang tunggal (*teks*) untuk tebal/miring, karena hasil ini akan langsung dicetak ke dalam dokumen PDF. Cukup gunakan baris baru (ENTER) untuk memisahkan setiap poin dan paragraf agar rapi.
`;

        // Menggunakan model standar Gemini Flash 1.5 untuk kecepatan dan akurasi logika
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            generationConfig: { 
                temperature: 0.6, 
                maxOutputTokens: 2500 
            }
        });

        const result = await model.generateContent(promptText);
        let textResponse = result.response.text();

        // --- PROSES PEMBERSIHAN BACKUP ---
        // Menghapus karakter asterik (*) jika AI masih bandel menggunakan markdown
        let cleanFeedback = textResponse.replace(/\*/g, "").trim();

        res.status(200).json({
            analisis_teks: cleanFeedback
        });

    } catch (error) {
        console.error("AI Error (Ranking Karya):", error);
        res.status(500).json({ 
            error: "AksaBot sedang mengalami kendala server. Silakan coba klik analisis sekali lagi ya!" 
        });
    }
}
