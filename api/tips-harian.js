import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
    // 1. ATUR CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const apiKey = process.env.GEMINI_API_KEY;
    const genAI = new GoogleGenerativeAI(apiKey);

    try {
        // --- 1. MEMBUAT ARTIKEL MENGGUNAKAN GEMINI ---
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            generationConfig: { 
                responseMimeType: "application/json",
                temperature: 0.85 // Kreativitas tinggi namun tetap berbobot
            }
        });
        
        const promptTeks = `
Peranmu adalah Penulis Senior, Edukator, dan Editor Mading Cendekia Aksara.
Tugasmu: Tulis sebuah artikel atau tips kepenulisan (bisa tentang merancang plot, meracik konflik, menulis puisi, sudut pandang, karakterisasi, dll) yang SANGAT BERBOBOT dan EDUKATIF untuk siswa SMA.

ATURAN MUTLAK (JIKA DILANGGAR, ARTIKEL DITOLAK):
1. GAYA BAHASA: Harus lugas, ringan, mudah dimengerti, dan bersahabat (seperti mentor membimbing adiknya). Gunakan kata ganti "Aku", "Kamu", atau "Kita".
2. DILARANG KERAS menggunakan bahasa slang/gaul yang berlebihan apalagi menggunakan kata "Lo" dan "Gue".
3. PANJANG ARTIKEL: Wajib panjang, komprehensif, dan rinci! Buatlah sekitar 4 hingga 6 paragraf.
4. WAJIB CONTOH: Setiap teori yang kamu sampaikan HARUS disertai contoh konkret! (Misal: berikan contoh kalimat yang salah, lalu berikan contoh kalimat yang benar).
5. FORMAT OUTPUT: Karena teks ini langsung tayang di website, kunci "isi" HARUS menggunakan format tag HTML dasar (<p>, <b>, <i>, <ul>, <li>, <br>) agar susunan paragraf dan poin-poinnya sangat rapi saat dibaca. JANGAN gunakan Markdown (* atau #).
6. Output HARUS murni JSON valid dengan struktur:
   - "judul": Judul artikel yang elegan dan mengundang rasa penasaran (maksimal 10 kata).
   - "isi": Keseluruhan teks artikel berformat HTML (panjang 4-6 paragraf).
`;
        
        const resultTeks = await model.generateContent(promptTeks);
        const tipData = JSON.parse(resultTeks.response.text());

        // --- 2. PENGIRIMAN DATA KE WEBSITE ---
        // Karena Imagen (Gambar) sering error/limit, kita kirimkan string kosong.
        // Frontend Mading akan mendeteksi ini dan otomatis membuatkan Sampul Kategori SVG yang rapi.
        res.status(200).json({
            judul: tipData.judul,
            isi: tipData.isi,
            gambar: "" 
        });

    } catch (error) {
        console.error("AI Daily Tip Error:", error);
        res.status(500).json({ error: "Gagal membuat artikel mading otomatis." });
    }
}
