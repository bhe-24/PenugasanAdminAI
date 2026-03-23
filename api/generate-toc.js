export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { judul, target, deskripsi } = req.body;
        const prompt = `Buatlah kerangka (Daftar Isi) untuk buku teks pendidikan berjudul "${judul}". Target pembaca: ${target}. Deskripsi: ${deskripsi}. 
Balas HANYA dengan format HTML list (<ul><li>Bab 1: Judul Bab</li></ul>). Berikan minimal 5 Bab yang mendalam. JANGAN ada teks pengantar.`;

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], temperature: 0.7 })
        });
        const data = await response.json();
        res.status(200).json({ tocHtml: data.choices[0].message.content.replace(/```html|```/g, '').trim() });
    } catch (e) { res.status(500).json({ error: "Gagal membuat kerangka." }); }
}
