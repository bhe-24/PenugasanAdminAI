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
Anda adalah Pakar Kurikulum Tingkat Lanjut. Buatlah Rancangan Pelaksanaan Pembelajaran (RPP) yang SANGAT PANJANG, MENDALAM, DAN DETAIL berdurasi 80 menit untuk mata pelajaran "${mapel}" semester ${semester} dengan topik "${topik}".

ATURAN WAJIB:
1. Hasil harus berlembar-lembar (Sangat panjang dan komprehensif).
2. Di tabel kegiatan, JANGAN hanya menulis aktivitas guru. Anda WAJIB menuliskan: Aktivitas Guru, Aktivitas Siswa, Poin Penting Materi, dan Indikator Ketercapaian di setiap sesi waktunya.
3. Gunakan HANYA HTML murni. JANGAN gunakan markdown (\`\`\`).
4. WAJIB tambahkan style "page-break-inside: avoid;" pada setiap tag <tr> di dalam tabel agar saat diunduh PDF tidak terpotong di tengah baris.

FORMAT HTML WAJIB:
<div style="margin-bottom: 20px; page-break-inside: avoid;">
    <h3 style="color: #003366; border-bottom: 2px solid #d4af37; padding-bottom: 5px;">A. Capaian Pembelajaran (CP) & Tujuan Pembelajaran (TP)</h3>
    <p><strong>Capaian Pembelajaran:</strong><br> [Tulis CP secara sangat mendalam dan filosofis sesuai topik]</p>
    <p><strong>Tujuan Pembelajaran:</strong><br> 
        <ul style="line-height: 1.6;">
            <li>[Tulis TP 1 secara spesifik]</li>
            <li>[Tulis TP 2 secara spesifik]</li>
            <li>[Tulis TP 3 secara spesifik]</li>
            <li>[Tulis TP 4 secara spesifik]</li>
        </ul>
    </p>
    <p><strong>Indikator Ketercapaian:</strong><br> [Tulis parameter keberhasilan siswa yang bisa diukur]</p>
</div>

<h3 style="color: #003366; border-bottom: 2px solid #d4af37; padding-bottom: 5px;">B. Skenario Pembelajaran (80 Menit)</h3>
<table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11pt;">
    <thead>
        <tr style="background-color: #003366; color: white;">
            <th style="border: 1px solid #000; padding: 12px; width: 15%;">Tahap & Waktu</th>
            <th style="border: 1px solid #000; padding: 12px; width: 45%;">Aktivitas Pengajar & Siswa</th>
            <th style="border: 1px solid #000; padding: 12px; width: 40%;">Poin Penting & Ketercapaian</th>
        </tr>
    </thead>
    <tbody>
        <tr style="page-break-inside: avoid;">
            <td style="border: 1px solid #000; padding: 12px; text-align: center; vertical-align: top;">
                <strong>Pendahuluan</strong><br>(15 Menit)
            </td>
            <td style="border: 1px solid #000; padding: 12px; vertical-align: top;">
                <strong>Guru:</strong> [Detail tindakan guru membimbing, memantik diskusi]<br><br>
                <strong>Siswa:</strong> [Detail respon siswa]
            </td>
            <td style="border: 1px solid #000; padding: 12px; vertical-align: top;">
                <strong>Fokus:</strong> [Fokus materi pendahuluan]<br><br>
                <strong>Ketercapaian:</strong> [Siswa mampu merespon pemantik...]
            </td>
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
                temperature: 0.6 // Dinaikkan sedikit agar AI lebih kreatif dan panjang menulisnya
            })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || 'Gagal');

        let htmlRes = data.choices[0].message.content;
        htmlRes = htmlRes.replace(/```html/g, '').replace(/```/g, ''); 

        res.status(200).json({ htmlRpp: htmlRes });

    } catch (error) {
        res.status(500).json({ error: "Gagal menyusun RPP." });
    }
}
