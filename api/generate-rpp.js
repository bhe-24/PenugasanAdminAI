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
Anda adalah Pakar Kurikulum Tingkat Lanjut dan Master Pedagogi. Buatlah Rancangan Pelaksanaan Pembelajaran (RPP) yang SANGAT DETAIL berdurasi total 80 menit untuk mata pelajaran "${mapel}" semester ${semester} dengan topik "${topik}".

ATURAN WAJIB:
1. Bagi skenario pembelajaran menjadi blok waktu per 10-15 menit (Misal: 00-10, 10-25, 25-40, 40-55, 55-70, 70-80).
2. Di setiap blok waktu, Anda WAJIB menguraikan:
   - Apa materi yang sedang MENJELASKAN.
   - Apa ANALOGI / MEMADANKAN konsep tersebut dengan kehidupan nyata.
   - POIN PENTING apa yang mutlak harus tersampaikan di menit tersebut.
3. Gunakan HANYA HTML murni. JANGAN gunakan markdown (\`\`\`).
4. WAJIB tambahkan style "page-break-inside: avoid;" pada setiap tag <tr> di dalam tabel agar PDF tidak terpotong.

FORMAT HTML WAJIB:
<div style="margin-bottom: 25px; page-break-inside: avoid;">
    <h3 style="color: #003366; border-bottom: 2px solid #d4af37; padding-bottom: 5px; font-size: 14pt;">A. Capaian Pembelajaran (CP) & Tujuan Pembelajaran (TP)</h3>
    <p><strong>Capaian Pembelajaran:</strong><br> [Tulis CP secara sangat mendalam, berbobot, dan filosofis sesuai topik]</p>
    <p><strong>Tujuan Pembelajaran:</strong><br> 
        <ul style="line-height: 1.6;">
            <li>[Tulis TP 1 - ranah kognitif]</li>
            <li>[Tulis TP 2 - ranah afektif/sikap]</li>
            <li>[Tulis TP 3 - ranah psikomotorik/praktik]</li>
        </ul>
    </p>
</div>

<h3 style="color: #003366; border-bottom: 2px solid #d4af37; padding-bottom: 5px; font-size: 14pt;">B. Skenario Pembelajaran Rinci (80 Menit)</h3>
<table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10.5pt; line-height: 1.5;">
    <thead>
        <tr style="background-color: #003366; color: white;">
            <th style="border: 1px solid #000; padding: 12px; width: 15%;">Waktu & Fase</th>
            <th style="border: 1px solid #000; padding: 12px; width: 40%;">Aktivitas Guru (Menjelaskan & Memadankan)</th>
            <th style="border: 1px solid #000; padding: 12px; width: 25%;">Aktivitas Siswa</th>
            <th style="border: 1px solid #000; padding: 12px; width: 20%;">Poin Penting Tersampaikan</th>
        </tr>
    </thead>
    <tbody>
        <tr style="page-break-inside: avoid;">
            <td style="border: 1px solid #000; padding: 12px; text-align: center; vertical-align: top; background-color: #f8fafc;">
                <strong>Menit 00 - 10</strong><br>Pendahuluan & Apersepsi
            </td>
            <td style="border: 1px solid #000; padding: 12px; vertical-align: top;">
                <strong>Menjelaskan:</strong> [Uraikan apa yang guru jelaskan sebagai pembuka]<br><br>
                <strong>Memadankan:</strong> [Berikan analogi menarik untuk memancing rasa ingin tahu siswa]
            </td>
            <td style="border: 1px solid #000; padding: 12px; vertical-align: top;">
                [Detail respon, diskusi, atau tindakan siswa]
            </td>
            <td style="border: 1px solid #000; padding: 12px; vertical-align: top; color: #b91c1c; font-weight: 500;">
                [1-2 kalimat poin target yang harus nyangkut di kepala siswa pada sesi ini]
            </td>
        </tr>
        
        <tr style="page-break-inside: avoid;">
            <td style="border: 1px solid #000; padding: 12px; text-align: center; vertical-align: top; background-color: #ffffff;">
                <strong>Menit 10 - 25</strong><br>Eksplorasi Materi
            </td>
            <td style="border: 1px solid #000; padding: 12px; vertical-align: top;">
                <strong>Menjelaskan:</strong> [Uraikan konsep inti materi]<br><br>
                <strong>Memadankan:</strong> [Analogi relevan dengan dunia remaja/keseharian]
            </td>
            <td style="border: 1px solid #000; padding: 12px; vertical-align: top;">
                [Aktivitas mengamati, mencatat, atau tanya jawab]
            </td>
            <td style="border: 1px solid #000; padding: 12px; vertical-align: top; color: #b91c1c; font-weight: 500;">
                [Poin target pemahaman konsep dasar]
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
                temperature: 0.6 // Suhu ideal untuk memadukan struktur ketat dengan kreativitas bahasa
            })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || 'Gagal dari Groq');

        let htmlRes = data.choices[0].message.content;
        // Pembersihan tag markdown berjaga-jaga jika AI nakal
        htmlRes = htmlRes.replace(/```html/g, '').replace(/```/g, '').trim(); 

        res.status(200).json({ htmlRpp: htmlRes });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Gagal menyusun RPP." });
    }
}
