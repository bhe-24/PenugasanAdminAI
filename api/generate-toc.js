export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { judul, target, deskripsi, jumlahBab } = req.body;
        const prompt = `Buatlah kerangka (Daftar Isi) untuk buku teks pendidikan berjudul "${judul}". Target pembaca: ${target}. Deskripsi: ${deskripsi}. 
WAJIB buat TEPAT ${jumlahBab} Bab yang mendalam.
Balas HANYA dengan format HTML list (<ul><li>Bab 1: Judul Bab</li>...</ul>). JANGAN ada teks pengantar atau markdown.`;

        let htmlRes = "";

        try {
            // ==========================================
            // ATTEMPT 1: MENGGUNAKAN GROQ AI
            // ==========================================
            const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({ 
                    model: 'llama-3.3-70b-versatile', 
                    messages: [{ role: 'user', content: prompt }], 
                    temperature: 0.7 
                })
            });

            if (!groqResponse.ok) throw new Error("Groq API Error/Limit");
            const groqData = await groqResponse.json();
            htmlRes = groqData.choices[0].message.content;

        } catch (groqError) {
            // ==========================================
            // ATTEMPT 2: FALLBACK KE GEMINI 2.5 FLASH
            // ==========================================
            console.log("Groq gagal menyusun TOC, beralih ke Gemini 2.5 Flash...");
            
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
            
            const geminiResponse = await fetch(geminiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.7 }
                })
            });

            if (!geminiResponse.ok) throw new Error("Gemini API Error/Limit");
            const geminiData = await geminiResponse.json();
            htmlRes = geminiData.candidates[0].content.parts[0].text;
        }

        // BERSIHKAN FORMAT MARKDOWN (Berlaku untuk Groq maupun Gemini)
        htmlRes = htmlRes.replace(/```html/g, '').replace(/```/g, '').trim();

        res.status(200).json({ tocHtml: htmlRes });

    } catch (e) { 
        console.error(e);
        res.status(500).json({ error: "Semua server AI sedang sibuk. Gagal membuat kerangka." }); 
    }
}
