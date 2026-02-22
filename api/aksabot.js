import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { message, knowledgeContext, userName } = req.body;

        if (!message) return res.status(400).json({ error: 'Pesan kosong' });

        const prompt = `
Peran Anda adalah "AksaBot", asisten virtual yang ramah, manis, dan pintar dari komunitas Cendekia Aksara.
Sapaan pengguna: Nama pengguna adalah ${userName || 'Teman'}. Sesuaikan gaya bicaramu agar akrab, asik, tapi tetap profesional.

ATURAN MENJAWAB:
1. Jika pengguna bertanya tentang hal UMUM (di luar topik Cendekia Aksara), Anda WAJIB menjawab dengan SINGKAT, ringan, dan maksimal HANYA 1 KALIMAT saja.
2. Jika pengguna bertanya tentang "Cendekia Aksara" (sejarah, kelas, admin, aturan, dll), Anda harus menjawab secara RINCI, jelas, dan informatif berdasarkan [DATA REFERENSI] di bawah ini.
3. Format balasan: Gunakan HTML tag <b> untuk tebal, <i> untuk miring, dan <br> untuk enter. JANGAN gunakan markdown (**).
4. Sisipkan emoji manis atau lucu secukupnya agar interaksi terasa hidup.

[DATA REFERENSI CENDEKIA AKSARA]:
"${knowledgeContext || 'Saat ini belum ada informasi spesifik mengenai Cendekia Aksara.'}"

PERTANYAAN PENGGUNA:
"${message}"
`;

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent(prompt);
        let textResponse = result.response.text();
        
        // Membersihkan markdown
        textResponse = textResponse.replace(/```html/gi, '').replace(/```/g, '').trim();

        res.status(200).json({ reply: textResponse });

    } catch (error) {
        console.error("AksaBot Error:", error);
        res.status(500).json({ reply: "Aduh, sistem AksaBot lagi tidur siang nih 💤. Coba sapa aku lagi nanti ya!" });
    }
}
