export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { mapel, semester, topik } = req.body;

        const systemPrompt = `
Anda adalah ahli kurikulum pendidikan dari Cendekia Aksara. Buatlah Rancangan Pembelajaran (RPP) singkat berdurasi 80 menit untuk mata pelajaran "${mapel}" semester ${semester} dengan topik "${topik}".

Berikan balasan HANYA dalam format HTML murni seperti di bawah ini, TANPA markdown (\`\`\`), TANPA penjelasan pembuka/penutup.

FORMAT WAJIB:
<div style="margin-bottom: 15px;">
    <strong>Capaian Pembelajaran (CP):</strong> <br> [Isi CP disini]
</div>
<div style="margin-bottom: 15px;">
    <strong>Tujuan Pembelajaran (TP):</strong> <br> [Isi TP disini]
</div>
<table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
    <thead>
        <tr style="background-color: #003366; color: white;">
            <th style="border: 1px solid #000; padding: 8px;">Tahap</th>
            <th style="border: 1px solid #000; padding: 8px;">Kegiatan (Durasi)</th>
            <th style="border: 1px solid #000; padding: 8px;">Deskripsi</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td style="border: 1px solid #000; padding: 8px; text-align: center;">Awal</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: center;">Pendahuluan (15 Menit)</td>
            <td style="border: 1px solid #000; padding: 8px;">[Isi kegiatan awal]</td>
        </tr>
        <tr>
            <td style="border: 1px solid #000; padding: 8px; text-align: center;">Inti</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: center;">Penyampaian Materi (50 Menit)</td>
            <td style="border: 1px solid #000; padding: 8px;">[Isi kegiatan inti]</td>
        </tr>
        <tr>
            <td style="border: 1px solid #000; padding: 8px; text-align: center;">Penutup</td>
            <td style="border: 1px solid #000; padding: 8px; text-align: center;">Evaluasi & Salam (15 Menit)</td>
            <td style="border: 1px solid #000; padding: 8px;">[Isi kegiatan penutup]</td>
        </tr>
    </tbody>
</table>
`;

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [ { role: 'system', content: systemPrompt } ],
                temperature: 0.4
            })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || 'Gagal');

        res.status(200).json({ htmlRpp: data.choices[0].message.content });

    } catch (error) {
        res.status(500).json({ error: "Sistem AI sedang sibuk. Coba beberapa saat lagi." });
    }
}
