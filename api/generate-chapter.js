export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { judulBuku, babJudul, jumlahParagraf } = req.body;
        
        // PROMPT GEMINI (Fokus Struktur 4 Bagian & Gaya Bahasa Ringan)
        const prompt = `Anda adalah penulis buku teks pendidikan ahli dari Cendekia Aksara. 
Tulislah isi materi untuk buku berjudul "${judulBuku}", dengan fokus eksklusif pada bab: "${babJudul}".

ATURAN GAYA BAHASA & KONTEN:
- Gunakan gaya bahasa yang RINGAN, mengalir, mudah dipahami siswa, dan TIDAK KAKU.
- Alur penjelasan harus RUNUT, saling menyambung, dan DILARANG KERAS mengulang-ulang kalimat/poin yang sama.
- JIKA MENGGUNAKAN CONTOH KARYA SASTRA, WAJIB menggunakan karya Sastra Indonesia (misal: Bumi Manusia, Laskar Pelangi, Puisi Chairil Anwar, dll). JANGAN gunakan karya luar negeri.
- Panjang materi total MINIMAL ${jumlahParagraf} paragraf yang padat gizi.

ATURAN STRUKTUR WAJIB (Bagi materi bab ini menjadi 4 sub-bab dengan tag <h3>):
1. <h3>1.1 Pengertian dan Konsep Dasar</h3>
   (Jelaskan teori, definisi, dan pondasi dasar dari materi bab ini secara mendalam)
2. <h3>1.2 Cara Penerapan dan Contoh Implementasi</h3>
   (Berikan panduan langkah demi langkah cara menerapkannya beserta contoh kasus/kalimat dari karya sastra Indonesia)
3. <h3>1.3 Analisis dan Perbandingan</h3>
   (WAJIB sertakan 1 TABEL perbandingan/analisis menggunakan tag <table><tr><td>...</td></tr></table> ber-border)
4. <h3>1.4 Kesimpulan dan Pengayaan</h3>
   (Berikan 1 paragraf kesimpulan padat. Setelah itu, WAJIB buat daftar 5 SOAL LATIHAN berbentuk bullet points <ul><li>...</li></ul> untuk menguji pemahaman siswa).

ATURAN FORMATTING HTML:
- Balas HANYA dengan format HTML murni. 
- Gunakan tag <p> untuk paragraf. JANGAN gunakan tag <br> untuk memberi spasi antar paragraf.
- JANGAN sertakan Judul Bab (tag <h1> atau <h2> yang berisi nama bab) di awal teks, langsung mulai dari <h3>1.1.
- DILARANG menggunakan markdown (\`\`\`).`;

        // ==========================================
        // MENGGUNAKAN GEMINI 2.5 FLASH SEBAGAI MESIN UTAMA
        // ==========================================
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
        
        const geminiResponse = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { 
                    temperature: 0.7, // Sedikit lebih kreatif agar tulisan mengalir
                    maxOutputTokens: 8192 // Pastikan tidak terpotong
                }
            })
        });

        if (!geminiResponse.ok) {
            const errData = await geminiResponse.json();
            throw new Error(errData.error?.message || "Gemini API Error");
        }
        
        const geminiData = await geminiResponse.json();
        let htmlRes = geminiData.candidates[0].content.parts[0].text;

        // BERSIHKAN FORMAT MARKDOWN JIKA AI MASIH NAKAL
        htmlRes = htmlRes.replace(/```html/g, '').replace(/```/g, '').trim();
        
        res.status(200).json({ chapterHtml: htmlRes });

    } catch (e) { 
        console.error(e);
        res.status(500).json({ error: "Sistem AI sedang sibuk atau token habis. Coba beberapa saat lagi." }); 
    }
}
