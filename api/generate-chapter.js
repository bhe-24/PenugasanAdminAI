export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { judulBuku, babJudul } = req.body;
        const prompt = `Anda adalah penulis buku teks ahli. Tulislah isi materi secara komprehensif, sangat detail, dan berbobot untuk:
Buku: "${judulBuku}"
Fokus Penulisan: "${babJudul}"

ATURAN:
1. Tulisan harus sangat panjang (ribuan kata jika memungkinkan).
2. Format WAJIB HTML murni (gunakan <h2>, <h3>, <p>, <strong>).
3. Awali langsung dengan <h2>${babJudul}</h2>, JANGAN ada kata pengantar "Tentu, ini isinya".
4. Dilarang menggunakan markdown.`;

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], temperature: 0.6 })
        });
        const data = await response.json();
        res.status(200).json({ chapterHtml: data.choices[0].message.content.replace(/```html|```/g, '').trim() });
    } catch (e) { res.status(500).json({ error: "Gagal menulis bab." }); }
}
