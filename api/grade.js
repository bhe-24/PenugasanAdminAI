export default async function handler(req, res) {
    // 1. Cek Metode (Harus POST)
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // 2. Ambil Kunci dari "Brankas Vercel" (Aman!)
        const apiKey = process.env.GEMINI_API_KEY; 
        
        if (!apiKey) {
            return res.status(500).json({ error: 'API Key server belum disetting' });
        }

        // 3. Ambil data dari Frontend
        const { prompt } = req.body;

        // 4. Kirim ke Google Gemini
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const data = await response.json();

        // 5. Kembalikan jawaban ke Frontend
        res.status(200).json(data);

    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ error: 'Gagal menghubungi AI' });
    }
}
