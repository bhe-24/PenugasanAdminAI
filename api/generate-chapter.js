export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { judulBuku, babJudul, jumlahParagraf } = req.body;
        
        // PROMPT UTAMA
        const prompt = `Anda adalah penulis buku teks ahli. Tulislah isi materi untuk buku "${judulBuku}", fokus pada bab: "${babJudul}".

ATURAN WAJIB:
1. Tulis MINIMAL ${jumlahParagraf} paragraf materi yang padat, komprehensif, dan berbobot.
2. WAJIB sertakan minimal 1 daftar poin/bullet points (menggunakan <ul><li>...</li></ul>) yang ditandai dengan titik/bintang hitam.
3. WAJIB sertakan minimal 1 tabel data/perbandingan (menggunakan <table><tr><td>...</td></tr></table>). Berikan border pada tabel.
4. JANGAN gunakan <br> untuk memberi jarak. Gunakan tag <p> biasa.
5. Balas HANYA format HTML murni. JANGAN sertakan Judul Bab di awal teks. Jangan gunakan markdown.`;

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
                    temperature: 0.6 
                })
            });

            if (!groqResponse.ok) throw new Error("Groq API Error/Limit");
            
            const groqData = await groqResponse.json();
            htmlRes = groqData.choices[0].message.content;

        } catch (groqError) {
            // ==========================================
            // ATTEMPT 2: FALLBACK KE GEMINI 2.5 FLASH
            // ==========================================
            console.log("Groq gagal/limit, beralih ke Gemini 2.5 Flash...");
            
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
            
            const geminiResponse = await fetch(geminiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.6 }
                })
            });

            if (!geminiResponse.ok) throw new Error("Gemini API juga Error/Limit");
            
            const geminiData = await geminiResponse.json();
            // Struktur balasan Gemini berbeda dengan Groq
            htmlRes = geminiData.candidates[0].content.parts[0].text;
        }

        // BERSIHKAN FORMAT MARKDOWN (Berlaku untuk Groq maupun Gemini)
        htmlRes = htmlRes.replace(/```html/g, '').replace(/```/g, '').trim();
        
        res.status(200).json({ chapterHtml: htmlRes });

    } catch (e) { 
        res.status(500).json({ error: "Semua server AI (Groq & Gemini) sedang sibuk/limit. Coba lagi nanti." }); 
    }
}
