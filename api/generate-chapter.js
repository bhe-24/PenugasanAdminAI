export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { judulBuku, babJudul, jumlahParagraf } = req.body;
        const prompt = `Anda adalah penulis buku teks ahli. Tulislah isi materi untuk buku "${judulBuku}", fokus pada bab: "${babJudul}".

ATURAN WAJIB:
1. Tulis MINIMAL ${jumlahParagraf} paragraf materi yang padat, komprehensif, dan berbobot.
2. WAJIB sertakan minimal 1 daftar poin/bullet points (menggunakan <ul><li>...</li></ul>) yang ditandai dengan titik/bintang hitam.
3. WAJIB sertakan minimal 1 tabel data/perbandingan (menggunakan <table><tr><td>...</td></tr></table>). Berikan border pada tabel.
4. JANGAN gunakan <br> untuk memberi jarak. Gunakan tag <p> biasa.
5. Balas HANYA format HTML murni. JANGAN sertakan Judul Bab di awal teks (karena sistem PDF akan membuat halaman judul bab secara terpisah). Jangan gunakan markdown.`;

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], temperature: 0.6 })
        });
        const data = await response.json();
        res.status(200).json({ chapterHtml: data.choices[0].message.content.replace(/```html|```/g, '').trim() });
    } catch (e) { res.status(500).json({ error: "Gagal menulis bab." }); }
}
