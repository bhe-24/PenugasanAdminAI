import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
    // 1. ATUR CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const apiKey = process.env.GEMINI_API_KEY;
    const genAI = new GoogleGenerativeAI(apiKey);

    try {
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            generationConfig: { 
                responseMimeType: "application/json",
                temperature: 0.95 // Sangat tinggi agar quotenya tidak klise dan selalu unik
            }
        });
        
        const promptTeks = `
Peranmu adalah seorang Penulis Sastra dan Pujangga gaul yang sangat puitis, mendalam, dan berani.
Tugas: Buatkan SATU buah kutipan (quote) motivasi, perenungan, atau patah hati/cinta yang sangat menyentuh khusus untuk anak SMA. Jangan menggunakan bahasa baku yang kaku. Buatlah sedikit 'nyastra' namun tetap relate dengan kehidupan anak muda.
Berikan juga satu nama penulis fiktif (nama pena) yang estetik (misal: 'Senja Aksara', 'Baskara', 'Kala', dll).

Wajib balas HANYA dalam format JSON valid dengan struktur:
{
  "quote": "isi kutipan yang mendalam...",
  "author": "Nama Pena Estetik"
}
`;
        
        const result = await model.generateContent(promptTeks);
        const data = JSON.parse(result.response.text());

        res.status(200).json({
            quote: data.quote,
            author: data.author
        });

    } catch (error) {
        console.error("AI Quote Error:", error);
        res.status(500).json({ error: "Gagal memancing inspirasi AI." });
    }
}
