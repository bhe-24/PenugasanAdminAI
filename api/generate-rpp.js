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
Anda adalah ahli penyusun kurikulum tingkat lanjut. Buatlah Rancangan Pelaksanaan Pembelajaran (RPP) komprehensif berdurasi 80 menit untuk mata pelajaran "${mapel}" semester ${semester} dengan topik "${topik}".

Berikan balasan HANYA dalam format HTML murni seperti struktur di bawah ini, TANPA markdown (\`\`\`), TANPA penjelasan pembuka/penutup. Buatlah isinya sangat detail, profesional, dan bisa memakan banyak halaman.

FORMAT WAJIB:
<div style="margin-bottom: 20px;">
    <h3 style="color: #003366; border-bottom: 2px solid #d4af37; padding-bottom: 5px;">A. Capaian Pembelajaran (CP) & Tujuan Pembelajaran (TP)</h3>
    <p><strong>Capaian Pembelajaran:</strong><br> [Jelaskan CP dengan detail]</p>
    <p><strong>Tujuan Pembelajaran:</strong><br> 
        <ul>
            <li>[TP 1]</li>
            <li>[TP 2]</li>
        </ul>
    </p>
    <p><strong>Indikator Ketercapaian:</strong><br> [Jelaskan indikator keberhasilan siswa]</p>
</div>

<div style="margin-bottom: 20px;">
    <h3 style="color: #003366; border-bottom: 2px solid #d4af37; padding-bottom: 5px;">B. Poin Penting & Materi Esensial</h3>
    <p>[Jelaskan poin-poin materi yang wajib ditekankan oleh pengajar]</p>
</div>

<h3 style="color: #003366; border-bottom: 2px solid #d4af37; padding-bottom: 5px;">C. Skenario Pembelajaran (80 Menit)</h3>
<table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11pt;">
    <thead>
        <tr style="background-color: #003366; color: white;">
            <th style="border: 1px solid #000; padding: 10px; width: 15%;">Tahap & Waktu</th>
            <th style="border: 1px solid #000; padding: 10px; width: 45%;">Aktivitas Pengajar & Siswa</th>
            <th style="border: 1px solid #000; padding: 10px; width: 40%;">Fokus Ketercapaian & Asesmen</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td style="border: 1px solid #000; padding: 10px; text-align: center; vertical-align: top;">
                <strong>Pendahuluan</strong><br>(15 Menit)
            </td>
            <td style="border: 1px solid #000; padding: 10px; vertical-align: top;">[Detail aktivitas apersepsi, pemantik, dll]</td>
            <td style="border: 1px solid #000; padding: 10px; vertical-align: top;">[Detail rubrik pengamatan awal]</td>
        </tr>
        <tr>
            <td style="border: 1px solid #000; padding: 10px; text-align: center; vertical-align: top;">
                <strong>Kegiatan Inti</strong><br>(50 Menit)
            </td>
            <td style="border: 1px solid #000; padding: 10px; vertical-align: top;">[Sangat detail: Eksplorasi, Elaborasi, Konfirmasi]</td>
            <td style="border: 1px solid #000; padding: 10px; vertical-align: top;">[Detail format penilaian/pengamatan inti]</td>
        </tr>
        <tr>
            <td style="border: 1px solid #000; padding: 10px; text-align: center; vertical-align: top;">
                <strong>Penutup</strong><br>(15 Menit)
            </td>
            <td style="border: 1px solid #000; padding: 10px; vertical-align: top;">[Kesimpulan, refleksi, tugas lanjutan]</td>
            <td style="border: 1px solid #000; padding: 10px; vertical-align: top;">[Pengukuran akhir pemahaman]</td>
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
                temperature: 0.5
            })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || 'Gagal');

        let htmlRes = data.choices[0].message.content;
        htmlRes = htmlRes.replace(/```html/g, '').replace(/```/g, ''); // Pembersihan ekstra

        res.status(200).json({ htmlRpp: htmlRes });

    } catch (error) {
        res.status(500).json({ error: "Gagal menyusun RPP." });
    }
}
